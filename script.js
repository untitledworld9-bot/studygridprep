/**
 * script.js — Study Grid Prep Focus Timer (FIXED v4)
 *
 * KEY FIXES in v4:
 *   FIX-DUP : users doc is now keyed by UID (not displayName) to eliminate
 *             duplicate users in admin panel, recent users, user management.
 *             All updateDoc/setDoc references updated from "users/currentUser"
 *             to "users/_timerUid".
 *             currentUser (displayName) is still used for display + messages only.
 *   FIX-OL  : Online indicator — statusBadge now uses lastActive timestamp;
 *             if lastActive > 2 min ago, force Offline regardless of status field.
 *             (This fix is in admin.js, not here — see statusBadge there.)
 *
 * All original FIX-A through FIX-H preserved.
 * FIX-1 through FIX-8 preserved.
 */

// ─── IMPORTS (FIX-A: no duplicate initializeApp) ─────────────────────────────
import { db, auth, messaging, getToken, onMessage } from "./firebase.js";

import {
  collection, addDoc, onSnapshot,
  doc, setDoc, updateDoc, increment, deleteDoc,
  query, orderBy, getDocs, getDoc, where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const VAPID_KEY = "BDTkDBt3daAUhVvkAHvKuEJn1DI6MwZh5nYzMFu8ym7UQGKNaAbzCtH-RE6DiHCv3k22w_mfl7u8jY-KqN5aNpc";

// ─── OFFLINE QUEUE ─────────────────────────────────────────────────────────
const OFFLINE_Q_KEY = 'uw_offline_queue';
function _queueOfflineXP(mins, xp) {
  try {
    const q = JSON.parse(localStorage.getItem(OFFLINE_Q_KEY) || '{"mins":0,"xp":0}');
    q.mins = (q.mins || 0) + mins;
    q.xp   = (q.xp   || 0) + xp;
    localStorage.setItem(OFFLINE_Q_KEY, JSON.stringify(q));
  } catch(e) {}
}
async function _flushOfflineQueue(uid, userDocRefFn) {
  if (!uid || !navigator.onLine) return;
  try {
    const raw = localStorage.getItem(OFFLINE_Q_KEY);
    if (!raw) return;
    const q = JSON.parse(raw);
    if (!q.mins && !q.xp) return;
    localStorage.removeItem(OFFLINE_Q_KEY);
    if (q.mins > 0) {
      const { updateDoc: ud, doc: d, increment: inc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      await ud(userDocRefFn(), { focusTime: inc(q.mins), lastActive: Date.now() });
    }
    if (q.xp > 0) {
      const { doc: d2, setDoc: sd, increment: inc2 } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      await sd(d2(db, 'leaderboard', uid), {
        weeklyTimerXP: inc2(q.xp),
        timerXP:       inc2(q.xp)
      }, { merge: true });
    }
  } catch(e) {}
}

// UID for both users/ and leaderboard/ collections
let _timerUid = null;

/**
 * Sync timer progress to leaderboard/{uid}.
 * timerXP    = cumulative, NEVER resets (for mainleaderboard.html)
 * weeklyTimerXP = resets each week (for leaderboard.html weekly view)
 * focusTime  = cumulative minutes
 */
async function _syncTimerLeaderboard(focusMinsDelta, xpDelta) {
  if (!_timerUid) return;
  // If offline, queue locally
  if (!navigator.onLine) {
    _queueOfflineXP(focusMinsDelta, xpDelta);
    return;
  }
  try {
    const update = { updatedAt: serverTimestamp() };
    if (focusMinsDelta > 0) {
      update.focusTime       = increment(focusMinsDelta);
      update.weeklyFocusTime = increment(focusMinsDelta);
    }
    if (xpDelta > 0) {
      update.timerXP       = increment(xpDelta);
      update.weeklyTimerXP = increment(xpDelta);
    }
    await setDoc(doc(db, "leaderboard", _timerUid), update, { merge: true });
  } catch(e) {
    // Network error — queue it
    _queueOfflineXP(focusMinsDelta, xpDelta);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/firebase-messaging-sw.js")
    .then(r => console.log("[SW] ready:", r.scope))
    .catch(e => console.warn("[SW]", e));
}

const params = new URLSearchParams(location.search);
const roomId  = params.get("room") || "default";

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // ── State ───────────────────────────────────────────────────────────────────
  let currentUser       = "";   // displayName — for display & messages only
  let timerInterval;
  let seconds           = 0;
  let isRunning         = false;
  let mode              = "stopwatch";
  let initialSeconds    = 0;
  let savedMinutes      = 0;
  let savedXP           = 0;  // FIX-XP: track XP already awarded during session
  let chattingWith      = "";
  let lastWaveTime      = 0;
  let lastMsgTime       = Date.now();
  let listenersAttached = false;
  let panelMode         = "room"; // "global" | "room"

  // ── Timer state persistence ─────────────────────────────────────────────────
  const TIMER_KEY = "uw_timer_state";
  function saveTimerState() {
    if (!isRunning) return;
    try {
      const elapsedMs = mode === 'countdown'
        ? (initialSeconds - seconds) * 1000
        : seconds * 1000;
      sessionStorage.setItem(TIMER_KEY, JSON.stringify({
        seconds, mode, initialSeconds, savedMinutes, savedXP,
        startedAt: Date.now() - elapsedMs
      }));
    } catch(e) {}
  }
  function restoreTimerState() {
    try {
      const raw = sessionStorage.getItem(TIMER_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || !s.startedAt) return;
      const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
      mode           = s.mode || "stopwatch";
      initialSeconds = s.initialSeconds || 0;
      savedMinutes   = s.savedMinutes   || 0;
      savedXP        = s.savedXP        || 0;
      if (mode === "countdown") {
        seconds = Math.max(0, initialSeconds - elapsed);
      } else {
        seconds = elapsed;
      }
      updateDisplay();
      const lbl = document.getElementById("modeLabel");
      if (lbl) {
        if (mode === "stopwatch") lbl.textContent = "STOPWATCH MODE";
        else {
          const h = Math.floor(initialSeconds/3600), m = Math.floor((initialSeconds%3600)/60);
          lbl.textContent = (h>0 ? h+"h " : "") + m + "m COUNTDOWN";
        }
      }
      if (mode === "countdown") {
        document.querySelectorAll(".preset-btn").forEach(b=>b.classList.remove("active"));
        document.getElementById("btnCustom")?.classList.add("active");
      }
    } catch(e) {}
  }
  function clearTimerState() {
    try { sessionStorage.removeItem(TIMER_KEY); } catch(e) {}
  }
  // NOTE: restoreTimerState() is intentionally NOT called anymore — the app no
  // longer auto-resumes a running timer after reload/navigation (see the
  // FIX-AUTORESUME block inside onAuthStateChanged below, which reads the
  // saved session directly and silently credits any leftover progress).
  // restoreTimerState();

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const qs = id => document.getElementById(id);

  function updateDisplay() {
    const d = qs("display");
    if (!d) return;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    d.innerText = `${m < 10 ? "0"+m : m}:${s < 10 ? "0"+s : s}`;
  }

  function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  function getWeekNumber() {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    const ys = new Date(d.getFullYear(),0,1);
    return `${d.getFullYear()}-W${Math.ceil((((d-ys)/86400000)+1)/7)}`;
  }

  function showToast(msg) {
    const el = document.createElement("div");
    el.className = "toast-msg";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function formatTime(totalMin) {
    const h = Math.floor((totalMin||0)/60);
    const m = (totalMin||0)%60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ── Timer mode bridge ─────────────────────────────────────────────────────
  window._setTimerMode = (m, initSecs) => {
    // If timer running, stop it cleanly before mode change
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
      clearTimerState();
      savedMinutes = 0;
      savedXP = 0;
      if (startBtn) startBtn.style.display = "block";
      if (stopBtn)  stopBtn.style.display  = "none";
      if (ring)     ring.classList.remove("active");
      if (window._stopRain) window._stopRain();
      if (window._uwPresence?.setFocusing) window._uwPresence.setFocusing(false);
    }
    mode = m;
    initialSeconds = (m === "countdown") ? initSecs : 0;
    seconds        = initialSeconds;
    updateDisplay();
  };

  // ── DOM Refs ─────────────────────────────────────────────────────────────────
  const loginOverlay  = qs("loginOverlay");
  const display       = qs("display");
  const ring          = qs("ring");
  const modeLabel     = qs("modeLabel");
  const startBtn      = qs("startBtn");
  const stopBtn       = qs("stopBtn");
  const menuToggle    = qs("menuToggle");
  const navMenu       = qs("navMenu");
  const socialSheet   = qs("socialSheet");
  const backdrop      = qs("backdrop");
  const userList      = qs("userList");
  const statusCard    = qs("statusCard");

  const joinCreateRow  = qs("joinCreateRow");
  const inRoomRow      = qs("inRoomRow");
  const roomBadge      = qs("roomBadge");
  const exitRoomBtn    = qs("exitRoomBtn");
  const exitSessionBtn = qs("exitSessionBtn");
  const globalBox      = qs("globalBox");
  const openPanelBtn   = qs("openPanelBtn");

  // Load saved user — for display purposes only
  const savedName = localStorage.getItem("userName");
  if (savedName) {
    currentUser = savedName;
    if (loginOverlay) loginOverlay.style.display = "none";
  }

  if (statusCard) statusCard.addEventListener("click", () => { window.location.href="leaderboard.html"; });

  // ── Room UI initialiser ───────────────────────────────────────────────────────
  function initRoomUI() {
    const inRoom = roomId !== "default";
    if (joinCreateRow) joinCreateRow.style.display = inRoom ? "none" : "flex";
    if (inRoomRow)     inRoomRow.style.display     = inRoom ? "flex" : "none";
    if (globalBox)    globalBox.style.display    = inRoom ? "none" : "block";
    if (openPanelBtn) openPanelBtn.style.display = inRoom ? "block" : "none";
    if (inRoom && roomBadge) {
      // Show roomId initially, then update with actual name from Firestore
      const fallbackLabel = roomId.replace(/_[a-z0-9]{3,5}$/i, "");
      roomBadge.innerHTML = '<i class="fa-solid fa-users-line" style="font-size:12px;margin-right:6px;flex-shrink:0;"></i><span id="roomBadgeText">' + fallbackLabel + '</span>';
      // Fetch actual room name (preserving emojis)
      import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ doc: d2, getDoc: gd }) => {
        gd(d2(db, "rooms", roomId)).then(snap => {
          if (snap.exists()) {
            const actualName = snap.data().name || fallbackLabel;
            const badgeText = document.getElementById("roomBadgeText");
            if (badgeText) badgeText.textContent = actualName;
          }
        }).catch(() => {});
      }).catch(() => {});
    }
  }
  initRoomUI();

  // FIX-DUP: All Firestore user doc operations now use _timerUid (Firebase UID)
  // Helper so we always use the UID-based doc path
  function userDocRef() {
    if (_timerUid) return doc(db, "users", _timerUid);
    // Fallback to displayName only if UID not yet set (shouldn't happen in normal flow)
    return doc(db, "users", currentUser);
  }

  window.exitRoom = async () => {
    if (_timerUid) {
      try { await updateDoc(userDocRef(), {room:"default"}); } catch(e) {}
    }
    window.location.href = location.pathname;
  };
  window.exitToGlobal = window.exitRoom;

  if (exitRoomBtn)    exitRoomBtn.addEventListener("click",    window.exitRoom);
  if (exitSessionBtn) exitSessionBtn.addEventListener("click", window.exitRoom);

  // ── Global Panel ──────────────────────────────────────────────────────────────
  window._openGlobalSheet = () => {
    panelMode = "global";
    const title = qs("panelTitle");
    const lbT   = qs("lbTitle");
    const invWA = qs("inviteWhatsapp");
    const invCP = qs("copyInvite");
    if (title) title.innerHTML = '<i class="fa-solid fa-globe" style="color:var(--green);margin-right:6px;font-size:13px;"></i>Global Room';
    if (lbT)   lbT.innerHTML   = '<i class="fa-solid fa-trophy" style="color:var(--orange);margin-right:5px;font-size:10px;"></i>Global Leaderboard';
    if (invWA) invWA.style.display = "none";
    if (invCP) invCP.style.display = "none";
    if (socialSheet) socialSheet.classList.add("open");
    if (backdrop)    backdrop.style.display = "block";
    renderPanelUsers();
  };

  window._openRoomSheet = () => {
    panelMode = "room";
    const title = qs("panelTitle");
    const lbT   = qs("lbTitle");
    const invWA = qs("inviteWhatsapp");
    const invCP = qs("copyInvite");
    if (title) title.innerHTML = '<i class="fa-solid fa-users" style="color:var(--accent);margin-right:6px;font-size:13px;"></i>Live Members';
    if (lbT)   lbT.innerHTML   = '<i class="fa-solid fa-ranking-star" style="color:var(--orange);margin-right:5px;font-size:10px;"></i>Room Leaderboard';
    if (invWA) invWA.style.display = "";
    if (invCP) invCP.style.display = "";
    if (socialSheet) socialSheet.classList.add("open");
    if (backdrop)    backdrop.style.display = "block";
    renderPanelUsers();
  };

  let _msgCache = [];

  function renderChatForPair(withUser) {
    const chatArea = qs("chatMessages");
    if (!chatArea) return;
    const msgs = _msgCache.filter(msg =>
      (msg.from===currentUser && msg.to===withUser) ||
      (msg.from===withUser    && msg.to===currentUser)
    );
    if (!msgs.length) {
      chatArea.innerHTML = `<div style="text-align:center;opacity:.35;font-size:12px;padding:20px">No messages yet. Say hi! 👋</div>`;
      return;
    }
    chatArea.innerHTML = "";
    msgs.forEach(msg => {
      const seen = msg.status==="seen";
      const del  = msg.status==="delivered";
      const tick = seen
        ? '<span style="color:var(--blue);font-size:10px;margin-left:5px">✔✔</span>'
        : del
          ? '<span style="opacity:.5;font-size:10px;margin-left:5px">✔✔</span>'
          : '<span style="opacity:.4;font-size:10px;margin-left:5px">✔</span>';
      const bubble = document.createElement("div");
      if (msg.from===currentUser) {
        bubble.className = "msg-me";
        bubble.innerHTML = `${msg.text}${tick}`;
      } else {
        bubble.className = "msg-other";
        bubble.innerHTML = `<span style="font-size:10px;opacity:.55">${msg.from}</span><br>${msg.text}`;
      }
      chatArea.appendChild(bubble);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  let _allUsersCache = [];

  function renderPanelUsers() {
    if (!userList) return;
    userList.innerHTML = "";

    const ONLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes — if lastActive older, user is stale
    const users = panelMode === "global"
      ? _allUsersCache.filter(u => {
          const s = (u.status||"").toLowerCase();
          const active = u.lastActive && (Date.now() - u.lastActive) < ONLINE_THRESHOLD;
          // FIX-ONLINE: Only show if actually active recently (prevents stale "online" entries)
          return active && (s === "online" || s.includes("focus"));
        })
      : _allUsersCache.filter(u => u.room === roomId);

    if (!users.length) {
      userList.innerHTML = `<div style="text-align:center;opacity:.4;font-size:13px;padding:24px">
        ${panelMode==="global"?"No one online right now.":"No members yet — share the invite link 🔗"}</div>`;
      return;
    }

    users.forEach(u => {
      const s      = (u.status||"").toLowerCase();
      const isMe   = u.id === _timerUid; // FIX-DUP: compare by UID
      const dotCls = s.includes("focus") ? "s-focus" : s === "online" ? "s-online" : "s-offline";
      const h = Math.floor((u.focusTime||0)/60), m = (u.focusTime||0)%60;
      const timeStr = h>0 ? `${h}h ${m}m` : `${m}m`;
      const xp = _lbXpCache[u.id] || u.weeklyXP || 0;
      const displayName = u.name||u.displayName||"User";

      const card = document.createElement("div");
      card.className = "member-card";
      card.innerHTML = `
        <div class="member-av">${displayName[0].toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">
            ${displayName}${isMe?'&nbsp;<span style="color:var(--accent);font-size:10px">(You)</span>':''}
          </div>
          <div class="member-stat">
            <span class="sdot ${dotCls}"></span>
            <span>${u.status}</span>
            <span style="margin-left:4px;color:var(--accent)">· ${timeStr}</span>
            ${panelMode==="global" ? `<span style="margin-left:4px;color:gold">· ⭐${xp}</span>` : ""}
          </div>
        </div>
        ${!isMe && panelMode==="room" ? `
        <div class="member-acts">
          <button class="mact wave" data-wave-target="${u.id}" data-wave-name="${displayName.replace(/"/g,'&quot;')}">👋</button>
          <button class="mact chat" data-chat-target="${displayName.replace(/"/g,'&quot;')}">💬</button>
        </div>` : ""}`;

      // Attach wave/chat listeners safely (no inline onclick)
      if (!isMe && panelMode === "room") {
        const waveBtn = card.querySelector('.mact.wave');
        const chatBtn = card.querySelector('.mact.chat');
        if (waveBtn) {
          waveBtn.addEventListener('click', function() {
            window.wave(u.id, displayName, this);
          });
        }
        if (chatBtn) {
          chatBtn.addEventListener('click', function() {
            window.openChat(displayName);
          });
        }
      }

      userList.appendChild(card);
    });
  }

  // Cache for leaderboard XP data from 'leaderboard' collection
  let _lbXpCache = {};

  // Load XP data from leaderboard collection and cache it
  async function loadLbXpCache() {
    try {
      const { getDocs: gd, collection: col } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const snap = await gd(col(db, "leaderboard"));
      snap.docs.forEach(d => { _lbXpCache[d.id] = d.data().weeklyTimerXP || 0; });
    } catch(e) {}
  }
  loadLbXpCache();

  // Refresh LB cache after XP is synced so panel shows updated values
  async function _syncTimerLeaderboardAndRefresh(focusMinsDelta, xpDelta) {
    await _syncTimerLeaderboard(focusMinsDelta, xpDelta);
    // Update local cache immediately so UI reflects new XP without waiting for Firestore snapshot
    if (xpDelta > 0 && _timerUid) {
      _lbXpCache[_timerUid] = (_lbXpCache[_timerUid] || 0) + xpDelta;
      if (socialSheet?.classList.contains("open")) {
        renderPanelLeaderboard();
        renderPanelUsers();
      }
    }
  }

  function renderPanelLeaderboard() {
    const board = qs("leaderboard");
    if (!board) return;

    const source = panelMode === "room"
      ? _allUsersCache.filter(u => u.room === roomId)
      : _allUsersCache;

    const sorted = [...source]
      .sort((a,b) => {
        // Sort by XP from leaderboard cache if available, else by focusTime
        const bXP = _lbXpCache[b.id] || 0;
        const aXP = _lbXpCache[a.id] || 0;
        if (bXP !== aXP) return bXP - aXP;
        return (b.focusTime||0) - (a.focusTime||0);
      })
      .slice(0,10);
    board.innerHTML = "";
    if (!sorted.length) {
      board.innerHTML = `<div style="text-align:center;opacity:.35;font-size:12px;padding:12px">No data yet</div>`;
      return;
    }
    sorted.forEach((u,i) => {
      const h = Math.floor((u.focusTime||0)/60), m = (u.focusTime||0)%60;
      const timeStr = h>0 ? `${h}h ${m}m` : `${m}m`;
      const xp = _lbXpCache[u.id] || 0;
      const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
      const isMe  = u.id===_timerUid;
      const displayName = u.name||u.displayName||"User";
      const el = document.createElement("div");
      if (isMe) el.style.borderColor="rgba(91,91,246,.35)";
      const xpStr = xp > 0 ? ` <span style="color:#F59E0B;font-size:11px;">⭐${xp} XP</span>` : "";
      el.innerHTML = `<span>${medal} ${displayName}${isMe?" (You)":""}</span><span>${timeStr}${xpStr}</span>`;
      board.appendChild(el);
    });
  }

  // ─── Firebase Auth ───────────────────────────────────────────────────────────
  onAuthStateChanged(auth, async user => {
    if (!user) {
      if (loginOverlay) loginOverlay.style.display = "flex";
      return;
    }

    currentUser = user.displayName || user.email || "";
    _timerUid   = user.uid;   // ← UID is the Firestore doc key
    localStorage.setItem("userName",  currentUser);
    localStorage.setItem("uwUid",     user.uid);
    localStorage.setItem("userEmail", user.email || "");
    if (loginOverlay) loginOverlay.style.display = "none";

    const today = getTodayDate(), week = getWeekNumber();

    // FIX-DUP: ALL user doc reads/writes now use users/{uid}
    const uRef  = doc(db, "users", _timerUid);
    const snap  = await getDoc(uRef);

    if (snap.exists() && snap.data().lastActiveDate !== today) {
      const prevFocus = snap.data().focusTime || 0;
      await setDoc(uRef,{
        focusTime: 0,
        totalFocusTime: increment(prevFocus), // carry yesterday's minutes into lifetime total before reset
        lastActiveDate: today,
        lastActive: Date.now()
      },{merge:true});
    }
    await setDoc(uRef,{
      name:        currentUser,
      displayName: currentUser,
      email:       user.email,
      uid:         user.uid,
      status:      "Online",
      room:        roomId,
      lastActive:  Date.now(),
      lastActiveDate: today,
      lastActiveWeek: week,
      currentPage: "timer.html"
    },{merge:true});

    // Reset weeklyTimerXP in leaderboard doc if it's a new week
    try {
      const lbSnap = await getDoc(doc(db,"leaderboard",_timerUid));
      if (lbSnap.exists() && lbSnap.data().lastActiveWeek && lbSnap.data().lastActiveWeek !== week) {
        await setDoc(doc(db,"leaderboard",_timerUid),{
          weeklyTimerXP:  0,
          weeklyFocusTime: 0,  // reset weekly focus time too
          lastActiveWeek: week
        },{merge:true});
      } else if (!lbSnap.exists() || !lbSnap.data().lastActiveWeek) {
        await setDoc(doc(db,"leaderboard",_timerUid),{
          name:           currentUser,
          lastActiveWeek: week
        },{merge:true});
      }
    } catch(e) {}

    // FCM after auth
    if (Notification.permission==="default") await Notification.requestPermission().catch(()=>{});
    if (Notification.permission==="granted") {
      try {
        const token = await getToken(messaging,{vapidKey:VAPID_KEY});
        if (token) await updateDoc(uRef,{fcmToken:token});
      } catch(e){ console.warn("[FCM]",e); }
    }

    if (!listenersAttached){ listenersAttached=true; attachListeners(); }

    // Flush any offline-queued XP/time
    _flushOfflineQueue(_timerUid, userDocRef);

    // Also flush on network reconnect
    window.addEventListener('online', () => {
      _flushOfflineQueue(_timerUid, userDocRef);
    }, { once: false });

    // FIX-AUTORESUME: Do NOT auto-start the timer on reload/navigation.
    // Instead, silently finalize any progress from a session that was
    // interrupted (tab closed/reloaded while running) and leave the timer
    // fully stopped — the user must press Start themselves. This also
    // eliminates the old bug where the status field got stuck on "Online"
    // even though the timer had silently resumed in the background.
    const prevState = sessionStorage.getItem(TIMER_KEY);
    if (prevState) {
      try {
        const s = JSON.parse(prevState);
        if (s && s.startedAt) {
          const elapsedReal   = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
          const wasCountdown  = s.mode === "countdown";
          const focusElapsed  = wasCountdown
            ? Math.min(elapsedReal, s.initialSeconds || 0)
            : elapsedReal;
          const totalMins     = Math.floor(focusElapsed / 60);
          const totalXP       = Math.floor(focusElapsed / 120);
          const unsavedMins   = Math.max(0, totalMins - (s.savedMinutes || 0));
          const unsavedXP     = Math.max(0, totalXP   - (s.savedXP   || 0));
          if (unsavedMins > 0) {
            await updateDoc(uRef, { focusTime: increment(unsavedMins), lastActive: Date.now() }).catch(()=>{});
          }
          if (unsavedXP > 0) {
            await updateDoc(uRef, { weeklyXP: increment(unsavedXP) }).catch(()=>{});
          }
          if (unsavedMins > 0 || unsavedXP > 0) {
            await _syncTimerLeaderboard(unsavedMins, unsavedXP).catch(()=>{});
          }
        }
      } catch(e) { console.warn("[Timer] resume-credit failed:", e); }
      clearTimerState();
      // Make sure UI + status reflect a fully stopped timer
      isRunning = false;
      seconds = 0; savedMinutes = 0; savedXP = 0; sessionStartAt = 0;
      updateDisplay();
      if (startBtn) startBtn.style.display = "block";
      if (stopBtn)  stopBtn.style.display  = "none";
      if (ring)     ring.classList.remove("active");
    }
  });

  // ─── Room Create / Join ──────────────────────────────────────────────────────
  const createModal   = qs("createModal");
  const createRoomBtn = qs("createRoomBtn");
  const confirmCreate = qs("confirmCreate");

  if (createRoomBtn && createModal) {
    createRoomBtn.onclick = () => { createModal.style.display="flex"; };
  }
  if (confirmCreate) {
    confirmCreate.onclick = async () => {
      const name = (qs("roomName")?.value||"").trim();
      if (!name){ showToast("Enter room name"); return; }
      const password = (qs("roomPassword")?.value||"").trim(); // optional
      
      // ── Check if room with same name already exists ──
      const origText = confirmCreate.textContent;
      confirmCreate.disabled = true;
      confirmCreate.textContent = "Checking…";
      try {
        const existingQ = query(collection(db, "rooms"), where("name", "==", name));
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          showToast(`⚠️ Room "${name}" already exists! Try a different name.`);
          confirmCreate.disabled = false;
          confirmCreate.textContent = origText;
          return;
        }
      } catch(e) { /* continue if check fails */ }
      
      // FIX-ROOM: Strip special chars so room ID never breaks URL parsing
      const safeName = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "room";
      const newId = safeName + "_" + Math.random().toString(36).slice(2,6);
      await setDoc(doc(db,"rooms",newId),{
        name,
        password: password || "",   // empty = public room
        createdBy: currentUser,
        createdAt: Date.now(),
        totalJoined: 1              // creator counts as first joined
      });
      await updateDoc(userDocRef(),{room:newId});
      // Save to recent rooms in localStorage
      try {
        let recent = JSON.parse(localStorage.getItem("uw_recent_rooms") || "[]");
        recent = [newId, ...recent.filter(r => r !== newId)].slice(0, 10);
        localStorage.setItem("uw_recent_rooms", JSON.stringify(recent));
      } catch(e) {}
      // Creator ko phir kabhi password na maange — mark as accessed
      try {
        let accessed = JSON.parse(localStorage.getItem('uw_accessed_rooms') || '[]');
        if (!accessed.includes(newId)) { accessed.push(newId); localStorage.setItem('uw_accessed_rooms', JSON.stringify(accessed)); }
      } catch(e) {}
      location.href = location.pathname+"?room="+encodeURIComponent(newId);
    };
  }

  const joinModal   = qs("joinModal");
  const joinRoomBtn = qs("joinRoomBtn");
  const confirmJoin = qs("confirmJoin");

  if (joinRoomBtn && joinModal) {
    joinRoomBtn.onclick = () => {
      qs("joinError").style.display="none";
      joinModal.style.display="flex";
    };
  }
  if (confirmJoin) {
    confirmJoin.onclick = async () => {
      const id = (qs("joinRoomInput")?.value||"").trim();
      if (!id){ showToast("Enter Room ID"); return; }
      const snap = await getDoc(doc(db,"rooms",id));
      if (!snap.exists()){
        qs("joinError").style.display="block";
        return;
      }
      // Only increment totalJoined if not previously accessed
      let accessed2 = [];
      try { accessed2 = JSON.parse(localStorage.getItem('uw_accessed_rooms') || '[]'); } catch(e) {}
      const isFirstJoin2 = !accessed2.includes(id);
      if (isFirstJoin2) {
        try { await updateDoc(doc(db,"rooms",id),{totalJoined:increment(1)}); } catch(e){}
      }
      await updateDoc(userDocRef(),{room:id});
      // Save to recent + accessed rooms
      try {
        let recent = JSON.parse(localStorage.getItem("uw_recent_rooms") || "[]");
        recent = [id, ...recent.filter(r => r !== id)].slice(0, 10);
        localStorage.setItem("uw_recent_rooms", JSON.stringify(recent));
        if (!accessed2.includes(id)) { accessed2.push(id); localStorage.setItem('uw_accessed_rooms', JSON.stringify(accessed2)); }
      } catch(e) {}
      location.href = location.pathname+"?room="+id;
    };
  }

  // ─── Timer Logic ─────────────────────────────────────────────────────────────
  // FIX-ACCURACY: sessionStartAt is the real wall-clock timestamp the current
  // run began. Every tick recomputes `seconds` (and therefore minutes/XP) from
  // real elapsed time instead of a plain ++ counter, so background throttling
  // (screen off, tab minimized) can never cause a missed minute/XP boundary —
  // the very next tick that DOES fire will catch up correctly.
  let sessionStartAt = 0;

  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      if (!_timerUid){ showToast("Login first"); return; }

      // FIX-RACE: flip isRunning synchronously, before any await, so a
      // double-fire (e.g. two rapid clicks, or two auth callbacks) can never
      // start two overlapping interval loops.
      if (isRunning) return;
      isRunning = true;

      const week  = getWeekNumber();
      const uRef  = userDocRef();
      const snap  = await getDoc(uRef);
      if (snap.exists() && snap.data().lastActiveWeek !== week) {
        await updateDoc(uRef,{weeklyXP:0,lastActiveWeek:week});
      }
      await updateDoc(uRef,{status:"Focusing 👋", lastActive:Date.now()});

      savedMinutes = 0;
      savedXP      = 0;  // FIX-XP: reset XP tracker on new session
      sessionStartAt = Date.now() - seconds * 1000; // preserve any custom countdown offset
      startBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display  = "block";
      if (ring)    ring.classList.add("active");
      if (window._startRain) window._startRain();
      if (window._uwPresence?.setFocusing) window._uwPresence.setFocusing(true);

      timerInterval = setInterval(async () => {
        if (!isRunning) return;
        const elapsedReal = Math.floor((Date.now() - sessionStartAt) / 1000);

        if (mode === "countdown") {
          seconds = Math.max(0, initialSeconds - elapsedReal);
          updateDisplay();
          saveTimerState();
          if (seconds <= 0) { finishTimer(); return; }
        } else {
          seconds = elapsedReal;
          updateDisplay();
          saveTimerState();
        }

        // FIX-ACCURACY: derive minutes/XP owed from real elapsed focus time
        // (not from the tick counter) and award only the delta since last
        // award. This self-corrects even if several ticks were skipped.
        const focusElapsed = mode === "countdown" ? (initialSeconds - seconds) : seconds;
        const dueMinutes = Math.floor(focusElapsed / 60);
        const dueXP      = Math.floor(focusElapsed / 120);

        if (dueMinutes > savedMinutes) {
          const deltaMin = dueMinutes - savedMinutes;
          savedMinutes = dueMinutes;
          await updateDoc(userDocRef(),{
            status:"Focusing 👋", focusTime:increment(deltaMin), lastActive:Date.now()
          });
          await _syncTimerLeaderboard(deltaMin, 0);
        }
        if (dueXP > savedXP) {
          const deltaXP = dueXP - savedXP;
          savedXP = dueXP;
          await updateDoc(userDocRef(),{weeklyXP:increment(deltaXP)});
          await _syncTimerLeaderboardAndRefresh(0, deltaXP);
        }
      }, 1000);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", async () => {
      isRunning = false;
      clearInterval(timerInterval);
      const elapsed     = mode === "countdown" ? (initialSeconds - seconds) : seconds;
      const totalMins   = Math.floor(elapsed / 60);
      const unsavedMins = totalMins - savedMinutes;
      // FIX-XP: Calculate exact unsaved XP = total earned XP - already saved XP
      const totalXPEarned = Math.floor(elapsed / 120);
      const unsavedXP     = Math.max(0, totalXPEarned - savedXP);
      if (unsavedMins > 0) {
        await updateDoc(userDocRef(),{
          status:"Online", focusTime:increment(unsavedMins), lastActive:Date.now()
        });
        if (unsavedXP > 0) {
          await updateDoc(userDocRef(),{weeklyXP:increment(unsavedXP)});
        }
        await _syncTimerLeaderboard(unsavedMins, unsavedXP);
      } else {
        await updateDoc(userDocRef(),{status:"Online", lastActive:Date.now()});
      }
      savedMinutes = 0;
      savedXP      = 0;
      sessionStartAt = 0;
      clearTimerState();
      if (startBtn) startBtn.style.display = "block";
      stopBtn.style.display = "none";
      if (ring) ring.classList.remove("active");
      if (window._stopRain)  window._stopRain();
      if (window._uwPresence?.setFocusing) window._uwPresence.setFocusing(false);
      seconds = mode === "countdown" ? initialSeconds : 0;
      if (mode !== "countdown" && display) display.innerText = "00:00";
      updateDisplay();
    });
  }

  function finishTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    const totalMins   = Math.floor((initialSeconds - seconds) / 60);
    const unsavedMins = totalMins - savedMinutes;
    if (unsavedMins > 0 && _timerUid) {
      updateDoc(userDocRef(),{
        status:"Online", focusTime:increment(unsavedMins), lastActive:Date.now()
      }).catch(()=>{});
      const totalXPEarned = Math.floor((initialSeconds - seconds) / 120);
      const unsavedXP = Math.max(0, totalXPEarned - savedXP);
      if (unsavedXP > 0) {
        updateDoc(userDocRef(),{weeklyXP:increment(unsavedXP)}).catch(()=>{});
      }
      _syncTimerLeaderboard(unsavedMins, unsavedXP).catch(()=>{});
    } else if (_timerUid) {
      updateDoc(userDocRef(),{status:"Online", lastActive:Date.now()}).catch(()=>{});
    }
    savedMinutes = 0;
    savedXP      = 0;  // reset so next session starts clean
    sessionStartAt = 0;
    clearTimerState();
    if (startBtn) startBtn.style.display = "block";
    if (stopBtn)  stopBtn.style.display  = "none";
    if (ring)     ring.classList.remove("active");
    if (window._stopRain)  window._stopRain();
    if (window._uwPresence?.setFocusing) window._uwPresence.setFocusing(false);
    seconds = initialSeconds;
    updateDisplay();
    if (Notification.permission === "granted") {
      new Notification("Session Complete! 🎉",{body:"Great focus session!",icon:"/icon-192.png"});
    }
  }

  // ─── Panel & Menu ────────────────────────────────────────────────────────────
  function closePanel() {
    if (socialSheet) socialSheet.classList.remove("open");
    if (backdrop)    backdrop.style.display="none";
  }

  const closePanelBtn = qs("closePanelBtn");
  if (closePanelBtn) closePanelBtn.addEventListener("click", closePanel);
  if (backdrop)      backdrop.addEventListener("click", closePanel);

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => navMenu.classList.toggle("active"));
    document.addEventListener("click", e => {
      if (!menuToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navMenu.classList.remove("active");
      }
    });
  }

  const inviteWhatsapp = qs("inviteWhatsapp");
  const copyInvite     = qs("copyInvite");
  // FIX-ROOM: encodeURIComponent so room ID with underscores doesn't get truncated by WhatsApp/chat apps
  const inviteLink     = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;
  const inviteMsg      = `📚 Focus Study Room\n\nJoin here:\n${inviteLink}`;

  if (inviteWhatsapp) {
    inviteWhatsapp.onclick = () => window.open("https://wa.me/?text="+encodeURIComponent(inviteMsg),"_blank");
  }
  if (copyInvite) {
    copyInvite.onclick = async () => {
      try { await navigator.clipboard.writeText(inviteLink); }
      catch(e) {
        const ta=document.createElement("textarea"); ta.value=inviteLink;
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      showToast("✅ Invite link copied!");
    };
  }

  // ─── Visibility / Unload ─────────────────────────────────────────────────────
  window.addEventListener("visibilitychange", async () => {
    if (!_timerUid) return;
    await updateDoc(userDocRef(),{
      status:    document.visibilityState === "hidden" ? "Offline" : "Online",
      lastActive: Date.now()
    }).catch(()=>{});
  });
  window.addEventListener("beforeunload", () => {
    if (_timerUid) updateDoc(userDocRef(),{
      status:"Offline", lastActive:Date.now()
    }).catch(()=>{});
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────
  window.logoutUser = async () => {
    try {
      const { doLogout } = await import("./auth-helper.js");
      await doLogout(auth, "login.html");
    } catch(e) {
      await signOut(auth).catch(()=>{});
      ["userName","userEmail","userUID","uwUid","uw_xp","uw_streak",
       "uw_last_streak","uw_todo_daily_bonus","uw_offline_queue",
       "uw_recent_rooms","uw_accessed_rooms","dailyXP","dailyXPDate",
       "returningUser","seenWelcome","appRated","goal","customUserName"
      ].forEach(k => localStorage.removeItem(k));
      window.location.replace("login.html");
    }
  };

  // ─── FCM foreground ──────────────────────────────────────────────────────────
  onMessage(messaging, payload => {
    const {title="Notification",body=""} = payload.notification||{};
    if (Notification.permission==="granted") new Notification(title,{body,icon:"/icon-192.png"});
  });

  // ─── Window-exposed chat helpers ─────────────────────────────────────────────
  // wave(targetUid, targetName, btnEl)
  window.wave = async (targetUid, targetName, btnEl) => {
    const now = Date.now();
    // Debounce — don't wave more than once per 3s per person
    const waveKey = 'waveAt_' + targetUid;
    const lastWave = parseInt(sessionStorage.getItem(waveKey) || '0');
    if (now - lastWave < 3000) return;
    sessionStorage.setItem(waveKey, now);

    // Sender animation on the wave button
    if (btnEl) {
      btnEl.style.animation = 'waveAnim 0.6s ease';
      btnEl.style.borderColor = 'var(--green)';
      btnEl.style.color = 'var(--green)';
      setTimeout(() => {
        btnEl.style.animation = '';
        btnEl.style.borderColor = '';
        btnEl.style.color = '';
      }, 700);
    }

    // Write directly to target UID doc
    try {
      await updateDoc(doc(db, "users", targetUid), {
        waveFrom: currentUser,
        waveTime: Date.now()
      });
    } catch(e) {
      showToast('❌ Could not send wave');
      return;
    }

    showToast('👋 Waved at ' + targetName + '!');
  };

  window.openChat = name => {
    chattingWith = name;
    const box  = qs("chatBox");
    const area = qs("chatMessages");
    const lbl  = qs("chatWithLabel");
    if (box)  { box.style.display="flex"; box.classList.add("open"); }
    if (lbl)  lbl.textContent = "💬 " + name;
    if (area) {
      area.innerHTML = `<div style="text-align:center;opacity:.4;font-size:12px;padding:16px">Loading...</div>`;
      renderChatForPair(name);
    }
  };

  window.closeChat = () => {
    const box = qs("chatBox");
    if (box){ box.style.display="none"; box.classList.remove("open"); }
  };

  window.sendMsg = async () => {
    const input = qs("chatInput");
    const txt   = input?.value?.trim();
    if (!txt||!chattingWith) return;
    await addDoc(collection(db,"messages"),{
      from:currentUser, to:chattingWith,
      text:txt, room:roomId, time:Date.now(), status:"sent"
    });
    if (input) input.value="";
  };

  const chatInput = qs("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter") window.sendMsg(); });
    chatInput.addEventListener("input", async () => {
      if (!chattingWith) return;
      await setDoc(doc(db,"typing",currentUser+"_"+chattingWith),{
        from:currentUser, to:chattingWith, typing:true, time:Date.now()
      }).catch(()=>{});
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRESTORE LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function attachListeners() {

    // ── Users listener ────────────────────────────────────────────────────
    // FIX-DUP: users collection now uid-keyed; deduplicate by doc ID (uid)
    onSnapshot(collection(db,"users"), snapshot => {
      // Build a map keyed by doc ID (uid) — eliminates any duplicates
      const seen = new Map();
      snapshot.docs.forEach(d => { seen.set(d.id, {id:d.id,...d.data()}); });
      _allUsersCache = [...seen.values()];

      const globalUsersEl = qs("globalUsers");
      if (globalUsersEl && roomId === "default") {
        const focusing = _allUsersCache
          .filter(u => (u.status||"").toLowerCase().includes("focus"))
          .sort((a,b)=>(b.focusTime||0)-(a.focusTime||0));

        if (!focusing.length) {
          globalUsersEl.textContent = "No one focusing right now — be the first! 🚀";
        } else {
          const names = focusing.slice(0,3).map(u=>u.name||u.displayName||"User").join(", ");
          const extra = focusing.length > 3 ? ` +${focusing.length-3} more` : "";
          globalUsersEl.textContent = `${focusing.length} focusing now · ${names}${extra}`;
        }
      }

      // Update live members count in room badge button (when in private room)
      if (roomId !== "default") {
        const liveBtn    = qs("liveMembersBtn");
        const liveCount  = qs("liveMembersCount");
        if (liveBtn && liveCount) {
          const roomUsers = _allUsersCache.filter(u => u.room === roomId);
          const liveNum   = roomUsers.filter(u => {
            const s = (u.status||"").toLowerCase();
            const active = u.lastActive && (Date.now() - u.lastActive) < 5*60*1000;
            return active && (s === "online" || s.includes("focus"));
          }).length;
          liveCount.textContent = liveNum;
        }
      }

      if (socialSheet?.classList.contains("open")) {
        renderPanelUsers();
        renderPanelLeaderboard();
      }

      // Wave detection — check by UID with full validity guards
      _allUsersCache.forEach(u => {
        // Must be: for current user, has a non-empty waveFrom, newer than lastWaveTime, not from self
        if (u.id === _timerUid &&
            u.waveFrom && u.waveFrom.trim() !== "" &&
            u.waveFrom !== currentUser &&
            u.waveTime && u.waveTime > lastWaveTime) {
          lastWaveTime = u.waveTime;
          const container = qs("wavePopupContainer") || document.body;
          const pop = document.createElement("div");
          pop.className = "wave-popup";
          pop.textContent = `👋 ${u.waveFrom} waved at you!`;
          container.appendChild(pop);
          setTimeout(()=>{
            pop.remove();
            updateDoc(userDocRef(),{waveFrom:"",waveTime:0}).catch(()=>{});
          }, 3500);
        }
      });
    });

    // ── Chat messages ──────────────────────────────────────────────────────
    onSnapshot(
      query(collection(db,"messages"), where("room","==",roomId), orderBy("time")),
      snap => {
        _msgCache = snap.docs.map(d => ({id:d.id,...d.data()}));
        const chatArea = qs("chatMessages");
        if (chatArea && qs("chatBox")?.classList.contains("open") && chattingWith) {
          renderChatForPair(chattingWith);
        }
        snap.forEach(d => {
          const msg = d.data();
          if (msg.to===currentUser && msg.status==="sent")
            updateDoc(doc(db,"messages",d.id),{status:"delivered"}).catch(()=>{});
          if (msg.to===currentUser && msg.from===chattingWith && qs("chatBox")?.classList.contains("open"))
            updateDoc(doc(db,"messages",d.id),{status:"seen"}).catch(()=>{});
        });
      }
    );

    // ── Incoming message notifications ────────────────────────────────────
    onSnapshot(
      query(collection(db,"messages"), where("room","==",roomId), where("to","==",currentUser), orderBy("time")),
      snap => {
        snap.forEach(d => {
          const msg = d.data();
          if (msg.from===currentUser || msg.time<=lastMsgTime) return;
          lastMsgTime = msg.time;
          const box = qs("chatNotify"), txt = qs("notifyText");
          if (!box||!txt) return;
          txt.textContent = `${msg.from}: ${msg.text}`;
          box.style.display="block";
          setTimeout(()=>{ box.style.display="none"; }, 4000);
        });
      }
    );

    // ── Typing indicator ──────────────────────────────────────────────────
    onSnapshot(collection(db,"typing"), snap => {
      snap.forEach(d => {
        const t = d.data();
        if (t.to!==currentUser || t.from!==chattingWith) return;
        let el = qs("typingIndicator");
        if (!el) {
          el = document.createElement("div");
          el.id = "typingIndicator";
          el.style.cssText = "opacity:.6;font-size:11px;padding:4px 12px;color:var(--blue);";
          el.textContent = t.from+" typing...";
          qs("chatMessages")?.appendChild(el);
        }
        setTimeout(()=>el?.remove(), 2000);
      });
    });

    // ── Stale message cleanup ─────────────────────────────────────────────
    getDocs(query(collection(db,"messages"),where("room","==",roomId)))
      .then(snap => {
        snap.forEach(async d => {
          if (Date.now()-d.data().time > 172800000) await deleteDoc(doc(db,"messages",d.id));
        });
      }).catch(()=>{});
  }

}); // end DOMContentLoaded
