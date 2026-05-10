/* ═══════════════════════════════════════════════════════════════
   FOCUS RUNNER — game-patch.js
   Drop-in patch: adds to game.js without replacing it.

   ADD THIS AT THE BOTTOM OF game.js (paste everything below)
   OR load as a second script AFTER game.js in game.html:
     <script src="game-patch.js"></script>

   Features added:
   ✅ Live session writes to Firestore (gameSessions collection)
   ✅ In-game leaderboard overlay (start + game-over screens)
   ✅ Admin broadcast receiver (shows popup to player)
   ✅ Auto session cleanup on game end / page unload
   ══════════════════════════════════════════════════════════════ */

/* ─── LIVE SESSION SYSTEM ────────────────────────────────────────
   Writes current game state to Firestore every 3 seconds so
   the admin panel can show live player cards in real-time.
   Document path: gameSessions/{sessionId}
   ─────────────────────────────────────────────────────────────── */

let _sessionId   = null;   // Firestore doc ID for this run
let _liveTimer   = null;   // setInterval handle
let _addDoc2     = null;   // imported Firebase functions
let _setDoc2     = null;
let _doc2        = null;
let _deleteDoc2  = null;
let _collection2 = null;
let _db2         = null;
let _onSnapshot2 = null;
let _query2      = null;
let _orderBy2    = null;
let _limit2      = null;
let _serverTS2   = null;
let _fbUser2     = null;

// Bootstrap Firebase for patch (same import, harmless duplicate)
(async () => {
  try {
    const fb = await import('../firebase.js');
    _db2 = fb.db;
    _addDoc2     = fb.addDoc;
    _setDoc2     = fb.setDoc;
    _doc2        = fb.doc;
    _deleteDoc2  = fb.deleteDoc;
    _collection2 = fb.collection;
    _onSnapshot2 = fb.onSnapshot;
    _query2      = fb.query;
    _orderBy2    = fb.orderBy;
    _limit2      = fb.limit;
    _serverTS2   = fb.serverTimestamp;
    fb.onAuthStateChanged(fb.auth, user => {
      _fbUser2 = user;
      if (user) {
        // Start listening for admin broadcasts
        listenAdminBroadcasts(user);
        // Load leaderboard on start screen
        loadLeaderboardData();
      }
    });
  } catch(e) { console.warn('[GamePatch] Firebase unavailable'); }
})();

/* ─── SESSION CREATE ────────────────────────────────────────────── */
async function createLiveSession() {
  if (!_db2 || !_addDoc2 || !_collection2) return;
  const name = _fbUser2?.displayName || Save?.username || 'Runner';
  try {
    const ref = await _addDoc2(_collection2(_db2, 'gameSessions'), {
      name,
      uid:       _fbUser2?.uid || Save?.uid || 'anon',
      score:     0,
      distance:  0,
      combo:     1,
      coins:     0,
      lives:     3,
      speedLevel:1,
      rank:      (typeof getRank === 'function') ? getRank(Save?.totalXP || 0).name : 'Beginner',
      correctQ:  0,
      status:    'playing',
      startedAt: _serverTS2 ? _serverTS2() : new Date().toISOString(),
      updatedAt: _serverTS2 ? _serverTS2() : new Date().toISOString(),
    });
    _sessionId = ref.id;
    _startLivePush();
  } catch(e) { console.warn('[GamePatch] Session create failed:', e); }
}

/* ─── SESSION LIVE PUSH (every 2.5s) ───────────────────────────── */
function _startLivePush() {
  _stopLivePush();
  _liveTimer = setInterval(pushSessionUpdate, 2500);
}

function _stopLivePush() {
  if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; }
}

async function pushSessionUpdate() {
  if (!_sessionId || !_db2 || !_setDoc2 || !_doc2) return;
  if (typeof G === 'undefined') return;
  try {
    await _setDoc2(_doc2(_db2, 'gameSessions', _sessionId), {
      score:      Math.floor(G.score     || 0),
      distance:   Math.floor(G.distance  || 0),
      combo:      G.combo      || 1,
      coins:      G.coins      || 0,
      lives:      G.lives      || 0,
      speedLevel: G.speedLevel || 1,
      correctQ:   G.correctQ   || 0,
      status:     G.running ? 'playing' : 'finished',
      updatedAt:  _serverTS2 ? _serverTS2() : new Date().toISOString(),
    }, { merge: true });
  } catch(e) { /* silent */ }
}

/* ─── SESSION END ───────────────────────────────────────────────── */
async function endLiveSession() {
  _stopLivePush();
  if (!_sessionId || !_db2 || !_setDoc2 || !_doc2) return;
  try {
    await _setDoc2(_doc2(_db2, 'gameSessions', _sessionId), {
      score:      Math.floor(G?.score    || 0),
      distance:   Math.floor(G?.distance || 0),
      combo:      G?.bestCombo || 0,
      coins:      G?.coins     || 0,
      lives:      0,
      status:     'finished',
      updatedAt:  _serverTS2 ? _serverTS2() : new Date().toISOString(),
    }, { merge: true });

    // Auto-delete after 8 minutes so admin panel stays clean
    setTimeout(async () => {
      try {
        if (_sessionId && _db2 && _deleteDoc2 && _doc2)
          await _deleteDoc2(_doc2(_db2, 'gameSessions', _sessionId));
      } catch(e) {}
      _sessionId = null;
    }, 8 * 60 * 1000);
  } catch(e) {}
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (_sessionId && _db2 && _deleteDoc2 && _doc2) {
    // synchronous best-effort
    try { _deleteDoc2(_doc2(_db2, 'gameSessions', _sessionId)); } catch(e){}
  }
  _stopLivePush();
});

/* ─── HOOK INTO GAME FLOW ───────────────────────────────────────── */
// Intercept startGame to create session
const _origStartGame = window.startGame;
window.startGame = function() {
  _origStartGame?.();
  // Small delay so G is reset before we start writing
  setTimeout(createLiveSession, 400);
};

// Intercept restartGame
const _origRestartGame = window.restartGame;
window.restartGame = function() {
  endLiveSession();
  _origRestartGame?.();
  setTimeout(createLiveSession, 400);
};

// Intercept goBack
const _origGoBack = window.goBack;
window.goBack = function() {
  endLiveSession();
  _origGoBack?.();
};

// Patch endGame — add session end call
// We hook via a proxy on the original function
(function patchEndGame() {
  // endGame is not on window, so we wait for it to be called via its own reference
  // We patch by overriding the gameLoop's `if(G.lives<=0)` path instead
  const _origHandleHit = window._handleHit_orig;
  // Instead, we listen to game state changes
  const _origUpdateLives = window.updateLives_orig;

  // Simply: whenever game over screen shows, end session
  const _observer = new MutationObserver(() => {
    const gameOverEl = document.getElementById('gameOverScreen');
    if (gameOverEl && gameOverEl.classList.contains('active')) {
      endLiveSession();
    }
  });
  const gameOverEl = document.getElementById('gameOverScreen');
  if (gameOverEl) _observer.observe(gameOverEl, { attributes: true, attributeFilter: ['class'] });
})();

/* ═══════════════════════════════════════════════════════════════
   IN-GAME LEADERBOARD OVERLAY
   Shows on Start Screen + Game Over Screen
   ══════════════════════════════════════════════════════════════ */

let _lbData  = [];
let _lbUnsub = null;

function loadLeaderboardData() {
  if (!_db2 || !_query2 || !_collection2 || !_orderBy2 || !_limit2 || !_onSnapshot2) return;
  if (_lbUnsub) _lbUnsub();
  try {
    _lbUnsub = _onSnapshot2(
      _query2(_collection2(_db2, 'leaderboard'), _orderBy2('score', 'desc'), _limit2(20)),
      snap => {
        _lbData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderInGameLeaderboard();
        renderGameOverLeaderboard();
      }
    );
  } catch(e) { console.warn('[GamePatch] LB load failed:', e); }
}

function renderInGameLeaderboard() {
  const el = document.getElementById('inGameLeaderboard');
  if (!el || !_lbData.length) return;

  const myUid = _fbUser2?.uid || Save?.uid;
  const RANK_COLORS = {
    Beginner:'#94a3b8', Focused:'#22d3ee', Scholar:'#a78bfa',
    Elite:'#fb923c', Master:'#f472b6', Legend:'#ffd700'
  };
  const RANK_ICONS = { Beginner:'🏅', Focused:'🎯', Scholar:'📚', Elite:'⚡', Master:'🔥', Legend:'👑' };

  // Medal for top 3
  const medals = ['🥇','🥈','🥉'];

  const rows = _lbData.slice(0, 10).map((p, i) => {
    const isMe = p.id === myUid || p.uid === myUid;
    const rankColor = RANK_COLORS[p.rank] || '#94a3b8';
    const medal = i < 3 ? medals[i] : `#${i+1}`;
    return `
      <div class="ilb-row ${isMe ? 'ilb-me' : ''}">
        <span class="ilb-pos">${medal}</span>
        <div class="ilb-avatar">${((p.name||'?')[0]).toUpperCase()}</div>
        <div class="ilb-info">
          <div class="ilb-name">${_esc(p.name||'—')}${isMe ? ' 👈' : ''}</div>
          <div class="ilb-rank" style="color:${rankColor}">${RANK_ICONS[p.rank]||'🏅'} ${p.rank||'Beginner'}</div>
        </div>
        <div class="ilb-score">
          <div class="ilb-score-val">${(p.score||0).toLocaleString()}</div>
          <div class="ilb-score-xp">${p.xp||0} XP</div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="ilb-header">
      <span class="ilb-title">🏆 LEADERBOARD</span>
      <span class="ilb-count">${_lbData.length} players</span>
    </div>
    <div class="ilb-list">${rows}</div>
    <div class="ilb-footer">Updated live · Firebase sync</div>`;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ─── INJECT LEADERBOARD CSS ────────────────────────────────────── */
(function injectLBStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── IN-GAME LEADERBOARD ─────────────────────────────── */
    #inGameLeaderboard {
      width: min(420px, 96vw);
      background: rgba(0,5,28,.92);
      border: 1px solid rgba(0,245,255,.2);
      border-radius: 18px;
      overflow: hidden;
      backdrop-filter: blur(12px);
      box-shadow: 0 0 40px rgba(0,245,255,.08), 0 16px 48px rgba(0,0,0,.5);
      margin: 0 auto 18px;
      z-index: 1;
    }
    .ilb-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 10px;
      border-bottom: 1px solid rgba(0,245,255,.12);
      background: rgba(0,245,255,.05);
    }
    .ilb-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #00f5ff;
      text-shadow: 0 0 10px #00f5ff;
    }
    .ilb-count {
      font-size: 10px;
      color: rgba(0,245,255,.45);
      font-family: 'Orbitron', sans-serif;
    }
    .ilb-list {
      max-height: 260px;
      overflow-y: auto;
      padding: 6px 0;
    }
    .ilb-list::-webkit-scrollbar { width: 3px; }
    .ilb-list::-webkit-scrollbar-thumb { background: rgba(0,245,255,.2); border-radius: 2px; }
    .ilb-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      border-bottom: 1px solid rgba(255,255,255,.04);
      transition: background .15s;
    }
    .ilb-row:last-child { border-bottom: none; }
    .ilb-row:hover { background: rgba(255,255,255,.03); }
    .ilb-row.ilb-me {
      background: rgba(0,245,255,.07);
      border-color: rgba(0,245,255,.18) !important;
    }
    .ilb-pos {
      font-family: 'Orbitron', sans-serif;
      font-size: 12px;
      font-weight: 700;
      min-width: 28px;
      text-align: center;
      color: rgba(255,255,255,.5);
    }
    .ilb-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00f5ff, #bf00ff);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      color: #000;
      flex-shrink: 0;
    }
    .ilb-info { flex: 1; min-width: 0; }
    .ilb-name {
      font-size: 12px;
      font-weight: 700;
      color: #e0eaff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ilb-rank { font-size: 10px; margin-top: 1px; }
    .ilb-score { text-align: right; flex-shrink: 0; }
    .ilb-score-val {
      font-family: 'Orbitron', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #00f5ff;
      text-shadow: 0 0 8px #00f5ff;
    }
    .ilb-score-xp { font-size: 10px; color: rgba(0,255,136,.6); }
    .ilb-footer {
      text-align: center;
      font-size: 9px;
      color: rgba(255,255,255,.2);
      padding: 8px;
      font-family: 'Orbitron', sans-serif;
      letter-spacing: 1px;
      border-top: 1px solid rgba(255,255,255,.04);
    }

    /* ── GAME OVER LEADERBOARD ────────────────────────────── */
    #gameOverLeaderboard {
      width: min(420px, 96vw);
      margin: 14px auto 0;
      z-index: 1;
    }

    /* ── ADMIN BROADCAST POPUP ────────────────────────────── */
    #adminBroadcastPopup {
      position: fixed;
      top: max(70px, env(safe-area-inset-top, 70px));
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      opacity: 0;
      z-index: 9999;
      width: min(380px, 94vw);
      background: rgba(0,5,28,.97);
      border: 1px solid rgba(0,245,255,.3);
      border-radius: 18px;
      padding: 16px 18px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
      box-shadow: 0 0 40px rgba(0,245,255,.15), 0 16px 48px rgba(0,0,0,.6);
      transition: opacity .4s ease, transform .4s cubic-bezier(.34,1.56,.64,1);
      pointer-events: none;
    }
    #adminBroadcastPopup.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
      pointer-events: all;
    }
    .abp-icon {
      font-size: 32px;
      flex-shrink: 0;
      filter: drop-shadow(0 0 10px #ffee00);
    }
    .abp-body { flex: 1; min-width: 0; }
    .abp-tag {
      font-size: 9px;
      font-family: 'Orbitron', sans-serif;
      letter-spacing: 2px;
      color: rgba(0,245,255,.6);
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .abp-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .abp-msg { font-size: 12px; color: rgba(255,255,255,.65); line-height: 1.5; }
    .abp-close {
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.5);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      flex-shrink: 0;
      transition: all .2s;
    }
    .abp-close:hover { background: rgba(255,79,106,.2); color: #ff4f6a; }
  `;
  document.head.appendChild(style);
})();

/* ─── INJECT LEADERBOARD HTML ───────────────────────────────────── */
(function injectLBHTML() {
  // Wait for DOM
  const inject = () => {
    // 1. Start screen — insert leaderboard between stats and play button
    const startScreen = document.getElementById('startScreen');
    if (startScreen && !document.getElementById('inGameLeaderboard')) {
      const lbDiv = document.createElement('div');
      lbDiv.id = 'inGameLeaderboard';
      lbDiv.style.cssText = 'width:min(420px,96vw);margin:0 auto 14px;z-index:1;min-height:60px;';
      lbDiv.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,245,255,.3);font-family:Orbitron,sans-serif;font-size:11px;letter-spacing:2px;">LOADING LEADERBOARD…</div>';

      // Insert before btn-play
      const playBtn = startScreen.querySelector('.btn-play');
      if (playBtn) startScreen.insertBefore(lbDiv, playBtn);
      else startScreen.appendChild(lbDiv);
    }

    // 2. Game Over screen — insert after over-stats
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (gameOverScreen && !document.getElementById('gameOverLeaderboard')) {
      const overContent = gameOverScreen.querySelector('.over-content');
      if (overContent) {
        const lbDiv2 = document.createElement('div');
        lbDiv2.id = 'gameOverLeaderboard';
        lbDiv2.innerHTML = '<div id="inGameLeaderboard2" style="width:min(380px,96vw);margin:0 auto;"></div>';

        // Find best score banner and insert after it
        const banner = overContent.querySelector('.best-score-banner');
        if (banner) overContent.insertBefore(lbDiv2, banner);
        else overContent.appendChild(lbDiv2);
      }
    }

    // 3. Admin broadcast popup
    if (!document.getElementById('adminBroadcastPopup')) {
      const popup = document.createElement('div');
      popup.id = 'adminBroadcastPopup';
      popup.innerHTML = `
        <div class="abp-icon" id="abpIcon">📢</div>
        <div class="abp-body">
          <div class="abp-tag">Admin Message</div>
          <div class="abp-title" id="abpTitle">Message</div>
          <div class="abp-msg" id="abpMsg">—</div>
        </div>
        <div class="abp-close" onclick="closeAdminPopup()">✕</div>`;
      document.body.appendChild(popup);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();

/* ─── SYNC LB TO GAME OVER SCREEN ──────────────────────────────── */
// Game-over leaderboard update — uses same _lbData, separate element
function renderGameOverLeaderboard() {
  const el2 = document.getElementById('inGameLeaderboard2');
  if (!el2 || !_lbData.length) return;

  const myUid = _fbUser2?.uid || Save?.uid;
  const RANK_COLORS = { Beginner:'#94a3b8',Focused:'#22d3ee',Scholar:'#a78bfa',Elite:'#fb923c',Master:'#f472b6',Legend:'#ffd700' };
  const RANK_ICONS  = { Beginner:'🏅',Focused:'🎯',Scholar:'📚',Elite:'⚡',Master:'🔥',Legend:'👑' };
  const medals = ['🥇','🥈','🥉'];

  const rows = _lbData.slice(0,8).map((p,i) => {
    const isMe = p.id === myUid || p.uid === myUid;
    const rankColor = RANK_COLORS[p.rank] || '#94a3b8';
    const medal = i < 3 ? medals[i] : `#${i+1}`;
    return `
      <div class="ilb-row ${isMe ? 'ilb-me' : ''}">
        <span class="ilb-pos">${medal}</span>
        <div class="ilb-avatar">${((p.name||'?')[0]).toUpperCase()}</div>
        <div class="ilb-info">
          <div class="ilb-name">${_esc(p.name||'—')}${isMe ? ' 👈 YOU' : ''}</div>
          <div class="ilb-rank" style="color:${rankColor}">${RANK_ICONS[p.rank]||'🏅'} ${p.rank||'Beginner'}</div>
        </div>
        <div class="ilb-score">
          <div class="ilb-score-val">${(p.score||0).toLocaleString()}</div>
          <div class="ilb-score-xp">${p.xp||0} XP</div>
        </div>
      </div>`;
  }).join('');

  el2.innerHTML = `
    <div style="font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;color:rgba(0,245,255,.6);text-align:center;margin:14px 0 10px;">
      — 🏆 TOP PLAYERS —
    </div>
    <div class="ilb-header">
      <span class="ilb-title">🏆 LEADERBOARD</span>
      <span class="ilb-count">${_lbData.length} players</span>
    </div>
    <div class="ilb-list">${rows}</div>
    <div class="ilb-footer">Live rankings</div>`;
}

/* ─── ADMIN BROADCAST LISTENER ──────────────────────────────────── */
let _broadcastUnsub = null;
let _shownBroadcasts = new Set(JSON.parse(localStorage.getItem('fr_shown_bc') || '[]'));

function listenAdminBroadcasts(user) {
  if (!_db2 || !_query2 || !_collection2 || !_orderBy2 || !_limit2 || !_onSnapshot2) return;
  if (_broadcastUnsub) _broadcastUnsub();
  try {
    _broadcastUnsub = _onSnapshot2(
      _query2(_collection2(_db2, 'gameBroadcasts'), _orderBy2('time', 'desc'), _limit2(10)),
      snap => {
        snap.docs.forEach(d => {
          const bc = { id: d.id, ...d.data() };
          const target = bc.target || 'all';

          // Check if targeted at this user (or all)
          const isForMe = target === 'all' || target === user.uid || target === user.displayName || target === user.email;
          if (!isForMe) return;

          // Don't show same broadcast twice
          if (_shownBroadcasts.has(bc.id)) return;
          _shownBroadcasts.add(bc.id);
          localStorage.setItem('fr_shown_bc', JSON.stringify([..._shownBroadcasts].slice(-50)));

          // Show popup
          const delay = 800;
          setTimeout(() => showAdminBroadcastPopup(bc), delay);
        });
      }
    );
  } catch(e) { console.warn('[GamePatch] Broadcast listen failed:', e); }
}

const TYPE_ICONS = { info:'ℹ️', event:'🎉', challenge:'⚡', reward:'🎁', maintenance:'🔧' };

function showAdminBroadcastPopup(bc) {
  const popup = document.getElementById('adminBroadcastPopup');
  if (!popup) return;
  document.getElementById('abpIcon').textContent  = TYPE_ICONS[bc.type] || '📢';
  document.getElementById('abpTitle').textContent = bc.title   || 'Message from Admin';
  document.getElementById('abpMsg').textContent   = bc.message || '';
  popup.classList.add('show');

  // Auto-dismiss after 6 seconds
  setTimeout(() => popup.classList.remove('show'), 6000);
}

window.closeAdminPopup = function() {
  document.getElementById('adminBroadcastPopup')?.classList.remove('show');
};
