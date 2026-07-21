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

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  if (last === yesterdayStr) {
    count++; // Consecutive day — increment
  } else if (last === "") {
    count = 1; // First ever streak
  } else {
    count = 1; // Streak broken — reset to 1 for today
  }

  localStorage.setItem(STREAK_KEY,      String(count));
  localStorage.setItem(STREAK_DATE_KEY, today);

  // ✅ FIX: keep streakHistory in sync too — dashboard's week-popup and daily
  // streak popup both read this array, so without it they looked "stuck".
  const updatedHistory = firestoreHistory.includes(todayISO)
    ? firestoreHistory
    : [...firestoreHistory, todayISO].slice(-90);

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
async function _syncLeaderboard(delta) {
  if (!_authUser) return;
  delta = delta || 0;
  const playlistXP = getXP();
  const streak     = getStreak();
  const name       = _authUser.displayName || _authUser.email || "Anonymous";
  const week       = _getWeekKey();

  try {
    // Read existing timerXP + weekly study XP state to compute combined level
    // and correctly roll over weeklyXP on a new week.
    let timerXP  = 0;
    let weeklyXP = 0;
    let lastActiveWeekStudy = "";
    try {
      const lbSnap = await getDoc(doc(db, "leaderboard", _authUser.uid));
      if (lbSnap.exists()) {
        const d = lbSnap.data();
        timerXP = d.timerXP || 0;
        weeklyXP = d.weeklyXP || 0;
        lastActiveWeekStudy = d.lastActiveWeekStudy || "";
      }
    } catch(e) {}

    // FIX-WEEKLY-STUDY-XP: weeklyXP (playlist/todo) now resets on a new week
    // just like weeklyTimerXP already does for the focus timer, so
    // mainleaderboard.html's "This Week" tab reflects real weekly activity
    // instead of the lifetime total.
    if (lastActiveWeekStudy !== week) weeklyXP = 0;
    if (delta > 0) weeklyXP += delta;

    const totalXP = playlistXP + timerXP;
    const level   = getLevel(totalXP);

    // Write playlist/todo XP; merge:true preserves timerXP + focusTime written by script.js
    await setDoc(doc(db, "leaderboard", _authUser.uid), {
      name,
      xp:        playlistXP,   // playlist + todo XP only (lifetime)
      weeklyXP,                // playlist + todo XP (resets weekly)
      lastActiveWeekStudy: week,
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
  LEVEL_THRESHOLDS
};

console.log("[UW Core] loaded");
