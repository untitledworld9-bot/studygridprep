/**
 * uw-core.js — Study Grid Prep
 *
 * Single source of truth for XP, Streak, Firebase sync.
 * Both todo.html and playlist.html import this.
 *
 * Exposes window.UW so non-module inline scripts can call everything.
 * Sets window.db and window.auth so legacy checks still work.
 *
 * UPDATED: _syncLeaderboard now reads timerXP from existing leaderboard
 *          doc so level is computed from combined (playlist+todo+timer) XP.
 */

import {
  db,
  auth,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "./firebase.js";

/* ─────────────────────────────
   STORAGE KEYS (shared across all pages)
───────────────────────────── */
const XP_KEY          = "uw_xp";
const STREAK_KEY      = "uw_streak";
const STREAK_DATE_KEY = "uw_last_streak";
const BONUS_KEY       = "uw_todo_daily_bonus";

/* ─────────────────────────────
   INTERNAL STATE
───────────────────────────── */
let _authUser        = null;
let _ready           = false;
let _readyCallbacks  = [];

/* ─────────────────────────────
   AUTH STATE
───────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  _authUser = user;
  window.db   = db;
  window.auth = auth;

  if (user) {
    await loadUserData();
  }

  _ready = true;
  _readyCallbacks.forEach(cb => { try { cb(user); } catch(e) {} });
  _readyCallbacks = [];

  window.dispatchEvent(new CustomEvent("uw_auth_ready", { detail: { user } }));
});

/* ─────────────────────────────
   onReady
───────────────────────────── */
function onReady(cb) {
  if (_ready) { try { cb(_authUser); } catch(e) {} }
  else _readyCallbacks.push(cb);
}

/* ─────────────────────────────
   WEEK KEY (must match script.js's getWeekNumber logic so both
   timer XP and study XP roll over on the exact same week boundary)
───────────────────────────── */
function _getWeekKey() {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const ys = new Date(d.getFullYear(),0,1);
  return `${d.getFullYear()}-W${Math.ceil((((d-ys)/86400000)+1)/7)}`;
}

/* ─────────────────────────────
   XP
───────────────────────────── */
function getXP() {
  return Math.max(0, parseInt(localStorage.getItem(XP_KEY) || "0", 10));
}

async function setXPAbsolute(v, deltaForWeekly) {
  v = Math.max(0, v);
  localStorage.setItem(XP_KEY, String(v));
  window.dispatchEvent(new CustomEvent("uw_xp_changed", { detail: { xp: v } }));
  await _saveUser({ xp: v });
  await _syncLeaderboard(deltaForWeekly || 0);
  return v;
}

async function updateXP(amount) {
  return setXPAbsolute(getXP() + amount, amount);
}

/* ─────────────────────────────
   STREAK
───────────────────────────── */
function getStreak() {
  return Math.max(0, parseInt(localStorage.getItem(STREAK_KEY) || "0", 10));
}

async function updateStreak() {
  const today    = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0, 10);

  // ✅ FIX: Always read from Firestore first — localStorage may be stale on new device
  // This prevents streak reset when user logs in on a new device
  let firestoreStreak   = 0;
  let firestoreLastDate = "";
  let firestoreHistory  = [];
  try {
    if (_authUser) {
      const snap = await getDoc(doc(db, "users", _authUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        firestoreStreak   = d.streak || 0;
        firestoreLastDate = d.lastStreakDate || "";
        firestoreHistory  = d.streakHistory || [];
        // Sync localStorage from Firestore so it's always fresh
        localStorage.setItem(STREAK_KEY,      String(firestoreStreak));
        localStorage.setItem(STREAK_DATE_KEY, firestoreLastDate);
      }
    }
  } catch(e) { console.warn("[UW Core] streak Firestore read failed:", e); }

  // Use Firestore data (or localStorage fallback if Firestore read failed)
  const last  = firestoreLastDate || localStorage.getItem(STREAK_DATE_KEY) || "";
  let   count = firestoreStreak   || parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);

  // Already counted today — return current streak, no update needed.
  // ✅ FIX: still refresh lastActiveDate so other pages (dashboard) don't see a
  // stale "presence" date and wrongly think the streak is broken.
  if (last === today) {
    _saveUser({ lastActiveDate: today }).catch(() => {});
    return count;
  }

  // ✅ ROOT-CAUSE FIX: compute streakHistory first, then derive the streak
  // NUMBER from it (same logic as dashboard-home.html), instead of doing
  // independent +1/reset math here. Two separate code paths incrementing
  // a shared counter (this one, and dashboard-home.html's) is exactly what
  // caused the streak to jump straight from 0 to 2 in one day — deriving
  // from the history array everywhere makes both paths always agree.
  const updatedHistory = firestoreHistory.includes(todayISO)
    ? firestoreHistory
    : [...firestoreHistory, todayISO].slice(-90);

  const histSet = new Set(updatedHistory);
  count = 0;
  let cursor = new Date();
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (histSet.has(iso)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  localStorage.setItem(STREAK_KEY,      String(count));
  localStorage.setItem(STREAK_DATE_KEY, today);

  window.dispatchEvent(new CustomEvent("uw_streak_changed", { detail: { streak: count } }));
  // ✅ FIX: also write lastActiveDate so dashboard-home.html's break-detection
  // (which cross-checks lastActiveDate) never sees stale presence data and
  // incorrectly resets a streak that was legitimately earned today.
  await _saveUser({
    streak: count,
    lastStreakDate: today,
    lastActiveDate: today,
    streakHistory: updatedHistory
  });
  await _syncLeaderboard();
  return count;
}

/* ─────────────────────────────
   LEVEL SYSTEM
───────────────────────────── */
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300];

function getLevel(xp) {
  xp = (xp !== undefined) ? xp : getXP();
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getLevelProgress(xp) {
  xp = (xp !== undefined) ? xp : getXP();
  const level = getLevel(xp);
  if (level >= 8) return 100;
  const from = LEVEL_THRESHOLDS[level - 1];
  const to   = LEVEL_THRESHOLDS[level];
  return Math.round(((xp - from) / (to - from)) * 100);
}

/* ─────────────────────────────
   BADGE SYSTEM
───────────────────────────── */
function getBadge(xp) {
  xp = (xp !== undefined) ? xp : getXP();
  if (xp >= 500) return "🏆 Untitled Champion";
  if (xp >= 300) return "⚡ Study Master";
  if (xp >= 150) return "🔥 Focused Learner";
  if (xp >= 50)  return "⭐ Rising Learner";
  return "🏅 Beginner";
}

/* ─────────────────────────────
   STREAK BREAK DETECTION (runs on EVERY page)
   Previously this check only existed inside dashboard-home.html, so if the
   user's first page of the day was anything else (timer, playlist, todo, a
   mock test...) a missed day was never detected: the streak stayed at its
   old value indefinitely and the "Streak Broken!" popup never appeared,
   until they happened to open the dashboard again. Running it here means
   the reset now always happens the moment the user opens the app at all,
   on any page — dashboard-home.html then just needs to show a popup for a
   break it (or this) already detected.
   Uses the exact same rules as dashboard-home.html's own check, so both
   can never disagree about whether a break happened.
───────────────────────────── */
const STREAK_BREAK_PENDING_KEY = "uw_pending_streak_break";

async function _checkStreakBreak(d) {
  const today         = new Date().toDateString();
  const yesterday      = new Date(Date.now() - 86400000).toDateString();
  const lastStreakDate = d.lastStreakDate || "";
  const streak         = d.streak || 0;

  const hadStreakBefore = streak > 0;
  const streakDoneToday = (lastStreakDate === today);
  // Real gap: lastStreakDate is set, isn't today, and isn't yesterday either.
  const missedDay = lastStreakDate && lastStreakDate !== today && lastStreakDate !== yesterday;

  if (streakDoneToday || !missedDay || !hadStreakBefore) return;

  // Reset now, immediately, regardless of which page detected it.
  localStorage.setItem(STREAK_KEY, "0");
  window.dispatchEvent(new CustomEvent("uw_streak_changed", { detail: { streak: 0 } }));
  await _saveUser({ streak: 0 });

  // Flag it (once per day) so whichever page has the popup UI
  // (dashboard-home.html) can show it next time it's opened — even if
  // that's a different page load than the one that did the reset.
  const shownKey = "streakBreakShown_" + today;
  if (!localStorage.getItem(shownKey)) {
    localStorage.setItem(STREAK_BREAK_PENDING_KEY, "1");
  }
}

/* ─────────────────────────────
   LOAD USER DATA
───────────────────────────── */
async function loadUserData() {
  if (!_authUser) return null;
  try {
    const snap = await getDoc(doc(db, "users", _authUser.uid));
    if (snap.exists()) {
      const d = snap.data();
      // ✅ FIX: Always sync from Firestore — this is the source of truth
      // Overwrite any stale localStorage values from old/different device
      if (d.xp !== undefined) {
        localStorage.setItem(XP_KEY, String(Math.max(0, d.xp)));
        window.dispatchEvent(new CustomEvent("uw_xp_changed", { detail: { xp: d.xp } }));
      }
      // Always write streak — even if 0, so stale localStorage value is cleared
      if (d.streak !== undefined) {
        localStorage.setItem(STREAK_KEY, String(d.streak));
        window.dispatchEvent(new CustomEvent("uw_streak_changed", { detail: { streak: d.streak } }));
      }
      if (d.lastStreakDate !== undefined) localStorage.setItem(STREAK_DATE_KEY, d.lastStreakDate || "");

      // Runs on every page, not just dashboard-home.html — see comment above.
      await _checkStreakBreak(d);

      return d;
    }
  } catch(e) { console.warn("[UW Core] loadUserData failed:", e); }
  return null;
}

/* ─────────────────────────────
   SAVE USER DATA (partial merge)
───────────────────────────── */
async function saveUserData(partial) {
  await _saveUser(partial);
}

async function _saveUser(partial) {
  if (!_authUser) return;
  try {
    await setDoc(doc(db, "users", _authUser.uid), partial, { merge: true });
  } catch(e) { console.warn("[UW Core] saveUser failed:", e); }
}

/* ─────────────────────────────
   LEADERBOARD SYNC
   Reads existing timerXP from leaderboard so level reflects
   combined (playlist/todo + timer) XP.
   Uses merge:true so script.js writes to timerXP/focusTime are preserved.
───────────────────────────── */
function _getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

async function _syncLeaderboard(delta) {
  if (!_authUser) return;
  delta = delta || 0;
  const playlistXP = getXP();
  const streak     = getStreak();
  const name       = _authUser.displayName || _authUser.email || "Anonymous";
  const week       = _getWeekKey();
  const today      = _getTodayKey();

  try {
    // Read existing timerXP + weekly/daily study XP state to compute
    // combined level and correctly roll both over on new week/day.
    let timerXP  = 0;
    let weeklyXP = 0;
    let todayXP  = 0;
    let lastActiveWeekStudy = "";
    let lastStudyResetDate  = "";
    try {
      const lbSnap = await getDoc(doc(db, "leaderboard", _authUser.uid));
      if (lbSnap.exists()) {
        const d = lbSnap.data();
        timerXP = d.timerXP || 0;
        weeklyXP = d.weeklyXP || 0;
        todayXP  = d.todayXP || 0;
        lastActiveWeekStudy = d.lastActiveWeekStudy || "";
        lastStudyResetDate  = d.lastStudyResetDate || "";
      }
    } catch(e) {}

    // FIX-WEEKLY-STUDY-XP: weeklyXP (playlist/todo) now resets on a new week
    // just like weeklyTimerXP already does for the focus timer, so
    // mainleaderboard.html's "This Week" tab reflects real weekly activity
    // instead of the lifetime total.
    if (lastActiveWeekStudy !== week) weeklyXP = 0;
    if (delta > 0) weeklyXP += delta;

    // FIX-DAILY-STUDY-XP: todayXP resets every day, mirroring how
    // todayTimerXP already works for the focus timer — this is what was
    // missing, which made the admin panel's "Today" leaderboard tab always
    // show 0 study XP for every single user regardless of real activity.
    if (lastStudyResetDate !== today) todayXP = 0;
    if (delta > 0) todayXP += delta;

    const totalXP = playlistXP + timerXP;
    const level   = getLevel(totalXP);

    // Write playlist/todo XP; merge:true preserves timerXP + focusTime written by script.js
    await setDoc(doc(db, "leaderboard", _authUser.uid), {
      name,
      xp:        playlistXP,   // playlist + todo XP only (lifetime)
      weeklyXP,                // playlist + todo XP (resets weekly)
      todayXP,                 // playlist + todo XP (resets daily)
      lastActiveWeekStudy: week,
      lastStudyResetDate: today,
      streak,
      level,                   // level from combined total
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn("[UW Core] leaderboard sync failed:", e); }
}

async function updateLeaderboard() {
  return _syncLeaderboard();
}

/* ─────────────────────────────
   SAVE TASKS + PLAYLIST to Firebase
───────────────────────────── */
async function syncData(payload) {
  if (!_authUser) return;
  try {
    // ✅ FIX: Don't blindly write localStorage streak/XP to Firestore
    // Only write streak/XP if localStorage is populated (i.e. not empty/zero from new device)
    const localXP     = getXP();
    const localStreak = getStreak();
    const localDate   = localStorage.getItem(STREAK_DATE_KEY) || "";

    // Read current Firestore values to avoid overwriting with stale localStorage
    let fsStreak = localStreak, fsXP = localXP, fsDate = localDate;
    try {
      const snap = await getDoc(doc(db, "users", _authUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        // Use Firestore value if localStorage is 0/empty (new device scenario)
        if (!localStreak && d.streak) fsStreak = d.streak;
        if (!localXP    && d.xp)     fsXP     = d.xp;
        if (!localDate  && d.lastStreakDate) fsDate = d.lastStreakDate;
        // Sync back to localStorage
        localStorage.setItem(STREAK_KEY,      String(fsStreak));
        localStorage.setItem(XP_KEY,          String(fsXP));
        localStorage.setItem(STREAK_DATE_KEY, fsDate);
      }
    } catch(e) {}

    const base = {
      xp:             fsXP,
      streak:         fsStreak,
      lastStreakDate: fsDate
    };
    await setDoc(
      doc(db, "users", _authUser.uid),
      { ...base, ...payload },
      { merge: true }
    );
    await _syncLeaderboard();
  } catch(e) { console.warn("[UW Core] syncData failed:", e); }
}

function consumePendingStreakBreak() {
  const pending = localStorage.getItem(STREAK_BREAK_PENDING_KEY) === "1";
  if (pending) localStorage.removeItem(STREAK_BREAK_PENDING_KEY);
  return pending;
}

/* ─────────────────────────────
   EXPOSE TO WINDOW
───────────────────────────── */
window.UW = {
  onReady,
  getXP,
  setXPAbsolute,
  updateXP,
  getStreak,
  updateStreak,
  getLevel,
  getLevelProgress,
  getBadge,
  loadUserData,
  saveUserData,
  syncData,
  updateLeaderboard,
  consumePendingStreakBreak,
  LEVEL_THRESHOLDS
};

console.log("[UW Core] loaded");
