import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, doc,
  onSnapshot, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Firebase init (singleton) ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:     "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs",
  authDomain: "untitled-world-2e645.firebaseapp.com",
  projectId:  "untitled-world-2e645"
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Level system (2 min = 1 XP, 1 hr = 30 XP) ────────────────────────────────
const LEVELS = [
  { min: 0,   name: "Beginner",  icon: "🌱", color: "#00e5a0", bg: "rgba(0,229,160,0.12)",  border: "rgba(0,229,160,0.3)"  },
  { min: 30,  name: "Explorer",  icon: "🔍", color: "#00e0ff", bg: "rgba(0,224,255,0.12)",  border: "rgba(0,224,255,0.3)"  },
  { min: 90,  name: "Scholar",   icon: "📚", color: "#4facfe", bg: "rgba(79,172,254,0.12)", border: "rgba(79,172,254,0.3)" },
  { min: 150, name: "Focused",   icon: "🎯", color: "#7c5cfc", bg: "rgba(124,92,252,0.12)", border: "rgba(124,92,252,0.3)" },
  { min: 210, name: "Achiever",  icon: "⚡", color: "#ffb830", bg: "rgba(255,184,48,0.12)", border: "rgba(255,184,48,0.3)" },
  { min: 270, name: "Expert",    icon: "🔥", color: "#ff7a18", bg: "rgba(255,122,24,0.12)", border: "rgba(255,122,24,0.3)" },
  { min: 330, name: "Master",    icon: "💎", color: "#ff4f6a", bg: "rgba(255,79,106,0.12)", border: "rgba(255,79,106,0.3)" },
  { min: 390, name: "Legend",    icon: "👑", color: "#ffd700", bg: "rgba(255,215,0,0.12)",  border: "rgba(255,215,0,0.35)" }
];

function getLevel(xp) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) {
    if ((xp || 0) >= l.min) lvl = l;
    else break;
  }
  return lvl;
}

// ── Weekly helpers ────────────────────────────────────────────────────────────
function getWeekNumber() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-W${Math.ceil((((d - yearStart) / 86400000) + 1) / 7)}`;
}

function daysUntilReset() {
  const day = new Date().getDay();
  return day === 1 ? 7 : (8 - day) % 7;
}

// ── DOM refs — matches new leaderboard.html ───────────────────────────────────
const podiumArea = document.getElementById("podiumArea");
const rankList   = document.getElementById("rankList");
const loading    = document.getElementById("loading");
const myRankBar  = document.getElementById("myRankBar");
const myRankVal  = document.getElementById("myRankVal");
const myXpVal    = document.getElementById("myXpVal");
const resetTimer = document.getElementById("resetTimer");
const levelStrip = document.getElementById("levelStrip");

// ── Level strip ───────────────────────────────────────────────────────────────
if (levelStrip) {
  levelStrip.innerHTML = LEVELS.map(l => `
    <div class="lvl-pill">
      <span class="lvl-icon">${l.icon}</span>
      <span class="lvl-name" style="color:${l.color};">${l.name}</span>
      <span style="font-size:9px;color:rgba(255,255,255,0.35);">${l.min} XP</span>
    </div>`).join("");
}

// ── Reset countdown ───────────────────────────────────────────────────────────
if (resetTimer) {
  const d = daysUntilReset();
  resetTimer.textContent = `Resets in ${d} day${d === 1 ? "" : "s"}`;
}

// ── Top-3 popup ───────────────────────────────────────────────────────────────
function showTopPopup(lvl, rank) {
  const overlay = document.createElement("div");
  overlay.className = "levelup-overlay";
  overlay.innerHTML = `
    <div class="levelup-card">
      <div class="levelup-icon">${lvl.icon}</div>
      <div class="levelup-title">🔥 You are in Top ${rank}!</div>
      <div class="levelup-sub">
        You reached <b style="color:${lvl.color};">${lvl.name}</b> level!<br>
        Keep studying to climb higher 🚀
      </div>
      <button class="levelup-btn" onclick="this.closest('.levelup-overlay').remove()">
        Keep Going!
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

const POPUP_KEY = "uw_lb_popup_shown";
let popupShown  = sessionStorage.getItem(POPUP_KEY) === "true";

// ── Format helpers ────────────────────────────────────────────────────────────
function formatTime(totalMin) {
  const h = Math.floor((totalMin || 0) / 60);
  const m = (totalMin || 0) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderLeaderboard(users, currentUserName) {

  if (loading) loading.style.display = "none";

  // Sort by weeklyXP desc, top 20
  const sorted = [...users]
    .filter(u => (u.weeklyXP || 0) > 0 || u.name)
    .sort((a, b) => (b.weeklyXP || 0) - (a.weeklyXP || 0))
    .slice(0, 20);

  if (!sorted.length) {
    if (loading) {
      loading.style.display = "block";
      loading.innerHTML = `<div style="padding:40px;color:rgba(255,255,255,0.4);font-size:14px;">No data this week yet.</div>`;
    }
    return;
  }

  // ── My rank bar ───────────────────────────────────────────────────────────
  const myIdx = sorted.findIndex(u => u.name === currentUserName);
  if (myIdx >= 0 && myRankBar) {
    const me = sorted[myIdx];
    myRankBar.classList.add("visible");
    if (myRankVal) myRankVal.textContent = `#${myIdx + 1} of ${sorted.length}`;
    if (myXpVal)   myXpVal.textContent   = `⭐ ${me.weeklyXP || 0} XP`;

    // Top-3 popup — once per session
    if (myIdx < 3 && !popupShown) {
      popupShown = true;
      sessionStorage.setItem(POPUP_KEY, "true");
      setTimeout(() => showTopPopup(getLevel(me.weeklyXP || 0), myIdx + 1), 800);
    }
  }

  // ── Podium (top 3) ────────────────────────────────────────────────────────
  if (podiumArea) {
    podiumArea.innerHTML = "";
    const u1 = sorted[0], u2 = sorted[1], u3 = sorted[2];

    const podium = document.createElement("div");
    podium.className = "podium-wrap";

    const buildCol = (u, rank) => {
      if (!u) return null;
      const lvl = getLevel(u.weeklyXP || 0);
      const col = document.createElement("div");
      col.className = "podium-col";
      col.innerHTML = `
        <div class="podium-avatar rank-${rank}">
          ${rank === 1 ? '<span class="podium-crown">👑</span>' : ""}
          ${(u.name || "?")[0].toUpperCase()}
        </div>
        <div class="podium-name">${u.name || "—"}</div>
        <div class="podium-xp">⭐ ${u.weeklyXP || 0} XP</div>
        <div class="podium-lvl">${lvl.icon} ${lvl.name}</div>
        <div class="podium-bar rank-${rank}">${rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</div>`;
      return col;
    };

    // Order: 2nd left, 1st centre, 3rd right
    const c2 = buildCol(u2, 2);
    const c1 = buildCol(u1, 1);
    const c3 = buildCol(u3, 3);
    if (c2) podium.appendChild(c2);
    if (c1) podium.appendChild(c1);
    if (c3) podium.appendChild(c3);
    podiumArea.appendChild(podium);
  }

  // ── Rank list 4–20 ────────────────────────────────────────────────────────
  if (rankList) {
    rankList.innerHTML = "";
    for (let i = 3; i < sorted.length; i++) {
      const u    = sorted[i];
      const rank = i + 1;
      const lvl  = getLevel(u.weeklyXP || 0);
      const isMe = u.name === currentUserName;

      const row = document.createElement("div");
      row.className = "rank-row";
      if (isMe) {
        row.style.border     = `1px solid ${lvl.color}`;
        row.style.background = lvl.bg;
        row.style.boxShadow  = `0 0 14px ${lvl.color}44`;
      }

      row.innerHTML = `
        <div class="rank-num">#${rank}</div>
        <div class="rank-avatar" style="color:${lvl.color};background:${lvl.bg};">
          ${(u.name || "?")[0].toUpperCase()}
        </div>
        <div class="rank-info">
          <div class="rank-name">${u.name || "—"}${isMe ? `&nbsp;<span style="color:var(--cyan);font-size:11px;">(You)</span>` : ""}</div>
          <div class="rank-detail">⏱ ${formatTime(u.focusTime || 0)} focused</div>
        </div>
        <div class="rank-right">
          <div class="rank-xp">⭐ ${u.weeklyXP || 0}</div>
          <div class="level-badge" style="background:${lvl.bg};color:${lvl.color};border:1px solid ${lvl.border};">
            ${lvl.icon} ${lvl.name}
          </div>
        </div>`;
      rankList.appendChild(row);
    }
  }
}

// ── Auth + weekly reset + live listener ──────────────────────────────────────
onAuthStateChanged(auth, async user => {

  if (!user) {
    if (loading) {
      loading.style.display = "block";
      loading.innerHTML = `<div style="padding:60px 20px;color:rgba(255,255,255,0.4);font-size:14px;">Please log in to view the leaderboard.</div>`;
    }
    return;
  }

  const currentUserName = user.displayName || localStorage.getItem("userName") || "";

  // ── Weekly XP reset for this user ─────────────────────────────────────────
  const currentWeek = getWeekNumber();
  try {
    const userRef  = doc(db, "users", currentUserName);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.lastActiveWeek && data.lastActiveWeek !== currentWeek) {
        await updateDoc(userRef, {
          weeklyXP:       0,
          lastActiveWeek: currentWeek
        });
      }
    }
  } catch {}

  // ── Live onSnapshot — leaderboard updates instantly ───────────────────────
  onSnapshot(collection(db, "users"), snap => {
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLeaderboard(users, currentUserName);
  }, err => {
    console.error("[Leaderboard]", err);
    if (loading) {
      loading.style.display = "block";
      loading.innerHTML = `<div style="padding:40px;color:rgba(255,79,106,0.7);font-size:14px;">Could not load leaderboard.</div>`;
    }
  });
});
