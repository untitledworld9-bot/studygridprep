/**
 * leaderboard.js — Study Grid Prep Weekly (Focus) Leaderboard
 * UI: matched to dashboard-home.html design system
 */

import { db, auth, onAuthStateChanged } from "./firebase.js";
import {
  collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Level system ─────────────────────────────────────────────────────────────
const LEVELS = [
  { min: 0,   name: "Beginner",  icon: "fa-seedling",     color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)"  },
  { min: 30,  name: "Explorer",  icon: "fa-compass",      color: "#0EA5E9", bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.25)"  },
  { min: 90,  name: "Scholar",   icon: "fa-book-open",    color: "#5B5BF6", bg: "rgba(91,91,246,0.10)",   border: "rgba(91,91,246,0.25)"   },
  { min: 150, name: "Focused",   icon: "fa-bullseye",     color: "#7C3AED", bg: "rgba(124,58,237,0.10)",  border: "rgba(124,58,237,0.25)"  },
  { min: 210, name: "Achiever",  icon: "fa-bolt",         color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)"  },
  { min: 270, name: "Expert",    icon: "fa-fire",         color: "#F97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.25)"  },
  { min: 330, name: "Master",    icon: "fa-gem",          color: "#EC4899", bg: "rgba(236,72,153,0.10)",  border: "rgba(236,72,153,0.25)"  },
  { min: 390, name: "Legend",    icon: "fa-crown",        color: "#FBBF24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.30)"  }
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
function daysUntilReset() {
  const day = new Date().getDay();
  return day === 1 ? 7 : (8 - day) % 7;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const podiumArea  = document.getElementById("podiumArea");
const rankList    = document.getElementById("rankList");
const loading     = document.getElementById("loading");
const myRankBar   = document.getElementById("myRankBar");
const myRankVal   = document.getElementById("myRankVal");
const myXpVal     = document.getElementById("myXpVal");
const resetTimer  = document.getElementById("resetTimer");
const levelStrip  = document.getElementById("levelStrip");
const refreshBtn  = document.getElementById("refreshBtn");

// ── Level strip ───────────────────────────────────────────────────────────────
if (levelStrip) {
  levelStrip.innerHTML = LEVELS.map(l => `
    <div class="lvl-pill">
      <i class="fa-solid ${l.icon} lvl-icon" style="color:${l.color}; font-size:14px;"></i>
      <span class="lvl-name" style="color:${l.color};">${l.name}</span>
      <span class="lvl-min">${l.min} XP</span>
    </div>`).join("");
}

// ── Reset countdown ───────────────────────────────────────────────────────────
if (resetTimer) {
  const d = daysUntilReset();
  resetTimer.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="font-size:9px; margin-right:3px;"></i>Resets in ${d}d`;
}

// ── Refresh btn spinner ───────────────────────────────────────────────────────
if (refreshBtn) {
  refreshBtn.onclick = () => {
    refreshBtn.classList.add("spinning");
    setTimeout(() => refreshBtn.classList.remove("spinning"), 1200);
  };
}

// ── Top-3 popup ───────────────────────────────────────────────────────────────
const POPUP_KEY = "uw_lb_popup_shown";
let popupShown = sessionStorage.getItem(POPUP_KEY) === "true";

function showTopPopup(lvl, rank) {
  const overlay = document.createElement("div");
  overlay.className = "levelup-overlay";
  overlay.innerHTML = `
    <div class="levelup-card">
      <i class="fa-solid ${lvl.icon} levelup-icon" style="color:${lvl.color};"></i>
      <div class="levelup-title">You're in Top ${rank}!</div>
      <div class="levelup-sub">
        You reached <b style="color:${lvl.color};">${lvl.name}</b> level.<br>
        Keep studying to climb higher.
      </div>
      <button class="levelup-btn" onclick="this.closest('.levelup-overlay').remove()">
        <i class="fa-solid fa-arrow-up" style="font-size:11px;margin-right:6px;"></i>Keep Going
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(totalMin) {
  const h = Math.floor((totalMin || 0) / 60);
  const m = (totalMin || 0) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderLeaderboard(entries, currentUid) {
  if (loading) loading.style.display = "none";

  if (!entries.length) {
    if (podiumArea) podiumArea.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap"><i class="fa-solid fa-trophy"></i></div>
        <div class="empty-title">No sessions this week yet</div>
        <div class="empty-sub">Start a focus session to appear on the board.</div>
      </div>`;
    return;
  }

  // ── My rank bar ───────────────────────────────────────────────────────────
  const myIdx = entries.findIndex(u => u.uid === currentUid);
  if (myIdx >= 0 && myRankBar) {
    const me = entries[myIdx];
    myRankBar.classList.add("visible");
    if (myRankVal) myRankVal.textContent = `#${myIdx + 1} of ${entries.length}`;
    if (myXpVal)   myXpVal.innerHTML = `<i class="fa-solid fa-star" style="font-size:11px;"></i> ${me.weeklyTimerXP || 0} XP`;

    if (myIdx < 3 && !popupShown) {
      popupShown = true;
      sessionStorage.setItem(POPUP_KEY, "true");
      setTimeout(() => showTopPopup(getLevel(me.weeklyTimerXP || 0), myIdx + 1), 800);
    }
  }

  // ── Podium (top 3) ────────────────────────────────────────────────────────
  if (podiumArea) {
    const medals = ["🥇","🥈","🥉"];
    const rankClasses = ["rank-1","rank-2","rank-3"];
    const pedestalClasses = ["p1","p2","p3"];

    const buildCol = (u, rank) => {
      if (!u) return "";
      const lvl = getLevel(u.weeklyTimerXP || 0);
      const ri  = rank - 1;
      return `
        <div class="podium-col">
          <div class="podium-avatar ${rankClasses[ri]}">
            ${rank === 1 ? `<span class="podium-crown"><i class="fa-solid fa-crown" style="color:#FBBF24; font-size:15px;"></i></span>` : ""}
            ${(u.name || "?")[0].toUpperCase()}
          </div>
          <div class="podium-name">${escHtml(u.name || "—")}</div>
          <div class="podium-xp">
            <i class="fa-solid fa-star" style="font-size:9px;"></i> ${u.weeklyTimerXP || 0} XP
          </div>
          <div class="podium-lvl">
            <i class="fa-solid ${lvl.icon}" style="color:${lvl.color}; font-size:9px;"></i> ${lvl.name}
          </div>
          <div class="podium-pedestal ${pedestalClasses[ri]}">${medals[ri]}</div>
        </div>`;
    };

    // Order: 2nd left, 1st centre, 3rd right
    podiumArea.innerHTML = `
      <div class="podium-card">
        <div class="podium-wrap">
          ${buildCol(entries[1], 2)}
          ${buildCol(entries[0], 1)}
          ${buildCol(entries[2], 3)}
        </div>
      </div>`;
  }

  // ── Rank list 4–20 ────────────────────────────────────────────────────────
  if (rankList) {
    let html = "";
    for (let i = 3; i < Math.min(entries.length, 20); i++) {
      const u    = entries[i];
      const rank = i + 1;
      const lvl  = getLevel(u.weeklyTimerXP || 0);
      const isMe = u.uid === currentUid;

      let rankNumClass = "";
      if (rank === 1) rankNumClass = "top1";
      else if (rank === 2) rankNumClass = "top2";
      else if (rank === 3) rankNumClass = "top3";

      html += `
        <div class="rank-row${isMe ? " is-me" : ""}">
          <div class="rank-num ${rankNumClass}">#${rank}</div>
          <div class="rank-avatar" style="color:${lvl.color}; background:${lvl.bg};">
            ${(u.name || "?")[0].toUpperCase()}
          </div>
          <div class="rank-info">
            <div class="rank-name">
              ${escHtml(u.name || "—")}
              ${isMe ? `<span class="rank-you-tag">You</span>` : ""}
            </div>
            <div class="rank-detail">
              <i class="fa-solid fa-clock" style="font-size:9px; margin-right:3px;"></i>${formatTime(u.weeklyFocusTime || u.focusTime || 0)} this week
            </div>
          </div>
          <div class="rank-right">
            <div class="rank-xp">
              <i class="fa-solid fa-star" style="font-size:10px; margin-right:3px;"></i>${u.weeklyTimerXP || 0}
            </div>
            <div class="rank-badge" style="background:${lvl.bg}; color:${lvl.color}; border:1px solid ${lvl.border};">
              <i class="fa-solid ${lvl.icon}" style="font-size:8px; margin-right:3px;"></i>${lvl.name}
            </div>
          </div>
        </div>`;
    }
    rankList.innerHTML = html;
  }
}

// ── Auth + live listener ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    if (loading) {
      loading.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap"><i class="fa-solid fa-lock"></i></div>
          <div class="empty-title">Login required</div>
          <div class="empty-sub">Please log in to view the leaderboard.</div>
        </div>`;
    }
    return;
  }

  const currentUid = user.uid;
  const q = query(
    collection(db, "leaderboard"),
    orderBy("weeklyTimerXP", "desc"),
    limit(50)
  );

  onSnapshot(q, snap => {
    const seen    = new Set();
    const entries = snap.docs
      .map(d => ({
        uid:             d.id,
        name:            d.data().name            || "Anonymous",
        weeklyTimerXP:   d.data().weeklyTimerXP   || 0,
        focusTime:       d.data().focusTime        || 0,
        weeklyFocusTime: d.data().weeklyFocusTime  || 0,
      }))
      .filter(u => u.weeklyTimerXP > 0)
      .filter(u => { if (seen.has(u.uid)) return false; seen.add(u.uid); return true; })
      .map((u, i) => ({ ...u, rank: i + 1 }));

    renderLeaderboard(entries, currentUid);
  }, err => {
    console.error("[Leaderboard]", err);
    if (loading) {
      loading.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap"><i class="fa-solid fa-triangle-exclamation" style="color:var(--orange);"></i></div>
          <div class="empty-title">Could not load</div>
          <div class="empty-sub">Check your connection and try again.</div>
        </div>`;
    }
  });
});
               
