/**
 * ============================================================
 *  Study Grid Prep Admin Panel — admin.js
 *  Production-grade real-time admin system
 *
 *  Features:
 *   - Firebase Auth gate + secret code check (7905)
 *   - Live Firestore listeners (onSnapshot) for all sections
 *   - Real-time user tracking (online / focusing / offline)
 *   - Live chat logs with search & room filter
 *   - Announcement system (instant PWA delivery)
 *   - Promotion system (popup / banner / modal)
 *   - App update pusher
 *   - Push notification queue
 *   - Chart.js analytics
 *   - Toast notification system
 * ============================================================
 */

// ── IMPORTANT: Adjust this import path to match your firebase.js location
import {
  auth,
  provider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  increment,
  serverTimestamp,
  Timestamp
} from "../firebase.js";

// ============================================================
//  CONSTANTS
// ============================================================

/** Firestore collection names — centralised for easy renaming */
const COLL = {
  USERS:         "users",
  MESSAGES:      "messages",
  ROOMS:         "rooms",
  ANNOUNCEMENTS: "announcements",
  PROMOTIONS:    "promotions",
  UPDATES:       "appUpdates",
  NOTIFICATIONS: "notifications",
  ANALYTICS:     "analytics",
  MUSIC:         "musicTracks",
  VIDEO_PROMOS:  "videoPromotions",
  MAINTENANCE:   "maintenance",
  OFFERS:        "offers",
  SUBSCRIPTIONS: "subscriptions",
  PAYMENTS:      "payments",
  SUPPORT_ISSUES: "supportIssues"
};

// ============================================================
//  STATE — single source of truth for all live data
// ============================================================

const STATE = {
  allUsers:        [],    // full user list from Firestore
  allMessages:     [],    // full message list from Firestore
  allSubscriptions: [],   // all subscription records
  selectedSubUID:  null,  // currently selected user for grant/revoke
  rooms:       [],    // active room names (for filter dropdown)
  charts:      {},    // Chart.js instances
  unsubscribers: [],  // Firestore listener cleanup functions
  promoType:   "popup",
  onlineUsersList: [], // live online users for modal
  leaderboardData: [], // dedicated leaderboard collection data
  allPayments: [],     // payment requests from users
  allIssues: [],       // payment/refund support issues from users
  pendingReports: []   // unresolved sub-admin reports (main admin only)
};

// ============================================================
//  DOM HELPERS
// ============================================================

/** Safely get an element by ID */
const $  = id => document.getElementById(id);

/** Animate a stat counter when its value changes */
function animateStat(el, newVal) {
  if (!el) return;
  if (el.innerText === String(newVal)) return; // no change, skip
  el.classList.remove("value-flash");
  void el.offsetWidth; // reflow to restart animation
  el.innerText = newVal;
  el.classList.add("value-flash");
}

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================

/**
 * Show a floating toast message.
 * @param {string} message  Display text
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number}  duration  ms before auto-dismiss (default 3500)
 */
function toast(message, type = "info", duration = 3500) {
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const container = $("toastContainer");

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span>
                  <span class="toast-text">${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add("removing");
    el.addEventListener("animationend", () => el.remove());
  }, duration);
}

// ============================================================
//  MODAL HELPERS
// ============================================================

let _modalResolve = null;

/**
 * Open a confirmation modal and return a Promise<boolean>.
 * true = user confirmed, false = user cancelled.
 */
function confirmModal(title, body) {
  return new Promise(resolve => {
    _modalResolve = resolve;
    $("confirmTitle").textContent = title;
    $("confirmBody").textContent  = body;
    $("confirmModal").classList.add("open");
    // FIX-DELETE: closeModal() was resolving promise as false BEFORE resolve(true) ran
    // So delete/action always got yes=false and never executed.
    $("confirmOkBtn").onclick = () => {
      $("confirmModal").classList.remove("open");
      _modalResolve = null;
      resolve(true);
    };
  });
}

window.closeModal = () => {
  $("confirmModal").classList.remove("open");
  if (_modalResolve) { _modalResolve(false); _modalResolve = null; }
};

// ============================================================
//  SECTION NAVIGATION
// ============================================================

/**
 * Switch the visible section and update sidebar active state.
 * Exposed on window so inline onclick="showSection(...)" works.
 */
window.showSection = id => {
  // Hide all sections
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  // Show target
  const target = $(id);
  if (target) target.classList.add("active");

  // Update sidebar buttons
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === id);
  });
};

// ============================================================
//  AUTH GATE — code check + Firebase auth
// ============================================================

// ============================================================
//  AUTH GATE — Google sign-in + persistent session check
//  Access is enforced entirely by Firestore security rules
//  (isAdmin() checking the account's email) — this client-side
//  flow just drives the UI (loading → gate → app).
// ============================================================

window.signInWithGoogleAdmin = async () => {
  const errEl = $("authError");
  const btn = document.querySelector(".auth-google-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
  if (errEl) errEl.textContent = "";

  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged below picks up the result and launches the panel
  } catch (err) {
    console.error("Google admin sign-in error:", err);
    if (errEl) errEl.textContent = "Sign-in failed: " + err.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Continue with Google"; }
  }
};

// Persistent listener — runs once on page load AND stays active, so a
// page refresh resumes the session automatically instead of asking to
// log in again. This mirrors content-admin.html's session behaviour.
//
// Pages that need their own role check BEFORE launching (e.g. sub-admin.html
// checking the subAdmins collection) should set
// `window.SGP_SKIP_AUTOLAUNCH = true` in an inline <script> BEFORE this
// file loads, and call initAdminPanel(user) etc. themselves once verified.
onAuthStateChanged(auth, async (user) => {
  if (window.SGP_SKIP_AUTOLAUNCH) return;

  const gate = $("authGate");
  const loading = $("authLoading");
  const errEl = $("authError");

  if (!user) {
    if (loading) loading.style.display = "none";
    if (gate) gate.style.display = "flex";
    return;
  }

  if (gate) gate.style.display = "none";
  if (loading) loading.style.display = "flex";

  // No client-side email check — Firestore rules (isAdmin()) are the
  // real gate. If this account isn't an admin, subsequent reads will
  // simply fail/return empty rather than exposing real data.
  if (loading) loading.style.display = "none";
  initAdminPanel(user);
  if (typeof window.initContentStudio === "function") window.initContentStudio();
  if (typeof window.initMediaLibrary === "function") window.initMediaLibrary();
  if (typeof window.initTaxonomy === "function") window.initTaxonomy();
  if (typeof window.initAppoint === "function") window.initAppoint();
});

// Exposed so pages like sub-admin.html (with their own role check) can
// call the same panel launcher instead of duplicating this logic.
window.initAdminPanel = initAdminPanel;

/** Logout and return to homepage */
// ============================================================
//  IMAGE MODAL — in-page lightbox for payment screenshots etc.
//  Fixes the earlier window.open() approach, which caused full
//  navigation and broke the back button / session on mobile.
// ============================================================
window.openImageModal = function (url) {
  let modal = document.getElementById("sgpImageModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "sgpImageModal";
    modal.innerHTML = `
      <div class="sgp-img-modal-backdrop" onclick="closeImageModal()"></div>
      <div class="sgp-img-modal-box">
        <button class="sgp-img-modal-close" onclick="closeImageModal()" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img id="sgpImageModalImg" src="" alt="Screenshot" />
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById("sgpImageModalImg").src = url;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
};
window.closeImageModal = function () {
  const modal = document.getElementById("sgpImageModal");
  if (modal) modal.classList.remove("open");
  document.body.style.overflow = "";
};

window.doLogout = async () => {
  const yes = await confirmModal("Logout", "Are you sure you want to sign out of the admin panel?");
  if (!yes) return;
  // Unsubscribe all Firestore listeners before leaving
  STATE.unsubscribers.forEach(u => u());
  await signOut(auth);
  location.href = "/";
};

// ============================================================
//  PANEL INITIALISATION
// ============================================================

/**
 * Called after successful auth. Sets up all real-time listeners
 * and renders the admin profile in the sidebar.
 */
// ============================================================
//  REPORTS INBOX — sub-admin reports about subscriptions/payments
//  show up as a highlighted row + tap-to-view note, right in the
//  main admin's existing Subscriptions/Payment Requests tables.
// ============================================================
function listenReports() {
  const unsub = onSnapshot(
    query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(200)),
    snap => {
      STATE.pendingReports = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !r.resolved);
      applyReportHighlights();
    },
    err => console.warn("[Reports]", err)
  );
  STATE.unsubscribers.push(unsub);
}

function applyReportHighlights() {
  const reports = STATE.pendingReports || [];
  if (!reports.length) return;

  // Subscriptions table — matched by data-sub-uid
  reports.filter(r => r.type === "subscription").forEach(r => {
    const row = document.querySelector(`tr[data-sub-uid="${r.targetId}"]`);
    if (!row) return;
    row.classList.add("sgp-reported-row");
    if (!row.querySelector(".sgp-report-badge")) {
      const cell = row.querySelector("td:last-child") || row.lastElementChild;
      if (cell) {
        const badge = document.createElement("button");
        badge.className = "sgp-report-badge";
        badge.innerHTML = '<i class="fa-solid fa-flag"></i>';
        badge.title = "View sub-admin's note";
        badge.onclick = (e) => { e.stopPropagation(); showReportNote(r); };
        cell.appendChild(badge);
      }
    }
  });

  // Payments table — matched by data-payment-id
  reports.filter(r => r.type === "payment").forEach(r => {
    const row = document.querySelector(`tr[data-payment-id="${r.targetId}"]`);
    if (!row) return;
    row.classList.add("sgp-reported-row");
    if (!row.querySelector(".sgp-report-badge")) {
      const cell = row.querySelector("td:last-child") || row.lastElementChild;
      if (cell) {
        const badge = document.createElement("button");
        badge.className = "sgp-report-badge";
        badge.innerHTML = '<i class="fa-solid fa-flag"></i>';
        badge.title = "View sub-admin's note";
        badge.onclick = (e) => { e.stopPropagation(); showReportNote(r); };
        cell.appendChild(badge);
      }
    }
  });
}

window.showReportNote = function (report) {
  let modal = document.getElementById("sgpReportNoteModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "sgpReportNoteModal";
    modal.innerHTML = `
      <div class="sgp-img-modal-backdrop" onclick="closeReportNote()"></div>
      <div class="sgp-report-note-box">
        <button class="sgp-img-modal-close" onclick="closeReportNote()" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <div class="sgp-report-note-from" id="sgpReportNoteFrom"></div>
        <div class="sgp-report-note-text" id="sgpReportNoteText"></div>
        <button class="btn btn-primary" id="sgpReportResolveBtn" style="margin-top:14px;">
          <i class="fa-solid fa-check"></i> Mark Resolved
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById("sgpReportNoteFrom").textContent = `From ${report.reportedByName || report.reportedBy} — re: ${report.targetLabel || ""}`;
  document.getElementById("sgpReportNoteText").textContent = report.note || "(no note)";
  document.getElementById("sgpReportResolveBtn").onclick = async () => {
    try {
      await updateDoc(doc(db, "reports", report.id), { resolved: true, resolvedAt: serverTimestamp() });
      closeReportNote();
    } catch (e) { console.error(e); }
  };
  modal.classList.add("open");
};
window.closeReportNote = function () {
  document.getElementById("sgpReportNoteModal")?.classList.remove("open");
};

function initAdminPanel(user) {
  window.__adminPanelUser = user;
  // Sidebar admin profile
  const initials = (user.displayName || user.email || "A").charAt(0).toUpperCase();
  $("adminAvatarSidebar").textContent  = initials;
  $("adminNameSidebar").textContent    = user.displayName || "Admin";
  $("adminEmailSidebar").textContent   = user.email;

  // Initialise Chart.js charts
  initCharts();

  // Start all real-time Firestore listeners
  listenUsers();
  listenSubscriptions();
  listenMessages();
  listenRooms();
  listenAnnouncements();
  listenPromotions();
  listenAppUpdates();
  listenNotifications();
  listenRoomsAdmin();
  listenLeaderboard();
  listenMusicTracks(); // FEAT-3
  listenVideoPromos(); // Video Promotions
  listenMaintenance(); // Maintenance Announcements
  listenPerformance(); // User Performance Analysis
  listenOffers();      // Offers Section
  listenPayments();    // Payment Requests (manual UPI)
  listenIssues();      // Payment/Refund Support Issues
  listenProCounter();  // Live "Pro Plan Purchased" unique-user counter
  if (!window.IS_SUB_ADMIN) listenReports(); // Sub-admin reports inbox (main admin only)
}

// ============================================================
//  CHART.JS INITIALISATION
// ============================================================

/**
 * Build two charts on the dashboard:
 *  1. User growth (last 7 days) — line chart
 *  2. Focus activity (last 7 days) — bar chart
 *
 * Charts are seeded with placeholder data; connect to your
 * analytics/dailyStats Firestore collection to populate live data.
 */
// FIX-DAILY-RESET: a user's `focusTime` field is only meaningful as "today's
// minutes" if it was actually reset today (lastFocusResetDate === today).
// NOTE: this is deliberately its OWN field, separate from `lastActiveDate`
// (which dashboard-home.html's unrelated streak feature also writes, in a
// different date format) — mixing the two caused the focus-time day-check
// to see a "new day" on almost every page load and wipe focusTime to 0
// repeatedly. Must match the non-padded "Y-M-D" format script.js writes.
function _todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function todaysFocusMinutes(u) {
  if (!u) return 0;
  return u.lastFocusResetDate === _todayDateKey() ? (u.focusTime || 0) : 0;
}

function initCharts() {
  const growthCanvas = $("growthChart");
  const focusCanvas  = $("focusChart");
  if (!growthCanvas || !focusCanvas) return;

  const chartDefaults = {
    color: "rgba(255,255,255,0.7)",
    font: { family: "'Manrope', sans-serif", size: 11 }
  };

  Chart.defaults.color          = chartDefaults.color;
  Chart.defaults.font.family    = chartDefaults.font.family;
  Chart.defaults.font.size      = chartDefaults.font.size;

  // Build last-7-days labels
  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  });

  // Destroy existing charts before recreating (prevents canvas reuse error)
  if (STATE.charts.growth) { STATE.charts.growth.destroy(); STATE.charts.growth = null; }
  if (STATE.charts.focus)  { STATE.charts.focus.destroy();  STATE.charts.focus  = null; }

  // ── User Growth Line Chart
  const growthCtx = growthCanvas.getContext("2d");
  const growthGrad = growthCtx.createLinearGradient(0, 0, 0, 200);
  growthGrad.addColorStop(0, "rgba(0,224,255,0.25)");
  growthGrad.addColorStop(1, "rgba(0,224,255,0)");

  STATE.charts.growth = new Chart(growthCtx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Total Users",
        data: [0, 0, 0, 0, 0, 0, 0],
        borderColor: "#00e0ff",
        backgroundColor: growthGrad,
        borderWidth: 2,
        pointBackgroundColor: "#00e0ff",
        pointRadius: 4,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { maxRotation: 0 } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });

  // ── Focus Activity Bar Chart
  const focusCtx = focusCanvas.getContext("2d");
  const focusGrad = focusCtx.createLinearGradient(0, 0, 0, 200);
  focusGrad.addColorStop(0, "rgba(124,92,252,0.7)");
  focusGrad.addColorStop(1, "rgba(124,92,252,0.15)");

  STATE.charts.focus = new Chart(focusCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Focus Minutes",
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: focusGrad,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { maxRotation: 0 } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, beginAtZero: true }
      }
    }
  });

  // Load analytics data into charts
  loadDailyStats();
}

/**
 * Load per-day analytics from Firestore "analytics" collection.
 * Falls back to counting users by createdAt date if analytics docs absent.
 */
async function loadDailyStats() {
  try {
    // Build date keys for last 7 days ("YYYY-MM-DD")
    const dateKeys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    const todayKey = dateKeys[dateKeys.length - 1];

    // Live numbers for TODAY — computed directly from STATE.allUsers so the
    // chart reacts instantly whenever a user is added/removed, without
    // waiting on any Firestore field (createdAt) that was never being written.
    const liveTotalUsers = STATE.allUsers.length;
    const liveFocusToday = STATE.allUsers.reduce(
      (s, u) => s + todaysFocusMinutes(u), 0
    );

    const growthData = [];
    const focusData  = [];

    for (const key of dateKeys) {
      if (key === todayKey) {
        growthData.push(liveTotalUsers);
        focusData.push(liveFocusToday);
        continue;
      }
      try {
        const snap = await getDoc(doc(db, COLL.ANALYTICS, key));
        if (snap.exists()) {
          const data = snap.data();
          growthData.push(typeof data.totalUsers === "number" ? data.totalUsers : null);
          focusData.push(typeof data.focusMinutes === "number" ? data.focusMinutes : null);
        } else {
          growthData.push(null);
          focusData.push(null);
        }
      } catch {
        growthData.push(null);
        focusData.push(null);
      }
    }

    // Fill in any missing historical days (no snapshot existed yet) with the
    // nearest earlier known value so the line doesn't misleadingly drop to 0.
    const fillGaps = arr => {
      let last = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === null) arr[i] = last;
        else last = arr[i];
      }
    };
    fillGaps(growthData);
    fillGaps(focusData);

    STATE.charts.growth.data.datasets[0].data = growthData;
    STATE.charts.focus.data.datasets[0].data  = focusData;
    STATE.charts.growth.update();
    STATE.charts.focus.update();

    // Persist today's snapshot so future days have real history to show.
    setDoc(doc(db, COLL.ANALYTICS, todayKey), {
      totalUsers:    liveTotalUsers,
      focusMinutes:  liveFocusToday,
      updatedAt:     Date.now()
    }, { merge: true }).catch(() => {});
  } catch (err) {
    console.warn("Could not load analytics:", err);
  }
}

// ============================================================
//  LIVE USERS LISTENER
// ============================================================

/**
 * Real-time listener on the "users" collection.
 * Updates dashboard stats, stat cards, user table, and recent-users table.
 */

// ============================================================
//  SUBSCRIPTIONS
// ============================================================

/** Listen to all users with isSubscribed:true in Firestore */
function listenSubscriptions() {
  // We derive subscription data from users collection (isSubscribed + trialExpiry fields)
  // Real-time — whenever user doc changes, table refreshes
  STATE._subUnsub = onSnapshot(
    collection(db, COLL.USERS),
    async snap => {
      const now = Date.now();
      const toExpire = [];

      STATE.allSubscriptions = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => {
          if (!u.isSubscribed) return false;
          const expiry = u.trialExpiry || u.subExpiry || 0;
          // Auto-expire: if expiry passed, mark for update and exclude
          if (expiry && now > expiry) {
            toExpire.push(u.id);
            return false;
          }
          return true;
        });

      // Auto-revoke expired subscriptions in Firestore.
      // Also lock in trialUsed so this user is never shown the ₹1 trial
      // again — the one-time trial window has now closed.
      toExpire.forEach(uid => {
        updateDoc(doc(db, COLL.USERS, uid), {
          isSubscribed: false,
          trialUsed:    true
        }).catch(e => console.warn('Auto-expire failed for', uid, e));
      });

      // Update badge count
      const badge = document.getElementById('subBadge');
      const countEl = document.getElementById('activeSubCount');
      const n = STATE.allSubscriptions.length;
      if (badge) badge.textContent = n;
      if (countEl) countEl.textContent = n;

      renderSubTable();
    },
    err => console.warn('[Subscriptions]', err)
  );
}

/** Render active subscribers table */
function renderSubTable() {
  const q = (document.getElementById('subSearch')?.value || '').toLowerCase();
  const rows = STATE.allSubscriptions.filter(u =>
    !q ||
    (u.name  || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );

  const tbody = document.getElementById('subTable');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-muted);">
      No active subscribers</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(u => {
    const expiry   = u.trialExpiry || u.subExpiry || 0;
    const daysLeft = expiry ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : null;
    const validDate = expiry ? new Date(expiry).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : 'Lifetime';
    const isActive = !expiry || Date.now() < expiry;

    const daysColor = daysLeft === null ? '#10B981'
      : daysLeft <= 3  ? '#EF4444'
      : daysLeft <= 7  ? '#F59E0B'
      : '#10B981';

    const subActionCell = window.IS_SUB_ADMIN ? `
        <span style="font-size:11px;font-weight:700;color:${isActive ? 'var(--accent-green)' : 'var(--accent-red)'};margin-right:8px;">
          ${isActive ? "Active" : "Inactive"}
        </span>
        <button onclick="reportSubscriptionRow('${escHtml(u.id)}','${escHtml(u.name || u.email || u.id)}')" title="Send a note to the main admin about this subscription" style="
          background:rgba(255,184,48,0.1);color:var(--accent-amber);
          border:1px solid rgba(255,184,48,0.3);border-radius:8px;
          padding:5px 11px;font-size:11.5px;font-weight:700;cursor:pointer;">
          <i class="fa-solid fa-flag"></i> Report
        </button>
      ` : `
        <label class="sub-toggle-wrap" title="${isActive ? 'Click to revoke' : 'Revoked/Expired'}">
          <input type="checkbox" class="sub-toggle-cb" ${isActive ? 'checked' : ''}
            onchange="toggleSubFromTable('${escHtml(u.id)}', '${escHtml(u.name || u.email || u.id)}', this.checked)" />
          <span class="sub-toggle-slider"></span>
        </label>
      `;

    return `<tr data-sub-uid="${escHtml(u.id)}">
      <td>
        <div class="user-cell">
          <div class="user-avatar-sm" style="background:linear-gradient(135deg,#F59E0B,#D97706);">
            ${(u.name || u.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;font-size:13px;">${escHtml(u.name || '—')}</div>
            <div style="font-size:11px;color:var(--text-muted);">${escHtml(u.email || u.id)}</div>
          </div>
        </div>
      </td>
      <td style="font-size:12px;color:var(--text-muted);">${validDate}</td>
      <td>
        <span style="font-weight:700;font-size:13px;color:${daysColor};">
          ${daysLeft === null ? '∞ Lifetime' : daysLeft + ' days'}
        </span>
      </td>
      <td>
        ${subActionCell}
      </td>
    </tr>`;
  }).join('');
  if (typeof applyReportHighlights === "function") applyReportHighlights();
}

/** Filter sub table on search */
window.filterSubTable = () => renderSubTable();

/** Toggle subscription on/off from table row */
window.toggleSubFromTable = async (uid, uname, enable) => {
  if (!uid) return;
  const u = STATE.allUsers.find(x => x.id === uid) || {};
  try {
    if (enable) {
      // Re-enable with 30 days default
      const expiry = Date.now() + 30 * 86400000;
      await updateDoc(doc(db, COLL.USERS, uid), {
        isSubscribed: true,
        trialExpiry:  expiry,
        subExpiry:    expiry,
        trialUsed:    true, // any granted access counts as the one-time trial used
        subGrantedBy: 'admin',
        subGrantedAt: Date.now()
      });
      toast(`✅ Subscription enabled for ${uname}`);
      notifyUserInApp(u.email, uname, '🎉 Pro Activated — Study Grid Prep',
        'Your subscription is now active! All mock tests are unlocked. 🔓', '🎉');
    } else {
      await updateDoc(doc(db, COLL.USERS, uid), {
        isSubscribed: false,
        trialExpiry:  0,
        subExpiry:    0,
        trialUsed:    true, // keep marked used even though expiry field is cleared
        subRevokedAt: Date.now(),
        subGrantedBy: 'admin'
      });
      toast(`🚫 Subscription revoked for ${uname}`, 'error');
      notifyUserInApp(u.email, uname, '🚫 Subscription Revoked — Study Grid Prep',
        'Your Pro subscription has been revoked by the admin. Contact support if you think this is a mistake.', '🚫');
    }
  } catch(e) {
    console.error(e);
    toast('Error updating subscription', 'error');
  }
};

// ── Grant user search ──
window.searchGrantUser = () => {
  const q = (document.getElementById('grantSubSearch')?.value || '').toLowerCase().trim();
  const container = document.getElementById('grantUserResults');
  if (!container) return;

  if (!q) { container.innerHTML = ''; return; }

  const matches = STATE.allUsers.filter(u =>
    (u.name  || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (!matches.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No users found</div>`;
    return;
  }

  container.innerHTML = matches.map(u => `
    <div class="grant-user-item" onclick="selectGrantUser('${escHtml(u.id)}','${escHtml(u.name||'')}','${escHtml(u.email||'')}')">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#5B5BF6,#7C3AED);
        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;">
        ${(u.name || u.email || '?')[0].toUpperCase()}
      </div>
      <div>
        <div style="font-weight:600;font-size:13px;">${escHtml(u.name || '—')}</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(u.email || u.id)}</div>
      </div>
      ${u.isSubscribed ? '<span style="margin-left:auto;background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">PRO</span>' : ''}
    </div>
  `).join('');
};

window.selectGrantUser = (uid, name, email) => {
  STATE.selectedSubUID = uid;
  const box   = document.getElementById('selectedSubUser');
  const av    = document.getElementById('selSubAvatar');
  const nm    = document.getElementById('selSubName');
  const em    = document.getElementById('selSubEmail');
  const res   = document.getElementById('grantUserResults');
  const inp   = document.getElementById('grantSubSearch');
  if (box) box.style.display = 'block';
  if (av)  av.textContent   = (name || email || '?')[0].toUpperCase();
  if (nm)  nm.textContent   = name || '—';
  if (em)  em.textContent   = email || uid;
  if (res) res.innerHTML    = '';
  if (inp) inp.value        = '';
};

window.clearSelectedSubUser = () => {
  STATE.selectedSubUID = null;
  const box = document.getElementById('selectedSubUser');
  if (box) box.style.display = 'none';
};

window.setSubDays = (n) => {
  const inp = document.getElementById('subDaysInput');
  if (inp) inp.value = n;
  document.querySelectorAll('.sub-days-pill').forEach(b => b.classList.remove('active'));
  event?.target?.classList?.add('active');
};

window.grantSubscription = async () => {
  const uid  = STATE.selectedSubUID;
  if (!uid) { toast('Please select a user first', 'error'); return; }

  const days = parseInt(document.getElementById('subDaysInput')?.value || '0');
  if (!days || days < 1) { toast('Please enter valid number of days', 'error'); return; }

  const expiry = Date.now() + days * 86400000;
  const validDate = new Date(expiry).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
  const u = STATE.allUsers.find(x => x.id === uid) || {};

  try {
    await updateDoc(doc(db, COLL.USERS, uid), {
      isSubscribed: true,
      trialExpiry:  expiry,
      subExpiry:    expiry,
      trialUsed:    true, // any granted access counts as the one-time trial used
      subGrantedBy: 'admin',
      subGrantedAt: Date.now(),
      subDays:      days
    });
    toast(`✅ ${days}-day subscription granted! Valid till ${validDate}`);
    notifyUserInApp(u.email, u.name, '🎉 Pro Activated — Study Grid Prep',
      `Your ${days}-day plan is now active! All mock tests are unlocked. 🔓`, '🎉');
    clearSelectedSubUser();
    document.getElementById('subDaysInput').value = '';
    document.querySelectorAll('.sub-days-pill').forEach(b => b.classList.remove('active'));
  } catch(e) {
    console.error(e);
    toast('Failed to grant subscription', 'error');
  }
};

window.revokeSubscription = async () => {
  const uid = STATE.selectedSubUID;
  if (!uid) { toast('Please select a user first', 'error'); return; }

  if (!confirm('Revoke this user\'s subscription?')) return;
  const u = STATE.allUsers.find(x => x.id === uid) || {};

  try {
    await updateDoc(doc(db, COLL.USERS, uid), {
      isSubscribed: false,
      trialExpiry:  0,
      subExpiry:    0,
      trialUsed:    true, // keep marked used even though expiry field is cleared
      subRevokedAt: Date.now()
    });
    toast('🚫 Subscription revoked', 'error');
    notifyUserInApp(u.email, u.name, '🚫 Subscription Revoked — Study Grid Prep',
      'Your Pro subscription has been revoked by the admin. Contact support if you think this is a mistake.', '🚫');
    clearSelectedSubUser();
  } catch(e) {
    console.error(e);
    toast('Failed to revoke subscription', 'error');
  }
};

// ============================================================
//  PAYMENT REQUESTS — Manual UPI system
// ============================================================

// ── EmailJS config — fill these before going live ──
// ⚠️  Steps:
//  1. emailjs.com → create account (free)
//  2. Add Gmail service → note Service ID
//  3. Create 2 templates: approve + reject → note Template IDs
//  4. Account → API Keys → note Public Key
const EMAILJS_CONFIG = {
  publicKey:          'hYGUOHKlAwnjcnnwz',  // ← EmailJS Dashboard → Account → API Keys
  serviceId:          'service_h0c8jev',           // ← EmailJS Dashboard → Email Services
  templateReceived:   'template_pjqg0sp',         // ← EmailJS Dashboard → Email Templates
  templateApprove:    'template_n3zhhjk',          // ← EmailJS Dashboard → Email Templates
  templateReject:     'template_reject'            // ← EmailJS Dashboard → Email Templates
};

// Fire an in-app push notification to one user (via the same Firestore
// "notifications" queue the manual broadcast panel uses). Targets by email
// first (exact match against localStorage userEmail on the client), falling
// back to name if no email is known.
async function notifyUserInApp(targetEmail, targetName, title, body, icon = "🔔", expiresInMs = null) {
  const target = targetEmail || targetName;
  if (!target) return;
  try {
    await addDoc(collection(db, COLL.NOTIFICATIONS), {
      target,
      user:   target,
      title,
      body,
      icon,
      image:  null,
      platform: "both",
      read:   false,
      time:   Date.now(),
      // ✅ Agar expiresInMs diya gaya hai (e.g. 24 hours), to yeh notification
      // us waqt ke baad khud-ba-khud clean ho jaata hai — see cleanupExpiredNotifications()
      expiresAt: expiresInMs ? Date.now() + expiresInMs : null,
      sentAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("[Auto-notify] Failed:", err);
  }
}

// ✅ Deletes any "notifications" doc whose expiresAt has passed. Called
// whenever the admin panel's notification listener fires (i.e. every time
// the admin panel is open), so expired notifications (like the 24-hour
// "issue resolved" alert) get swept away without needing a backend cron job.
async function cleanupExpiredNotifications(docs) {
  const now = Date.now();
  for (const d of docs) {
    const data = d.data ? d.data() : d;
    const ref  = d.ref  || doc(db, COLL.NOTIFICATIONS, d.id);
    if (data.expiresAt && data.expiresAt < now) {
      try { await deleteDoc(ref); } catch (e) { /* best-effort */ }
    }
  }
}

// EmailJS lazy-load + send helper
async function sendPaymentEmail(templateId, params) {
  try {
    // Load EmailJS SDK if not already loaded
    if (!window.emailjs) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
    }
    await window.emailjs.send(EMAILJS_CONFIG.serviceId, templateId, params);
    console.log('[EmailJS] Sent:', templateId, params.to_email);
  } catch(err) {
    console.warn('[EmailJS] Failed — check config:', err);
    // Don't block approve/reject flow if email fails
  }
}

/** Listen to payments collection — live updates */
function listenPayments() {
  const q = query(
    collection(db, COLL.PAYMENTS),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const unsub = onSnapshot(q, snap => {
    STATE.allPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Update badge on sidebar nav
    const pending = STATE.allPayments.filter(p => p.status === 'pending').length;
    const badge = document.getElementById('paymentRequestsBadge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }

    renderPaymentRequests();
  }, err => console.warn('[Payments]', err));
  STATE.unsubscribers.push(unsub);
}

/** Render payment requests table */
function renderPaymentRequests() {
  const filter   = document.getElementById('payFilterSelect')?.value || 'pending';
  const tbody    = document.getElementById('payRequestsBody');
  if (!tbody) return;

  // Update stat counts
  const allP = STATE.allPayments;
  const pendCount    = allP.filter(p => p.status === 'pending').length;
  const approveCount = allP.filter(p => p.status === 'approved').length;
  const rejectCount  = allP.filter(p => p.status === 'rejected').length;
  const pcEl = document.getElementById('payPendingCount');
  const acEl = document.getElementById('payApprovedCount');
  const rcEl = document.getElementById('payRejectedCount');
  if (pcEl) pcEl.textContent = pendCount;
  if (acEl) acEl.textContent = approveCount;
  if (rcEl) rcEl.textContent = rejectCount;

  // Update earning summary box
  updateEarningSummary();

  const rows = STATE.allPayments.filter(p =>
    filter === 'all' ? true : p.status === filter
  );

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
      No ${filter} payment requests</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(p => {
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const statusColor = p.status === 'approved' ? 'var(--accent-green)'
      : p.status === 'rejected' ? 'var(--accent-red)'
      : 'var(--accent-amber)';

    const statusIconHtml  = p.status === 'approved' ? '<i class="fa-solid fa-circle-check"></i>'
      : p.status === 'rejected' ? '<i class="fa-solid fa-circle-xmark"></i>' : '<i class="fa-solid fa-clock"></i>';

    const ssHtml = p.screenshot
      ? `<img src="${escHtml(p.screenshot)}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;cursor:pointer;border:1px solid var(--border);"
           onclick="openImageModal('${escHtml(p.screenshot)}')" title="View Screenshot" />`
      : `<span style="font-size:11px;color:var(--text-muted);">No image</span>`;

    const actionBtns = p.status === 'pending' ? `
      <button onclick="approvePayment('${escHtml(p.id)}')" style="
        background:rgba(0,229,160,0.12);color:var(--accent-green);
        border:1px solid rgba(0,229,160,0.3);border-radius:8px;
        padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;
        transition:.2s;font-family:var(--font-body);"
        onmouseover="this.style.background='rgba(0,229,160,0.22)'"
        onmouseout="this.style.background='rgba(0,229,160,0.12)'">
        <i class="fa-solid fa-circle-check"></i> Approve
      </button>
      <button onclick="rejectPayment('${escHtml(p.id)}')" style="
        background:rgba(255,79,106,0.1);color:var(--accent-red);
        border:1px solid rgba(255,79,106,0.3);border-radius:8px;
        padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;
        transition:.2s;font-family:var(--font-body);margin-left:6px;"
        onmouseover="this.style.background='rgba(255,79,106,0.2)'"
        onmouseout="this.style.background='rgba(255,79,106,0.1)'">
        <i class="fa-solid fa-circle-xmark"></i> Reject
      </button>
      <button onclick="mailRejectPayment('${escHtml(p.id)}')" title="Open pre-filled rejection email" style="
        background:rgba(255,255,255,0.05);color:var(--text-secondary);
        border:1px solid var(--border);border-radius:8px;
        padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;
        transition:.2s;font-family:var(--font-body);margin-left:6px;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
        <i class="fa-solid fa-envelope"></i> Mail
      </button>
    ` : `<span style="font-size:12px;color:${statusColor};font-weight:700;">${statusIconHtml} ${p.status}</span>`;

    return `<tr data-payment-id="${escHtml(p.id)}">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#5B5BF6,#7C3AED);
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0;">
            ${(p.name || p.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;font-size:13px;">${escHtml(p.name || '—')}</div>
            <div style="font-size:11px;color:var(--text-muted);">${escHtml(p.email || p.userId || '—')}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan);">
          ${escHtml(p.txnId || '—')}
        </span>
      </td>
      <td>${ssHtml}</td>
      <td>
        <span style="font-weight:700;color:var(--accent-amber);">₹${p.amount || '—'}</span>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${p.plan || '—'}</div>
      </td>
      <td style="font-size:11px;color:var(--text-muted);">${date}</td>
      <td>${actionBtns}</td>
    </tr>`;
  }).join('');
  if (typeof applyReportHighlights === "function") applyReportHighlights();
}

window.filterPayments = () => renderPaymentRequests();

// ─── Earning Filter State ───
let _earningFilterDays = 1; // default: 1 day

window.setEarningFilter = (key) => {
  const map = { '1d':1, '7d':7, '15d':15, '30d':30, '365d':365, '730d':730, 'all': Infinity };
  _earningFilterDays = map[key] ?? 1;
  // Update active button
  document.querySelectorAll('.ef-btn').forEach(b => {
    b.classList.toggle('ef-active', b.dataset.ef === key);
  });
  updateEarningSummary();
};

function updateEarningSummary() {
  const approved = STATE.allPayments.filter(p => p.status === 'approved');

  // Filter by time period
  const now = Date.now();
  const cutoff = _earningFilterDays === Infinity ? 0 : now - (_earningFilterDays * 86400000);

  const inPeriod = approved.filter(p => {
    const ts = p.approvedAt || p.createdAt || 0;
    return ts >= cutoff;
  });

  const trial  = inPeriod.filter(p => p.plan === 'trial'   || p.amount == 1);
  // ✅ Price changed ₹49 → ₹29: widen the fallback amount-heuristic so both
  // legacy ₹49 records already in Firestore AND new ₹29 records are still
  // correctly counted as the monthly plan (the explicit p.plan==='monthly'
  // check already covers most cases; this is just the historical fallback).
  const monthly = inPeriod.filter(p => p.plan === 'monthly' || (p.amount != 1 && p.amount >= 29));

  const earn1   = trial.reduce((s, p)   => s + (Number(p.amount) || 0), 0);
  const earn49  = monthly.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total   = earn1 + earn49;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('earn1Rupee',    earn1);
  set('earn1Count',    trial.length);
  set('earn49Rupee',   earn49);
  set('earn49Count',   monthly.length);
  set('earnTotal',     total);
  set('earnTotalCount', inPeriod.length);
}

// ============================================================
//  LIVE "PRO PLAN PURCHASED" UNIQUE-USER COUNTER
//  (shown on subscription.html below the Start Plan button)
// ============================================================

/** Live-listens stats/proPurchasedCount — updates the admin dashboard's
 *  "Unique Pro Users" card + keeps the on/off toggle switch in sync. */
function listenProCounter() {
  const unsub = onSnapshot(doc(db, 'stats', 'proPurchasedCount'), snap => {
    const data    = snap.exists() ? snap.data() : { count: 0, visible: true };
    const count   = data.count   ?? 0;
    const visible = data.visible !== false; // default ON if field missing

    const countEl = document.getElementById('proUniqueUsersCount');
    if (countEl) countEl.textContent = count.toLocaleString('en-IN');

    const toggle = document.getElementById('proCounterToggle');
    if (toggle) toggle.checked = visible;
  }, err => console.warn('[Pro counter] listener error:', err));
  STATE.unsubscribers.push(unsub);
}

/** Admin flips the on/off switch above Payment Requests — controls whether
 *  the live counter box shows on subscription.html. Doesn't touch the count
 *  itself, just its visibility. */
window.toggleProCounterVisibility = async (checked) => {
  try {
    await setDoc(doc(db, 'stats', 'proPurchasedCount'), { visible: checked }, { merge: true });
    toast(checked ? '✅ Live counter shown on subscription page' : '🚫 Live counter hidden from subscription page');
  } catch (err) {
    console.error('Toggle Pro counter error:', err);
    toast('Failed to update counter visibility', 'error');
  }
};

/** Approve a payment — update user + payment doc + send email */
window.approvePayment = async (paymentId) => {
  const p = STATE.allPayments.find(x => x.id === paymentId);
  if (!p) return;
  if (!confirm(`Approve ₹${p.amount} (${p.plan}) payment from ${p.name || p.email || p.userId}?`)) return;

  try {
    const userId = p.userId;

    // Fetch user doc for email/name (payments doc may have it too, but Firestore is authoritative)
    let userName  = p.name  || '';
    let userEmail = p.email || '';
    if (!userEmail) {
      const userSnap = await getDoc(doc(db, COLL.USERS, userId));
      if (userSnap.exists()) {
        const ud  = userSnap.data();
        userName  = ud.name  || ud.displayName || userName;
        userEmail = ud.email || userEmail;
      }
    }

    // Calculate expiry
    const days   = p.plan === 'trial' ? 7 : 30;
    const expiry = Date.now() + days * 86400000;

    // Update user doc
    await updateDoc(doc(db, COLL.USERS, userId), {
      isSubscribed:   true,
      trialUsed:      true,
      plan:           p.plan,
      trialExpiry:    expiry,
      subExpiry:      expiry,
      payPending:     false,
      payPendingPlan: null,
      subGrantedBy:   'admin',
      subGrantedAt:   Date.now()
    });

    // Update payment doc
    await updateDoc(doc(db, COLL.PAYMENTS, paymentId), {
      status:     'approved',
      approvedAt: Date.now(),
      approvedBy: auth.currentUser?.email || 'admin'
    });

    toast(`✅ Approved — ${p.plan === 'trial' ? '7-day trial' : '30-day plan'} activated for ${userName || userId}`);
    updateEarningSummary();

    // ✅ Live "Pro Plan Purchased" counter (shown on subscription.html) —
    // counts UNIQUE users only. A doc in proPurchasedUsers/{userId} acts as
    // a "have we ever counted this user" flag — so renewals / trial→monthly
    // upgrades for the same user never double-count the stat.
    try {
      const uniqueRef = doc(db, 'proPurchasedUsers', userId);
      const uniqueSnap = await getDoc(uniqueRef);
      if (!uniqueSnap.exists()) {
        await setDoc(uniqueRef, {
          userId, userEmail, userName,
          firstPlan: p.plan,
          firstApprovedAt: Date.now()
        });
        await setDoc(doc(db, 'stats', 'proPurchasedCount'), {
          count: increment(1)
        }, { merge: true });
      }
    } catch (e) {
      console.warn('[Pro counter] Failed to update unique-purchase stat:', e);
    }

    // Auto in-app notification — "Pro Activated" 🎉
    const planLabelShort = p.plan === 'trial' ? '7-day trial' : '30-day plan';
    notifyUserInApp(
      userEmail, userName,
      '🎉 Pro Activated — Study Grid Prep',
      `Your ${planLabelShort} is now active! All mock tests are unlocked. 🔓`,
      '🎉'
    );

    // Send approval email
    if (userEmail) {
      const planLabel = p.plan === 'trial' ? '₹1 Trial (7 Days)' : '₹29 Monthly (30 Days)';
      const expDate   = new Date(expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      await sendPaymentEmail(EMAILJS_CONFIG.templateApprove, {
        to_name:   userName || 'Student',
        to_email:  userEmail,
        plan_name: planLabel,
        exp_date:  expDate
      });
    }
  } catch(err) {
    console.error('Approve payment error:', err);
    toast('Failed to approve payment', 'error');
  }
};

/** Reject a payment — update payment doc + send email */
window.rejectPayment = async (paymentId) => {
  const p = STATE.allPayments.find(x => x.id === paymentId);
  if (!p) return;
  if (!confirm(`Reject payment from ${p.name || p.email || p.userId}?`)) return;

  try {
    const userId = p.userId;

    // Fetch email if not in payment doc
    let userName  = p.name  || '';
    let userEmail = p.email || '';
    if (!userEmail) {
      const userSnap = await getDoc(doc(db, COLL.USERS, userId));
      if (userSnap.exists()) {
        const ud  = userSnap.data();
        userName  = ud.name  || ud.displayName || userName;
        userEmail = ud.email || userEmail;
      }
    }

    // Clear payPending on user doc
    await updateDoc(doc(db, COLL.USERS, userId), {
      payPending:     false,
      payPendingPlan: null
    });

    // Update payment doc
    await updateDoc(doc(db, COLL.PAYMENTS, paymentId), {
      status:     'rejected',
      rejectedAt: Date.now(),
      rejectedBy: auth.currentUser?.email || 'admin'
    });

    toast(`❌ Payment rejected for ${userName || userId}`, 'error');

    // Auto in-app notification — "Payment Rejected" ❌
    notifyUserInApp(
      userEmail, userName,
      '❌ Payment Not Received — Study Grid Prep',
      'Your payment could not be verified, so your subscription request has been rejected. Please try again or contact support if you believe this is a mistake.',
      '❌'
    );

    // Send rejection email
    if (userEmail) {
      await sendPaymentEmail(EMAILJS_CONFIG.templateReject, {
        to_name:  userName || 'Student',
        to_email: userEmail
      });
    }
  } catch(err) {
    console.error('Reject payment error:', err);
    toast('Failed to reject payment', 'error');
  }
};

/** Open the user's mail app with a pre-filled professional rejection email.
 *  Manual fallback since automated EmailJS rejection template isn't
 *  reliably configured — admin just has to hit Send. */
window.mailRejectPayment = (paymentId) => {
  const p = STATE.allPayments.find(x => x.id === paymentId);
  if (!p) return;

  const toEmail  = p.email || '';
  if (!toEmail) { toast('No email found for this payment', 'error'); return; }

  const planLabel = p.plan === 'trial' ? '₹1 Trial (7 Days)' : '₹29 Monthly (30 Days)';
  const subject = 'Payment Not Received - Study Grid Prep';
  const body =
`Hello ${p.name || 'Student'},

We're sorry to inform you that your payment could not be verified.

Transaction ID: ${p.txnId || '—'}
Plan: ${planLabel}
Amount: ₹${p.amount || '—'}

Your payment request has been rejected. If you believe this is a mistake or you have already made the payment, please reply to this email with your payment screenshot, or try submitting the payment request again.

Regards,
Study Grid Prep Team
studygridprep.online`;

  const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_blank');
};

// ============================================================
//  PAYMENT / REFUND SUPPORT ISSUES
//  (submitted from subscription.html's support box)
// ============================================================

function listenIssues() {
  const q = query(
    collection(db, COLL.SUPPORT_ISSUES),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  const unsub = onSnapshot(q, snap => {
    STATE.allIssues = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Update badge on sidebar nav — count of not-yet-reviewed issues
    const pending = STATE.allIssues.filter(i => i.status !== 'resolved').length;
    const badge = document.getElementById('issuesBadge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }

    renderIssues();
  }, err => console.warn('[Issues]', err));
  STATE.unsubscribers.push(unsub);
}

/** Render support issues as a sequential card list, with search + status filter */
function renderIssues() {
  const container = document.getElementById('issuesListContainer');
  if (!container) return;

  const searchTerm = (document.getElementById('issueSearchInput')?.value || '').trim().toLowerCase();
  const filter      = document.getElementById('issueFilterSelect')?.value || 'pending';

  let rows = STATE.allIssues;

  if (filter !== 'all') {
    rows = rows.filter(i => filter === 'pending' ? i.status !== 'resolved' : i.status === 'resolved');
  }
  if (searchTerm) {
    rows = rows.filter(i =>
      (i.userName  || '').toLowerCase().includes(searchTerm) ||
      (i.userEmail || '').toLowerCase().includes(searchTerm) ||
      (i.issueId   || i.id || '').toLowerCase().includes(searchTerm)
    );
  }

  // Update stat counts (unfiltered totals)
  const pendCount = STATE.allIssues.filter(i => i.status !== 'resolved').length;
  const resvCount = STATE.allIssues.filter(i => i.status === 'resolved').length;
  const pcEl = document.getElementById('issuePendingCount');
  const rcEl = document.getElementById('issueResolvedCount');
  if (pcEl) pcEl.textContent = pendCount;
  if (rcEl) rcEl.textContent = resvCount;

  if (!rows.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">No issues found</div>`;
    return;
  }

  container.innerHTML = rows.map(i => {
    const date = i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';
    const resolved   = i.status === 'resolved';
    const catColor   = i.category === 'Refund Request' ? 'var(--accent-violet)' : 'var(--accent-cyan)';
    const catIcon    = i.category === 'Refund Request' ? '↩️' : '💳';

    return `<div onclick="openIssueDetail('${escHtml(i.id)}')" style="
        background:var(--bg-card);border:1px solid var(--border);border-radius:14px;
        padding:15px 16px;cursor:pointer;transition:.18s;margin-bottom:10px;
        display:flex;align-items:center;gap:14px;"
        onmouseover="this.style.borderColor='var(--accent-cyan)'"
        onmouseout="this.style.borderColor='var(--border)'">
      <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#5B5BF6,#7C3AED);
        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff;flex-shrink:0;">
        ${(i.userName || i.userEmail || '?')[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-family:var(--font-mono);font-size:12px;font-weight:800;color:var(--accent-cyan);">#${escHtml(i.issueId || i.id)}</span>
          <span style="font-size:11px;font-weight:700;color:${catColor};">${catIcon} ${escHtml(i.category || '—')}</span>
        </div>
        <div style="font-weight:600;font-size:13px;margin-top:3px;">${escHtml(i.userName || '—')} <span style="color:var(--text-muted);font-weight:400;">· ${escHtml(i.userEmail || '—')}</span></div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escHtml(i.problem || '')}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:6px;">${date}</div>
        <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;
          background:${resolved ? 'rgba(0,229,160,0.12)' : 'rgba(255,184,48,0.12)'};
          color:${resolved ? 'var(--accent-green)' : 'var(--accent-amber)'};">
          ${resolved ? '✅ Resolved' : '⏳ Pending'}
        </span>
      </div>
    </div>`;
  }).join('');
}

window.filterIssues = () => renderIssues();
window.searchIssues  = () => renderIssues();

/** Open the detail popup for one issue */
window.openIssueDetail = (issueId) => {
  const i = STATE.allIssues.find(x => x.id === issueId);
  if (!i) return;

  const date = i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '—';
  const resolved = i.status === 'resolved';

  document.getElementById('issueDetailTitle').textContent = `#${i.issueId || i.id}`;
  document.getElementById('issueDetailBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;
          background:${resolved ? 'rgba(0,229,160,0.12)' : 'rgba(255,184,48,0.12)'};
          color:${resolved ? 'var(--accent-green)' : 'var(--accent-amber)'};">
          ${resolved ? '✅ Resolved' : '⏳ Pending Review'}
        </span>
        <span style="font-size:11px;color:var(--text-muted);">Submitted ${date}</span>
      </div>
      <div>
        <div class="form-label" style="margin-bottom:4px;">Category</div>
        <div style="font-size:14px;font-weight:600;">${escHtml(i.category || '—')}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom:4px;">User</div>
        <div style="font-size:14px;font-weight:600;">${escHtml(i.userName || '—')}</div>
        <div style="font-size:12px;color:var(--text-muted);">${escHtml(i.userEmail || '—')}</div>
        <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">UID: ${escHtml(i.userId || '—')}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom:4px;">Current Plan Status</div>
        <div style="font-size:13px;">${escHtml(i.currentPlanStatus || '—')}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom:4px;">Problem Description</div>
        <div style="font-size:13.5px;line-height:1.6;background:var(--bg-input);border:1px solid var(--border);
          border-radius:10px;padding:12px 14px;white-space:pre-wrap;">${escHtml(i.problem || '—')}</div>
      </div>
      ${resolved ? `
      <div>
        <div class="form-label" style="margin-bottom:4px;color:var(--accent-green);">Admin Note (visible to user)</div>
        <div style="font-size:13px;line-height:1.6;background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.25);
          border-radius:10px;padding:12px 14px;">${escHtml(i.adminNote || '(no note added)')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Reviewed by ${escHtml(i.reviewedBy || 'admin')} · ${i.reviewedAt ? new Date(i.reviewedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</div>
      </div>` : `
      <div>
        <div class="form-label" style="margin-bottom:4px;">Add a note (optional, visible to user once marked reviewed)</div>
        <textarea id="issueAdminNoteInput" class="form-textarea" placeholder="e.g. Refund processed to your original payment method within 3-5 days." style="min-height:70px;"></textarea>
      </div>`}
    </div>`;

  const footer = document.getElementById('issueDetailFooter');
  footer.innerHTML = resolved
    ? `<button class="btn btn-outline" onclick="closeIssueModal()">Close</button>`
    : `<button class="btn btn-outline" onclick="closeIssueModal()">Close</button>
       <button class="btn btn-primary" onclick="markIssueReviewed('${escHtml(i.id)}')">✅ Mark Reviewed</button>`;

  document.getElementById('issueDetailModal').classList.add('open');
};

window.closeIssueModal = () => {
  document.getElementById('issueDetailModal').classList.remove('open');
};

window.markIssueReviewed = async (issueId) => {
  const i = STATE.allIssues.find(x => x.id === issueId);
  if (!i) return;
  const note = document.getElementById('issueAdminNoteInput')?.value.trim() || '';

  try {
    await updateDoc(doc(db, COLL.SUPPORT_ISSUES, issueId), {
      status:     'resolved',
      adminNote:  note,
      reviewedAt: Date.now(),
      reviewedBy: auth.currentUser?.email || 'admin'
    });

    // ✅ Auto in-app push notification — user ko turant pata chal jaaye ki
    // unka issue resolve ho gaya hai. Yeh 24 hours baad khud delete ho jaata
    // hai (expiresAt field via cleanupExpiredNotifications).
    notifyUserInApp(
      i.userEmail,
      i.userName,
      '✅ Issue Resolved — Study Grid Prep',
      `Your issue #${i.issueId || i.id} has been reviewed and resolved. Please check the app for details.` + (note ? ` Note from support: ${note}` : ''),
      '✅',
      24 * 60 * 60 * 1000 // expires in 24 hours
    );

    toast(`✅ Issue #${i.issueId || i.id} marked reviewed`);
    closeIssueModal();
  } catch (err) {
    console.error(err);
    toast('Failed to update issue', 'error');
  }
};

function listenUsers() {
  // ✅ FIX: orderBy("lastActive") Firestore pe nahi — client-side sort karo.
  // Reason: agar kisi doc mein lastActive field missing ho (purane name-keyed docs)
  // to Firestore us doc ko query result mein include hi nahi karta — user invisible ho jaata hai.
  const unsub = onSnapshot(
    collection(db, COLL.USERS),   // ← no orderBy — sab docs milenge
    snap => {
      // Step 1: Deduplicate by doc ID
      const seenId = new Map();
      snap.docs.forEach(d => {
        const data = d.data();
        // ✅ FIX: skip orphan "ghost" docs — these were created by an older
        // subscription.js bug that wrote a Firestore doc for a visitor's
        // locally-generated fallback ID (format "u_...") BEFORE they ever
        // logged in, so the doc has no email/name and can never be a real
        // account. That bug is now fixed at the source, but any old ghost
        // docs already sitting in Firestore would otherwise still clutter
        // the admin panel as noise "duplicate" users.
        const looksLikeGhost = /^u_/.test(d.id)
          && !(data.email || "").trim()
          && !(data.name || data.userName || data.displayName || "").trim();
        if (looksLikeGhost) return;
        seenId.set(d.id, { id: d.id, ...data });
      });
      let users = [...seenId.values()];

      // Step 2: FIX-DUP — Dedup by email (primary) — keeps uid-keyed doc over name-keyed
      // Rule: if same email exists in multiple docs, keep the one whose doc ID === uid field
      const seenEmail = new Map();
      for (const u of users) {
        const emailKey = (u.email || "").toLowerCase().trim();
        if (!emailKey) continue;
        if (!seenEmail.has(emailKey)) {
          seenEmail.set(emailKey, u);
        } else {
          const existing = seenEmail.get(emailKey);
          // Prefer uid-keyed doc (id === uid field) over name-keyed
          const uIsUidKeyed  = u.id === u.uid;
          const exIsUidKeyed = existing.id === existing.uid;
          if (uIsUidKeyed && !exIsUidKeyed) {
            seenEmail.set(emailKey, u); // new one is uid-keyed — prefer it
          } else if (!uIsUidKeyed && exIsUidKeyed) {
            // existing is uid-keyed — keep it
          } else {
            // Both same type — keep more recently active
            if ((u.lastActive || 0) > (existing.lastActive || 0)) {
              seenEmail.set(emailKey, u);
            }
          }
        }
      }
      // Users without email — keep as-is (rare edge case)
      const usersWithoutEmail = users.filter(u => !(u.email || "").toLowerCase().trim());
      // ✅ Client-side sort — missing lastActive wale bhi dikhenge (fallback 0)
      STATE.allUsers = [...seenEmail.values(), ...usersWithoutEmail]
        .sort((a, b) => (b.lastActive || b.lastSeen || 0) - (a.lastActive || a.lastSeen || 0));

      updateUserStats();
      renderUserTable();
      renderDashRecent();
      renderLeaderboardSection();
      renderPerformanceSection(STATE.allUsers);
      renderWatchTimeSection(STATE.allUsers);   // ← Watch Time section
      renderFocusTimerSection();                // ← Focus Timer section
      // Refresh charts with real user data after users load
      loadDailyStats();
      // Populate maintenance exclude user dropdown
      populateMaintExcludeDropdown();
    },
    err => console.error("Users listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

/** Compute aggregate stats and update dashboard cards */
function updateUserStats() {
  const users = STATE.allUsers;
  const total = users.length;

  const STALE_MS = 5 * 60 * 1000; // 5 minutes — stale threshold
  const now = Date.now();

  // isLiveUser: status is online/focusing AND lastActive within 5 min
  // Handles both script.js ("Online", "Focusing 👋") and index.js ("online", "focusing")
  function isLiveUser(u) {
    const s = (u.status || "").toLowerCase();
    // "offline" always excluded
    if (s === "offline") return false;
    // Must be online or focusing
    if (s !== "online" && !s.includes("focus")) return false;
    const ts = u.lastActive || u.lastSeen || 0;
    // If lastActive is set and stale → offline
    if (ts && (now - ts) > STALE_MS) return false;
    return true;
  }

  const onlineUsers = users.filter(isLiveUser);
  const online   = onlineUsers.length;

  const focusing = users.filter(u => {
    const s = (u.status || "").toLowerCase();
    if (!s.includes("focus")) return false;
    const ts = u.lastActive || u.lastSeen || 0;
    if (ts && (now - ts) > STALE_MS) return false;
    return true;
  }).length;

  const totalFocMin = users.reduce((sum, u) =>
    sum + (u.focusTime || u.totalFocusTime || u.timerMinutes || 0), 0);
  const focHours = totalFocMin < 60
    ? `${totalFocMin}m`
    : `${Math.floor(totalFocMin / 60)}h ${totalFocMin % 60}m`;

  // Playlist watch time
  const totalPlaylistMin = users.reduce((sum, u) =>
    sum + (u.playlistWatchMinutes || 0), 0);
  const playlistHours = totalPlaylistMin < 60
    ? `${totalPlaylistMin}m`
    : `${Math.floor(totalPlaylistMin / 60)}h ${totalPlaylistMin % 60}m`;

  // Live Visitors = users who have any currentPage set AND are live
  const liveVisitors = users.filter(u => isLiveUser(u) && (u.currentPage || u.page || u.activePage)).length;

  animateStat($("totalUsers"),    total);
  animateStat($("onlineUsers"),   online);
  animateStat($("focusingUsers"), focusing);
  animateStat($("focusTime"),     focHours);
  // Live visitors: users actually on a page; fallback to online count if no page data
  animateStat($("liveVisitors"),  liveVisitors > 0 ? liveVisitors : online);
  // Playlist watch time
  if ($("playlistWatchTime")) animateStat($("playlistWatchTime"), playlistHours);

  // Cache online users list for modal
  STATE.onlineUsersList = onlineUsers;
}

/**
 * Build the full users table with current search filter applied.
 */
function renderUserTable() {
  const query = ($("userSearch")?.value || "").toLowerCase();
  const rows  = STATE.allUsers.filter(u =>
    !query ||
    (u.name  || "").toLowerCase().includes(query) ||
    (u.email || "").toLowerCase().includes(query)
  );

  const tbody = $("userTable");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
      No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(u => {
    // COMBINED XP = playlist+todo (u.xp from uw-core) + timer (u.timerXP from script.js)
    const studyXP  = Number(u.xp ?? u.points ?? u.score ?? 0);
    const timerXP  = Number(u.timerXP || 0);
    const xp       = studyXP + timerXP;   // combined total for display + level
    const level   = adminGetLevel(xp);
    const badge   = adminGetBadge(xp);
    const goal    = u.goal || u.studyGoal || null;
    const todos   = u.todos || u.todoCount || null;
    const uid     = escHtml(u.id);
    const uname   = escHtml(u.name || u.email || u.id);

    // Goal pill
    const goalHtml = goal
      ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:3px;
           background:rgba(0,224,255,.07);border:1px solid rgba(0,224,255,.15);
           border-radius:20px;padding:2px 9px;font-size:10px;color:var(--accent-cyan);font-weight:600;">
           🎯 ${escHtml(goal)}</div>`
      : "";

    // Todos pill
    const todoHtml = (todos !== null && todos !== undefined)
      ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:3px;
           background:rgba(0,229,160,.07);border:1px solid rgba(0,229,160,.15);
           border-radius:20px;padding:2px 9px;font-size:10px;color:var(--accent-green);font-weight:600;">
           ✅ ${Array.isArray(todos) ? todos.length : todos} todos</div>`
      : "";

    // Premium glow if subscribed
    const isSubbed = u.isSubscribed === true;
    const subExpiry = u.trialExpiry || u.subExpiry || 0;
    const subActive = isSubbed && (!subExpiry || Date.now() < subExpiry);
    const rowClass = subActive ? 'sub-active-row' : '';

    return `
    <tr class="${rowClass}">
      <td>
        <div class="user-cell">
          <div class="user-avatar-sm">${(u.name || u.displayName || u.email || "?")[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:600;font-size:13px;">${escHtml(u.name || u.displayName || "—")}</div>
            <div style="font-size:11px;color:var(--text-muted);">${escHtml(u.email || u.id)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
              ${goalHtml}${todoHtml}
              ${subActive ? `<div style="display:inline-flex;align-items:center;gap:4px;
                background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);
                border-radius:20px;padding:2px 9px;font-size:10px;color:#F59E0B;font-weight:700;">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                PRO</div>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-size:11px;color:var(--text-muted);">
          ${u.platform === "pwa" ? "📱 PWA" : u.platform === "web" ? "🖥️ Website" : "🌐 Both"}
        </span>
      </td>
      <td>${statusBadge(u.status, u.lastActive)}</td>
      <td>
        <div style="font-family:var(--font-mono);font-size:12px;">
          <div style="color:var(--accent-amber);font-weight:700;">⚡ ${xp} XP</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">📚${studyXP}+⏱${timerXP}</div>
          <span style="background:rgba(124,92,252,0.15);color:var(--accent-violet);
            border:1px solid rgba(124,92,252,0.3);border-radius:20px;
            padding:1px 8px;font-size:11px;font-weight:600;">Lv.${level}</span>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${badge}</div>
        </div>
      </td>
      <td class="mono" style="color:var(--text-muted);">${formatLastActive(u)}</td>
      <td class="mono" style="color:var(--text-muted);font-size:11px;">${formatLastPage(u)}</td>
      <td>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <button title="Send Notification" onclick="notifyUser('${uid}','${uname}')" style="
            background:rgba(0,224,255,.1);border:1px solid rgba(0,224,255,.2);
            color:var(--accent-cyan);border-radius:7px;padding:5px 9px;
            font-size:13px;cursor:pointer;transition:all .15s;
          " onmouseover="this.style.background='rgba(0,224,255,.25)'" onmouseout="this.style.background='rgba(0,224,255,.1)'"><i class="fa-solid fa-bell"></i></button>
          <button title="Send Announcement" onclick="userQuickAction('announcement','${uid}','${uname}')" style="
            background:rgba(255,184,48,.1);border:1px solid rgba(255,184,48,.2);
            color:var(--accent-amber);border-radius:7px;padding:5px 9px;
            font-size:13px;cursor:pointer;transition:all .15s;
          " onmouseover="this.style.background='rgba(255,184,48,.25)'" onmouseout="this.style.background='rgba(255,184,48,.1)'"><i class="fa-solid fa-bullhorn"></i></button>
          <button title="Send Promotion" onclick="userQuickAction('promotions','${uid}','${uname}')" style="
            background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.2);
            color:var(--accent-violet);border-radius:7px;padding:5px 9px;
            font-size:13px;cursor:pointer;transition:all .15s;
          " onmouseover="this.style.background='rgba(124,92,252,.25)'" onmouseout="this.style.background='rgba(124,92,252,.1)'"><i class="fa-solid fa-bullseye"></i></button>
          <button title="Send Video Promotion" onclick="userQuickAction('videopromo','${uid}','${uname}')" style="
            background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.2);
            color:var(--accent-green);border-radius:7px;padding:5px 9px;
            font-size:13px;cursor:pointer;transition:all .15s;
          " onmouseover="this.style.background='rgba(0,229,160,.25)'" onmouseout="this.style.background='rgba(0,229,160,.1)'"><i class="fa-solid fa-play"></i></button>
          <button title="Send Offer" onclick="sendOfferToUser('${uid}','${uname}')" style="
            background:rgba(255,184,48,.1);border:1px solid rgba(255,184,48,.25);
            color:var(--accent-amber);border-radius:7px;padding:5px 9px;
            font-size:13px;cursor:pointer;transition:all .15s;font-weight:600;
          " onmouseover="this.style.background='rgba(255,184,48,.25)'" onmouseout="this.style.background='rgba(255,184,48,.1)'"><i class="fa-solid fa-gift"></i></button>
${`<button title="Delete User" onclick="deleteUser('${uid}','${uname}')" style="
          background:rgba(255,79,106,.1);border:1px solid rgba(255,79,106,.25);
          color:var(--accent-red);border-radius:7px;padding:5px 9px;
          font-size:13px;cursor:pointer;transition:all .15s;font-weight:600;
        " onmouseover="this.style.background='rgba(255,79,106,.25)'" onmouseout="this.style.background='rgba(255,79,106,.1)'"><i class="fa-solid fa-trash"></i></button>`}
          <button title="Reset Focus/XP Stats (fixes corrupted data)" onclick="resetUserFocusStats('${uid}','${uname}')" style="
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);
          color:var(--text-secondary);border-radius:7px;padding:5px 9px;
          font-size:13px;cursor:pointer;transition:all .15s;
        " onmouseover="this.style.background='rgba(255,255,255,.15)'" onmouseout="this.style.background='rgba(255,255,255,.06)'"><i class="fa-solid fa-broom"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

/** Reset a user's focus-timer time/XP fields to 0 — used to clean up
 *  corrupted values (e.g. from a client-side timer bug) without touching
 *  their study (playlist/todo) XP or account/subscription data at all. */
window.resetUserFocusStats = async (uid, uname) => {
  const yes = await confirmModal(
    "Reset Focus Stats",
    `Reset focus time and timer-XP for "${uname}" back to 0? This only affects focus-timer stats (today's time, today's timer XP, weekly timer XP, weekly focus time, lifetime focus time). Study/playlist XP and everything else is untouched.`
  );
  if (!yes) return;
  try {
    await setDoc(doc(db, "users", uid), {
      focusTime: 0,
      totalFocusTime: 0,
      todayTimerXP: 0,
      weeklyXP: 0
    }, { merge: true });
    await setDoc(doc(db, "leaderboard", uid), {
      timerXP: 0,
      weeklyTimerXP: 0,
      weeklyFocusTime: 0
    }, { merge: true }).catch(() => {}); // leaderboard doc may not exist yet — fine either way
    toast(`Focus stats reset for "${uname}".`, "success");
  } catch (err) {
    toast("Reset failed: " + err.message, "error");
  }
};

/** User management quick action helper */
window.userQuickAction = (section, uid, uname) => {
  showSection(section);
  if (section === "announcement") {
    const sel = $("announceTarget"); if (sel) sel.value = "user";
    const ug = $("announceUserGroup"); if (ug) { ug.style.display = "flex"; }
    const ui = $("announceUser"); if (ui) ui.value = uname;
  } else if (section === "promotions") {
    const sel = $("promoTarget"); if (sel) sel.value = "user";
    const ug = $("promoUserGroup"); if (ug) { ug.style.display = "flex"; }
    const ui = $("promoUser"); if (ui) ui.value = uname;
  } else if (section === "videopromo") {
    const sel = $("vpTarget"); if (sel) sel.value = "user";
    const ug = $("vpUserGroup"); if (ug) { ug.style.display = "flex"; }
    const ui = $("vpUser"); if (ui) ui.value = uname;
  }
};

/** Render the mini recent-users table on the dashboard */
function renderDashRecent() {
  const tbody = $("dashRecentUsers");
  if (!tbody) return;
  const recent = STATE.allUsers.slice(0, 8);
  tbody.innerHTML = recent.map(u => `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar-sm">${(u.name || u.displayName || u.email || "?")[0].toUpperCase()}</div>
          <span style="font-size:13px;">${escHtml(u.name || u.displayName || "—")}</span>
        </div>
      </td>
      <td>${statusBadge(u.status, u.lastActive)}</td>
      <td class="mono">${formatFocusTime(u.focusTime || 0)}</td>
      <td class="mono" style="color:var(--text-muted);">${formatLastActive(u)}</td>
      <td class="mono" style="font-size:11px;">${formatLastPage(u)}</td>
    </tr>
  `).join("");
}

/** Filter users table when search input changes */
window.filterUsers = () => renderUserTable();

/** Delete a user document from Firestore */
window.deleteUser = async (uid, name) => {
  const yes = await confirmModal(
    "Delete User",
    `Permanently delete "${name}" from Firestore? This removes their data from the users and leaderboard collections. Firebase Auth account is not affected.`
  );
  if (!yes) return;
  try {
    // Delete from users collection
    await deleteDoc(doc(db, COLL.USERS, uid));
    // FIX-DEL: Also delete from leaderboard collection so timer data is fully gone
    try { await deleteDoc(doc(db, "leaderboard", uid)); } catch(e) {}
    toast(`User "${name}" deleted from database.`, "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

/** Quick-action: open notification panel pre-filled with this user */
window.notifyUser = (uid, name) => {
  showSection("notifications");
  $("notifyTarget").value = "user";
  toggleUserField();
  $("notifyUser").value = name || uid;
};

// ============================================================
//  ONLINE USERS MODAL
// ============================================================

window.openOnlineUsersModal = () => {
  const modal = $("onlineUsersModal");
  if (!modal) return;
  modal.classList.add("open");
  renderOnlineUsersModal();
};

function renderOnlineUsersModal() {
  const list = STATE.onlineUsersList || [];
  const countEl = $("onlineModalCount");
  const listEl  = $("onlineUsersList");
  if (countEl) countEl.textContent = `(${list.length} online)`;
  if (!listEl) return;

  if (!list.length) {
    listEl.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🟢</div>
      <div class="empty-state-text">No users online right now</div>
    </div>`;
    return;
  }

  listEl.innerHTML = list.map(u => {
    const pageName = u.currentPage || u.page || u.activePage || "";
    const pageLabel = (() => {
      if (!pageName) return `<span style="color:var(--text-muted);font-size:11px;">—</span>`;
      const p = pageName.toLowerCase();
      if (p.includes("timer"))                                 return "⏱️ Focus Timer";
      if (p.includes("todo"))                                  return "✅ To-Do";
      if (p.includes("playlist"))                              return "🎵 Playlist";
      if (p.includes("profile"))                               return "👤 Profile";
      if (p.includes("leaderboard") && p.includes("full"))     return "🏅 Full Leaderboard";
      if (p.includes("leaderboard"))                           return "🏆 Leaderboard";
      if (p.includes("progress"))                              return "📊 Progress";
      if (p.includes("mock"))                                  return "📝 Mock Test";
      if (p.includes("dashboard-home") || p.includes("home") || p === "index" || p.includes("index")) return "🏠 Home";
      return `📄 ${pageName}`;
    })();
    const email  = escHtml(u.email || u.id);
    const name   = escHtml(u.name || u.email || "—");
    const uid    = escHtml(u.id);
    const uname  = escHtml(u.name || u.email || u.id);

    return `
    <div style="
      display:flex;align-items:center;gap:12px;flex-wrap:wrap;
      background:var(--bg-card);border:1px solid rgba(0,229,160,.15);
      border-radius:10px;padding:12px 14px;
    ">
      <!-- Left: avatar + gmail -->
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:160px;">
        <div style="
          width:36px;height:36px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,var(--accent-green),var(--accent-cyan));
          display:flex;align-items:center;justify-content:center;
          font-size:15px;font-weight:700;color:#000;
        ">${name[0].toUpperCase()}</div>
        <div>
          <div style="font-weight:600;font-size:13px;">${name}</div>
          <div style="font-size:11px;color:var(--text-muted);">${email}</div>
        </div>
      </div>


      <!-- Middle: current page -->
      <div style="flex:1;min-width:120px;text-align:center;">
        <div style="
          display:inline-flex;align-items:center;gap:6px;
          background:rgba(0,224,255,.08);border:1px solid rgba(0,224,255,.15);
          border-radius:20px;padding:4px 12px;
          font-size:12px;color:var(--accent-cyan);font-weight:600;
        ">${pageLabel}</div>
      </div>

      <!-- Right: Action buttons -->
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        <span style="font-size:10px;color:var(--text-muted);margin-right:2px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Action</span>
        <button title="Send Notification" onclick="document.getElementById('onlineUsersModal').classList.remove('open');notifyUser('${uid}','${uname}')" style="
          background:rgba(0,224,255,.1);border:1px solid rgba(0,224,255,.2);
          color:var(--accent-cyan);border-radius:8px;padding:6px 10px;
          font-size:14px;cursor:pointer;transition:all .15s;
        " onmouseover="this.style.background='rgba(0,224,255,.25)'" onmouseout="this.style.background='rgba(0,224,255,.1)'">🔔</button>
        <button title="Send Promotion" onclick="document.getElementById('onlineUsersModal').classList.remove('open');onlineUserQuickAction('promotions','${uid}','${uname}')" style="
          background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.2);
          color:var(--accent-violet);border-radius:8px;padding:6px 10px;
          font-size:14px;cursor:pointer;transition:all .15s;
        " onmouseover="this.style.background='rgba(124,92,252,.25)'" onmouseout="this.style.background='rgba(124,92,252,.1)'">🎯</button>
        <button title="Send Announcement" onclick="document.getElementById('onlineUsersModal').classList.remove('open');onlineUserQuickAction('announcement','${uid}','${uname}')" style="
          background:rgba(255,184,48,.1);border:1px solid rgba(255,184,48,.2);
          color:var(--accent-amber);border-radius:8px;padding:6px 10px;
          font-size:14px;cursor:pointer;transition:all .15s;
        " onmouseover="this.style.background='rgba(255,184,48,.25)'" onmouseout="this.style.background='rgba(255,184,48,.1)'">📢</button>
        <button title="Send Video Promotion" onclick="document.getElementById('onlineUsersModal').classList.remove('open');onlineUserQuickAction('videopromo','${uid}','${uname}')" style="
          background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.2);
          color:var(--accent-green);border-radius:8px;padding:6px 10px;
          font-size:14px;cursor:pointer;transition:all .15s;
        " onmouseover="this.style.background='rgba(0,229,160,.25)'" onmouseout="this.style.background='rgba(0,229,160,.1)'">▶️</button>
      </div>
    </div>`;
  }).join("");
}

/** Navigate to a section with a specific user pre-selected */
window.onlineUserQuickAction = (section, uid, uname) => {
  showSection(section);
  // For announcement & promotion & videopromo: auto-select specific user
  if (section === "notifications") {
    $("notifyTarget").value = "user";
    toggleUserField();
    $("notifyUser").value = uname;
  } else if (section === "announcement") {
    const sel = $("announceTarget");
    if (sel) { sel.value = "user"; }
    const ug = $("announceUserGroup");
    if (ug) { ug.style.display = "flex"; const ui = $("announceUser"); if(ui) ui.value = uname; }
  } else if (section === "promotions") {
    const ug = $("promoUserGroup");
    if (ug) { ug.style.display = "flex"; const ui = $("promoUser"); if(ui) ui.value = uname; }
    const sel = $("promoTarget");
    if (sel) sel.value = "user";
  } else if (section === "videopromo") {
    const ug = $("vpUserGroup");
    if (ug) { ug.style.display = "flex"; const ui = $("vpUser"); if(ui) ui.value = uname; }
    const sel = $("vpTarget");
    if (sel) sel.value = "user";
  }
};

/** Populate the Maintenance "Exclude User" dropdown with all users */
function populateMaintExcludeDropdown() {
  const sel = $("maintExcludeUser");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">— No exclusions —</option>` +
    STATE.allUsers
      .filter(u => u.email && u.email !== "untitledworld9@gmail.com")
      .map(u => {
        const label = u.name ? `${u.name} (${u.email})` : u.email;
        return `<option value="${escHtml(u.email)}" ${u.email === current ? "selected" : ""}>${escHtml(label)}</option>`;
      }).join("");
}

// ============================================================
//  LIVE MESSAGES LISTENER
// ============================================================

/**
 * Real-time listener on "messages" collection.
 * Updates the chat log panel and message count card.
 */
function listenMessages() {
  const unsub = onSnapshot(
    query(collection(db, COLL.MESSAGES), orderBy("time", "desc"), limit(200)),
    snap => {
      // Reverse so oldest messages are at the top
      STATE.allMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();

      // Update message count badge and stat card
      const total = snap.size;
      animateStat($("messagesCount"), total);
      $("msgBadge").textContent = total > 99 ? "99+" : total;

      // Populate room filter dropdown
      updateRoomFilter();
      // Render the chat log
      renderChatLog();
    },
    err => console.error("Messages listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

/** Sync room filter dropdown with rooms found in message data */
function updateRoomFilter() {
  const rooms = [...new Set(STATE.allMessages.map(m => m.room).filter(Boolean))];
  const sel   = $("chatRoomFilter");
  if (!sel) return;

  const current = sel.value;
  // Rebuild options
  sel.innerHTML = `<option value="">All Rooms</option>` +
    rooms.map(r => `<option value="${escHtml(r)}" ${r === current ? "selected" : ""}>${escHtml(r)}</option>`).join("");
}

/**
 * Render the chat log with optional search and room filter.
 * Highlights search terms in message text.
 */
function renderChatLog() {
  const searchTerm = ($("chatSearch")?.value || "").toLowerCase();
  const roomFilter = $("chatRoomFilter")?.value || "";

  let msgs = STATE.allMessages;

  if (roomFilter) msgs = msgs.filter(m => m.room === roomFilter);
  if (searchTerm) msgs = msgs.filter(m =>
    (m.text || "").toLowerCase().includes(searchTerm) ||
    (m.from || m.sender || "").toLowerCase().includes(searchTerm)
  );

  const container = $("chatLogs");
  if (!container) return;

  if (!msgs.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">💬</div>
      <div class="empty-state-text">No messages match the filter</div>
    </div>`;
    return;
  }

  container.innerHTML = msgs.map(m => {
    const sender   = m.from || m.sender || "Unknown";
    const text     = escHtml(m.text || "");
    const hiText   = searchTerm
      ? text.replace(new RegExp(`(${escHtml(searchTerm)})`, "gi"), "<mark>$1</mark>")
      : text;
    const room     = m.room || "global";
    const initials = sender.charAt(0).toUpperCase();

    return `
      <div class="msg-bubble" style="align-items:flex-start;">
        <div class="msg-avatar">${initials}</div>
        <div class="msg-body">
          <div class="msg-meta">
            <span class="msg-sender">${escHtml(sender)}</span>
            <span class="msg-room">#${escHtml(room)}</span>
            <span class="msg-time">${formatTimestamp(m.timestamp || m.time)}</span>
          </div>
          <div class="msg-text">${hiText}</div>
        </div>
        <button
          onclick="deleteMessage('${escHtml(m.id)}')"
          title="Delete message"
          style="
            flex-shrink:0;margin-left:8px;margin-top:2px;
            background:rgba(255,79,106,.1);border:1px solid rgba(255,79,106,.2);
            color:var(--accent-red);border-radius:6px;
            padding:4px 8px;font-size:11px;cursor:pointer;
            transition:all .18s;white-space:nowrap;line-height:1;
          "
          onmouseover="this.style.background='rgba(255,79,106,.25)'"
          onmouseout="this.style.background='rgba(255,79,106,.1)'"
        >🗑</button>
      </div>
    `;
  }).join("");
}

/** Filter messages when search input / room dropdown changes */
window.filterMessages   = () => renderChatLog();

/** Scroll the chat container to the latest message */
window.scrollChatBottom = () => {
  const el = $("chatLogs");
  if (el) el.scrollTop = el.scrollHeight;
};

/** Delete a single message by ID */
window.deleteMessage = async id => {
  const yes = await confirmModal("Delete Message", "Permanently remove this message from Firestore?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.MESSAGES, id));
    toast("Message deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

// ============================================================
//  LIVE ROOMS LISTENER
// ============================================================

/**
 * listenRooms — lightweight stat-only listener.
 * The full admin rooms view is in listenRoomsAdmin() below.
 * NOTE: activeRooms stat is now also updated inside listenRoomsAdmin.
 */
function listenRooms() {
  // listenRoomsAdmin handles the rooms collection and updates activeRooms stat.
  // This function is kept as a no-op for backwards compatibility.
}

// ============================================================
//  ANNOUNCEMENTS
// ============================================================

/**
 * Real-time listener on "announcements" — renders history list.
 */
function listenAnnouncements() {
  const unsub = onSnapshot(
    query(collection(db, COLL.ANNOUNCEMENTS), orderBy("time", "desc"), limit(30)),
    snap => renderAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error("Announcements listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

// ============================================================
//  SEEN BY MODAL — shared across all 5 broadcast sections
// ============================================================

window.openSeenModal = async (collName, docId, label) => {
  const modal = document.getElementById("seenByModal");
  const title = document.getElementById("seenByTitle");
  const list  = document.getElementById("seenByList");
  const count = document.getElementById("seenByCount");
  if (!modal) return;

  title.innerHTML = "<i class=\"fa-solid fa-eye\"></i> " + label + " — Seen By";
  count.textContent = "";
  list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Loading…</div>';
  modal.classList.add("open");

  try {
    const snap = await getDoc(doc(db, collName, docId));
    if (!snap.exists()) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Document not found.</div>';
      return;
    }
    const data = snap.data();
    const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];

    count.textContent = "(" + seenBy.length + " user" + (seenBy.length !== 1 ? "s" : "") + ")";

    if (!seenBy.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:36px 20px;">
          <div style="font-size:40px;margin-bottom:12px;">👀</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-muted);">No one has seen this yet</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px;opacity:0.7;">Users who open the popup will appear here</div>
        </div>`;
      return;
    }

    list.innerHTML = seenBy.map((entry, i) => {
      const name  = typeof entry === "object" ? (entry.name || entry.email || "Unknown") : String(entry);
      const email = typeof entry === "object" ? (entry.email || "") : "";
      const time  = typeof entry === "object" && entry.at ? formatTimestamp(entry.at) : "";
      const init  = (name[0] || "?").toUpperCase();
      return `
        <div style="
          display:flex;align-items:center;gap:12px;
          padding:10px 14px;
          background:${i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"};
          border-bottom:1px solid var(--border);
        ">
          <div style="
            width:34px;height:34px;border-radius:50%;flex-shrink:0;
            background:linear-gradient(135deg,var(--accent-cyan),var(--accent-violet));
            display:flex;align-items:center;justify-content:center;
            font-size:13px;font-weight:800;color:#000;
          ">${escHtml(init)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(name)}</div>
            ${email ? `<div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;">${escHtml(email)}</div>` : ""}
          </div>
          ${time ? `<div style="font-size:11px;color:var(--text-muted);flex-shrink:0;white-space:nowrap;">${time}</div>` : ""}
        </div>`;
    }).join("");
  } catch(e) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--accent-red);">Failed to load: ${escHtml(e.message)}</div>`;
  }
};

window.closeSeenModal = () => {
  document.getElementById("seenByModal")?.classList.remove("open");
};

function seenBadge(collName, docId, label, seenBy) {
  const count = Array.isArray(seenBy) ? seenBy.length : 0;
  const col   = count > 0 ? "var(--accent-green)" : "var(--text-muted)";
  return `
    <button onclick="openSeenModal('${escHtml(collName)}','${escHtml(docId)}','${escHtml(label)}')"
      title="See who viewed this" style="
      display:inline-flex;align-items:center;gap:4px;
      background:none;border:1px solid ${count > 0 ? "rgba(0,229,160,0.25)" : "var(--border)"};
      border-radius:99px;padding:3px 10px;
      font-size:11px;font-weight:600;color:${col};
      cursor:pointer;white-space:nowrap;transition:all .15s;
    " onmouseover="this.style.background='rgba(0,229,160,0.08)'" onmouseout="this.style.background='none'">
      👁 ${count} seen
    </button>`;
}

function renderAnnouncements(list) {
  const container = $("announceList");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📢</div>
      <div class="empty-state-text">No announcements sent yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(a => `
    <div class="announce-item">
      <span class="announce-priority p-${a.priority || "medium"}">${a.priority || "medium"}</span>
      <div style="flex:1;">
        <div class="announce-text">${escHtml(a.text || "")}</div>
        <div class="announce-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${formatTimestamp(a.time)} · ${escHtml(a.target || "all")}
          ${a.page && a.page !== "all" ? ` · 📄 ${escHtml(a.page)}` : " · 📄 all"}</span>
          ${seenBadge(COLL.ANNOUNCEMENTS, a.id, "Announcement", a.seenBy)}
        </div>
      </div>
      <button class="announce-delete" onclick="deleteAnnouncement('${a.id}')" title="Delete">✕</button>
    </div>
  `).join("");
}

/**
 * Send a new announcement to Firestore.
 * The PWA listens on this collection and shows the message instantly.
 */
window.sendAnnouncement = async () => {
  const text     = ($("announceText")?.value    || "").trim();
  const priority = $("announcePriority")?.value || "medium";
  const imageUrl = ($("announceImageUrl")?.value || "").trim();
  const page     = $("announcePage")?.value      || "all"; // FEAT-1
  const btn      = $("announceBtn");

  const targetType    = $("announceTarget").value;
  const selectedUser  = ($("announceUser")?.value || "").trim();

  if (!text) { toast("Please write an announcement first.", "warning"); return; }
  if (targetType === "user" && !selectedUser) { toast("Please enter a target username or email.", "warning"); return; }

  btn.disabled   = true;
  btn.innerHTML  = `<span class="spinner"></span> Sending…`;

  const finalTarget = targetType === "user" && selectedUser ? selectedUser : (targetType === "user" ? "all" : targetType);

  try {
    await addDoc(collection(db, COLL.ANNOUNCEMENTS), {
      text,
      imageUrl:  imageUrl || null,
      priority,
      target:    finalTarget,
      user:      targetType === "user" && selectedUser ? selectedUser : null,
      page,      // FEAT-1: which page to show on
      active:    true,
      time:      Date.now(),
      createdAt: serverTimestamp()
    });

    toast("Announcement sent successfully! ✅", "success");
    $("announceText").value = "";
    if ($("announceImageUrl")) $("announceImageUrl").value = "";
    if ($("announceUser")) $("announceUser").value = "";
  } catch (err) {
    console.error("Announcement error:", err);
    toast("Failed to send announcement: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "📢 Send Announcement";
  }
};

/** Delete an announcement document */
window.deleteAnnouncement = async id => {
  const yes = await confirmModal("Delete Announcement", "Remove this announcement from all user feeds?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.ANNOUNCEMENTS, id));
    toast("Announcement deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

/** Preview modal for announcements */
window.previewAnnouncement = () => {
  const text = ($("announceText")?.value || "").trim();
  if (!text) { toast("Write an announcement first.", "warning"); return; }

  $("confirmTitle").textContent = "📢 Preview — How users will see it";
  $("confirmBody").innerHTML    = `<div style="background:rgba(0,224,255,.07);border:1px solid rgba(0,224,255,.2);
    border-radius:10px;padding:16px;color:var(--text-primary);line-height:1.6;">${escHtml(text)}</div>`;
  $("confirmOkBtn").style.display = "none";
  $("confirmModal").classList.add("open");
  $("confirmOkBtn").onclick = closeModal;
  setTimeout(() => {
    $("confirmOkBtn").style.display = "";
    $("confirmOkBtn").textContent = "Close";
    $("confirmOkBtn").className = "btn btn-outline";
    $("confirmOkBtn").onclick = closeModal;
  }, 0);
};

// ============================================================
//  PROMOTIONS
// ============================================================

/** Select a promo type card */
window.selectPromoType = (type, el) => {
  document.querySelectorAll(".promo-type-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  $("promoType").value = type;
  STATE.promoType      = type;
  // Show banner image field only for banner type
  const imgGroup = $("promoBannerImgGroup");
  if (imgGroup) imgGroup.style.display = type === "banner" ? "block" : "none";
};

/**
 * Send a promotion document to Firestore.
 * The PWA reads this and displays the appropriate popup / banner / modal.
 */
window.sendPromotion = async () => {
  const title    = ($("promoTitle")?.value    || "").trim();
  const body     = ($("promoBody")?.value     || "").trim();
  const cta      = ($("promoCTA")?.value      || "").trim();
  const type     = $("promoType")?.value      || "popup";
  const bgColor  = $("promoBgColor")?.value   || "#0d0f18";
  const duration = parseInt($("promoDuration")?.value || "8", 10);
  const imageUrl = ($("promoBannerImageUrl")?.value || "").trim();
  const url      = ($("promoUrl")?.value          || "").trim();
  const page     = $("promoPage")?.value           || "all"; // FEAT-1
  const platform = $("promoPlatform")?.value       || "both";
  const btn      = $("promoBtn");

  const targetType    = $("promoTarget").value;
  const selectedUser  = ($("promoUser")?.value || "").trim();

  if (!title && !body) { toast("Please fill in title or message.", "warning"); return; }
  if (targetType === "user" && !selectedUser) { toast("Please enter a target username or email.", "warning"); return; }

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Sending…`;

  const finalTarget = targetType === "user" && selectedUser ? selectedUser : "all";

  try {
    await addDoc(collection(db, COLL.PROMOTIONS), {
      type,
      title,
      body,
      cta:       cta || "Got it",
      url:       url || null,
      bgColor,
      duration,
      imageUrl:  imageUrl || null,
      page,      // FEAT-1: which page to show on
      platform,  // pwa / web / both
      target:    finalTarget,
      user:      targetType === "user" && selectedUser ? selectedUser : null,
      active:    true,
      time:      Date.now(),
      createdAt: serverTimestamp()
    });

    toast(`${type.charAt(0).toUpperCase() + type.slice(1)} sent! 🎯`, "success");
    $("promoTitle").value = "";
    $("promoBody").value  = "";
    $("promoCTA").value   = "";
    if ($("promoUrl")) $("promoUrl").value = "";
    if ($("promoUser")) $("promoUser").value = "";
  } catch (err) {
    console.error("Promotion error:", err);
    toast("Failed to send promotion: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "🎯 Send Promotion";
  }
};


// ============================================================
//  APP UPDATES
// ============================================================

/**
 * Push an update event to Firestore.
 * The PWA listens on "appUpdates/latest" and shows an update popup.
 *
 * PWA must listen:
 *   onSnapshot(doc(db,"appUpdates","latest"), snap => { ... })
 */
window.pushUpdate = async () => {
  const version   = ($("updateVersion")?.value   || "").trim();
  const type      = $("updateType")?.value       || "optional";
  const changelog = ($("updateChangelog")?.value || "").trim();
  const url       = ($("updateUrl")?.value       || "").trim();
  const btn       = $("updateBtn");

  if (!version) { toast("Please enter a version tag (e.g. v1.2.0).", "warning"); return; }

  const yes = await confirmModal(
    "Push Update",
    `Send "${version}" update to ALL users? ${type === "forced" ? "⚠️ This is a FORCED update — users cannot dismiss it." : ""}`
  );
  if (!yes) return;

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Pushing…`;

  try {
    await setDoc(doc(db, COLL.UPDATES, "latest"), {
      version,
      type,
      changelog,
      url:       url || null,
      active:    true,
      time:      Date.now(),
      pushedAt:  serverTimestamp()
    });

    await addDoc(collection(db, COLL.UPDATES), {
      version, type, changelog, url: url || null,
      time: Date.now(), pushedAt: serverTimestamp()
    });

    $("currentVersion").textContent = `Current version: ${version}`;
    toast(`Update ${version} pushed to all users! 🚀`, "success");
    $("updateVersion").value   = "";
    $("updateChangelog").value = "";
  } catch (err) {
    console.error("Update push error:", err);
    toast("Failed to push update: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "🔄 Push Update to All Users";
  }
};

/**
 * Clear the active update flag so the popup stops showing.
 */
window.clearUpdateFlag = async () => {
  const yes = await confirmModal("Clear Update Flag", "Remove the active update banner from all user devices?");
  if (!yes) return;
  try {
    await setDoc(doc(db, COLL.UPDATES, "latest"), { active: false, clearedAt: serverTimestamp() }, { merge: true });
    toast("Update flag cleared.", "info");
  } catch (err) {
    toast("Failed to clear flag: " + err.message, "error");
  }
};

// ============================================================
//  PUSH NOTIFICATIONS (Firestore Queue)
// ============================================================

/**
 * Toggle the username field based on notification target type.
 */
window.toggleUserField = () => {
  const target    = $("notifyTarget")?.value;
  const userGroup = $("userTargetGroup");
  if (userGroup) userGroup.style.display = target === "user" ? "flex" : "none";
};

window.toggleAnnounceUserField = () => {
  const v = $("announceTarget")?.value;
  const g = $("announceUserGroup");
  if (g) g.style.display = v === "user" ? "flex" : "none";
};

window.togglePromoUserField = () => {
  const v = $("promoTarget")?.value;
  const g = $("promoUserGroup");
  if (g) g.style.display = v === "user" ? "flex" : "none";
};

window.toggleVpUserField = () => {
  const v = $("vpTarget")?.value;
  const g = $("vpUserGroup");
  if (g) g.style.display = v === "user" ? "flex" : "none";
};

/**
 * Real-time listener on notifications — renders history.
 */
function listenNotifications() {
  const unsub = onSnapshot(
    query(collection(db, COLL.NOTIFICATIONS), orderBy("time", "desc"), limit(30)),
    snap => {
      renderNotificationHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      cleanupExpiredNotifications(snap.docs); // ✅ sweep any expired (e.g. 24h) notifications
    },
    err => console.error("Notifications listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

function renderNotificationHistory(list) {
  const container = $("notifyHistory");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🔔</div>
      <div class="empty-state-text">No notifications sent yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(n => `
<div class="notif-item">

<span class="notif-target ${n.target === "all" ? "all" : ""}">
 ${n.target === "all" ? "📣 All" : `👤 ${escHtml(n.user || n.target)}`}
</span>

<div style="flex:1;">
 <div style="font-weight:600;font-size:13px;">
  ${escHtml(n.icon || "🔔")} ${escHtml(n.title)}
 </div>

 <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
  ${escHtml(n.body)}
 </div>

 <div class="announce-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
  <span>${formatTimestamp(n.time)}</span>
  ${seenBadge("notifications", n.id, "Notification", n.seenBy)}
 </div>
</div>

<button class="announce-delete"
 onclick="deleteNotification('${n.id}')">
✕
</button>

</div>
`).join("");
}

window.deleteNotification = async id => {

 const yes = await confirmModal(
  "Delete Notification",
  "Remove this notification permanently?"
 );

 if(!yes) return;

 try{

  await deleteDoc(doc(db,"notifications",id));

  toast("Notification deleted","info");

 }catch(err){

  toast("Delete failed: "+err.message,"error");

 }

};

/**
 * Add a notification document to the Firestore queue.
 * The PWA listens on this collection and shows the notification.
 */
window.sendNotification = async () => {
  const target   = $("notifyTarget")?.value  || "all";
  const user     = ($("notifyUser")?.value   || "").trim();
  const title    = ($("notifyTitle")?.value  || "").trim();
  const body     = ($("notifyText")?.value   || "").trim();
  const icon     = ($("notifyIcon")?.value   || "🔔").trim();
  const image    = ($("notifyImage")?.value  || "").trim(); // ← ADD
  const platform = $("notifyPlatform")?.value || "both";
  const btn      = $("notifyBtn");  

  if (!title || !body)                { toast("Please fill in title and message.", "warning"); return; }
  if (target === "user" && !user)     { toast("Please enter a target username or UID.", "warning"); return; }

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Sending…`;

  try {
    await addDoc(collection(db, COLL.NOTIFICATIONS), {
      target: target === "all" ? "all" : user,
      user:   target === "user" ? user : null,
      title,
      body,
      icon,
      image : image || null,
      platform,
      read:      false,
      time:      Date.now(),
      sentAt:    serverTimestamp()
    });

    toast(target === "all"
      ? `Broadcast notification sent! 📣`
      : `Notification sent to ${user}! 🔔`, "success");

    // Clear fields
    $("notifyTitle").value = "";
    $("notifyText").value  = "";
    $("notifyIcon").value  = "";
    $("notifyUser").value  = "";
    $("notifyImage").value = "";
  } catch (err) {
    console.error("Notification send error:", err);
    toast("Failed to send notification: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "🔔 Send Notification";
  }
};

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

/**
 * Generate an HTML status badge based on the user's status string AND lastActive time.
 * FIX-OL: If lastActive > 2 minutes ago, always show Offline regardless of status field.
 * @param {string} status - user's status field
 * @param {number|object} [lastActive] - Unix ms or Firestore Timestamp
 */
function statusBadge(status, lastActive) {
  const s = (status || "offline").toLowerCase();

  // FIX-OL: Check staleness — if lastActive > 2 min ago → show as Offline
  const STALE_MS = 2 * 60 * 1000; // 2 minutes
  if (lastActive) {
    let ts = 0;
    if (typeof lastActive === "number") ts = lastActive;
    else if (lastActive?.toMillis) ts = lastActive.toMillis();
    if (ts && (Date.now() - ts) > STALE_MS) {
      return `<span class="status-badge offline">Offline</span>`;
    }
  }

  if (s.includes("focus"))  return `<span class="status-badge focusing">Focusing</span>`;
  if (s === "online" || s === "online")       return `<span class="status-badge online">Online</span>`;
  return `<span class="status-badge offline">Offline</span>`;
}

/**
 * Format a focus time value (stored as minutes in Firestore) to a readable string.
 */
function formatFocusTime(minutes) {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Format a Firestore Timestamp, Date, or Unix ms number to a readable string.
 */
function formatTimestamp(ts) {
  if (!ts) return "—";
  let date;
  if (ts?.toDate) date = ts.toDate();
  else if (typeof ts === "number") date = new Date(ts);
  else if (ts instanceof Date) date = ts;
  else return "—";

  const now   = new Date();
  const diff  = (now - date) / 1000; // seconds ago

  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Escape HTML special characters to prevent XSS in dynamic innerHTML.
 */
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
//  PWA INTEGRATION — code to paste in your PWA's main JS
// ============================================================
/*
  ─────────────────────────────────────────────────────────────
  PASTE THIS CODE IN YOUR PWA's main app JavaScript file.
  It handles live reading of admin broadcasts.

  ⚠️ NOTE: every query below deliberately avoids combining a
  where() with an orderBy() on a DIFFERENT field. That combo
  needs a Firestore composite index — if that index is missing,
  the query fails silently (onSnapshot's error callback fires,
  nothing shows on screen, no visible error to the user). This
  bit us on subscription.html's ticket list, so all listeners
  below sort the small result set client-side instead.
  ─────────────────────────────────────────────────────────────

  import { db, collection, doc, deleteDoc, onSnapshot, query, where, limit, updateDoc } from "./firebase.js";

  // ── 1. Announcement listener (shows banner at top of PWA)
  let lastAnnouncementId = null;
  onSnapshot(
    query(collection(db, "announcements"),
          where("active","==",true),
          limit(5)),
    snap => {
      if (snap.empty) return;
      // Sort client-side (no orderBy → no composite index needed)
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.time || 0) - (a.time || 0));
      const a = docs[0];
      if (a.id === lastAnnouncementId) return; // already shown
      lastAnnouncementId = a.id;
      showAnnouncementBanner(a);
    }
  );

  // ── 2. App Update listener (shows update popup)
  onSnapshot(doc(db, "appUpdates", "latest"), snap => {
    if (!snap.exists() || !snap.data().active) return;
    const u = snap.data();
    showUpdatePopup(u);
  });

  // ── 3. Promotion listener (popup / banner / modal)
  let lastPromoId = null;
  onSnapshot(
    query(collection(db, "promotions"),
          where("active","==",true),
          limit(5)),
    snap => {
      if (snap.empty) return;
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.time || 0) - (a.time || 0));
      const p = docs[0];
      if (p.id === lastPromoId) return;
      lastPromoId = p.id;
      showPromotion(p);
    }
  );

  // ── 4. Personal notification listener (for logged-in user)
  // Also auto-deletes any notification whose expiresAt has passed
  // (e.g. the 24-hour "issue resolved" alert) so it never lingers.
  const currentUser = auth.currentUser;
  if (currentUser) {
    onSnapshot(
      query(collection(db, "notifications"),
            where("target","in",["all", currentUser.displayName || currentUser.uid]),
            limit(20)),
      snap => {
        const now = Date.now();
        snap.docs.forEach(d => {
          const data = d.data();
          // Expired (past its 24h window, or whatever expiresAt was set to) → clean up, don't show
          if (data.expiresAt && data.expiresAt < now) {
            deleteDoc(d.ref).catch(() => {});
            return;
          }
          if (data.read) return; // already shown once
          showInAppNotification(data);
          updateDoc(d.ref, { read: true }); // mark as read
        });
      }
    );
  }

  // ── Update Popup implementation example
  function showUpdatePopup(updateData) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.8);
      z-index:99999;display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `
      <div style="background:#111;border:1px solid rgba(0,224,255,.3);border-radius:16px;
                  padding:32px;max-width:360px;text-align:center;color:#eef0ff;">
        <div style="font-size:48px;margin-bottom:12px;">🚀</div>
        <h2 style="font-size:20px;margin-bottom:8px;">Update Available</h2>
        <p style="color:#888;font-size:13px;margin-bottom:8px;">${updateData.version || ""}</p>
        <pre style="text-align:left;font-size:11px;color:#aaa;background:#0a0a0f;
                    padding:12px;border-radius:8px;margin-bottom:20px;white-space:pre-wrap;">
${updateData.changelog || ""}</pre>
        <button id="updateNowBtn"
          style="background:linear-gradient(135deg,#00e0ff,#7c5cfc);border:none;
                 padding:12px 32px;border-radius:10px;color:#000;font-weight:700;
                 font-size:14px;cursor:pointer;width:100%;">
          Update App
        </button>
        ${updateData.type !== "forced"
          ? `<button onclick="this.closest('div[style]').remove()"
               style="background:none;border:none;color:#555;margin-top:12px;
                      cursor:pointer;font-size:12px;">Dismiss</button>`
          : ""}
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById("updateNowBtn").onclick = async () => {
      document.getElementById("updateNowBtn").innerHTML =
        `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(0,0,0,.2);
                      border-top-color:#000;border-radius:50%;animation:spin .6s linear infinite;
                      margin-right:8px;vertical-align:middle;"></span>Updating…`;
      // Clear service worker cache if applicable
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      setTimeout(() => location.reload(true), 1500);
    };
  }
*/



// ============================================================
//  PROMOTIONS HISTORY
// ============================================================

function listenPromotions() {
  const unsub = onSnapshot(
    query(collection(db, COLL.PROMOTIONS), orderBy("time", "desc"), limit(30)),
    snap => renderPromotionHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error("Promotions listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

function renderPromotionHistory(list) {
  const container = $("promoHistory");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🎯</div>
      <div class="empty-state-text">No promotions sent yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(p => `
    <div class="announce-item">
      <span class="announce-priority p-medium" style="text-transform:capitalize;">${escHtml(p.type || "popup")}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${escHtml(p.title || "—")}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${escHtml(p.body || "")}</div>
        ${p.url ? `<div style="font-size:11px;color:var(--accent-cyan);margin-top:2px;">🔗 ${escHtml(p.url)}</div>` : ""}
        <div class="announce-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${formatTimestamp(p.time)}
          · <span style="color:${p.active ? "var(--accent-green)" : "var(--text-muted)"};">
              ${p.active ? "● Active" : "○ Inactive"}
            </span>
          ${p.page && p.page !== "all" ? ` · 📄 ${escHtml(p.page)}` : ""}
          ${p.user ? ` · 👤 ${escHtml(p.user)}` : ""}</span>
          ${seenBadge(COLL.PROMOTIONS, p.id, "Promotion", p.seenBy)}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
        <button class="announce-delete" onclick="deletePromotion('${p.id}')" title="Delete">✕</button>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:11px;"
                onclick="togglePromoActive('${p.id}', ${!p.active})">
          ${p.active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  `).join("");
}

window.deletePromotion = async id => {
  const yes = await confirmModal("Delete Promotion", "Remove this promotion permanently?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.PROMOTIONS, id));
    toast("Promotion deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

window.togglePromoActive = async (id, active) => {
  try {
    await updateDoc(doc(db, COLL.PROMOTIONS, id), { active });
    toast(active ? "Promotion activated." : "Promotion deactivated.", "info");
  } catch (err) {
    toast("Update failed: " + err.message, "error");
  }
};

// ============================================================
//  APP UPDATES HISTORY
// ============================================================

function listenAppUpdates() {
  const unsub = onSnapshot(
    query(collection(db, COLL.UPDATES), orderBy("time", "desc"), limit(20)),
    snap => renderUpdateHistory(snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.id !== "latest")
    ),
    err => console.error("Updates listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

function renderUpdateHistory(list) {
  const container = $("updateHistory");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🔄</div>
      <div class="empty-state-text">No updates pushed yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(u => `
    <div class="announce-item">
      <span class="announce-priority p-${u.type === "forced" ? "high" : "low"}">${escHtml(u.type || "optional")}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${escHtml(u.version || "—")}</div>
        ${u.changelog ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${escHtml(u.changelog)}</div>` : ""}
        ${u.url ? `<div style="font-size:11px;color:var(--accent-cyan);margin-top:2px;">🔗 ${escHtml(u.url)}</div>` : ""}
        <div class="announce-meta">${formatTimestamp(u.time)}</div>
      </div>
      <button class="announce-delete" onclick="deleteUpdate('${u.id}')" title="Delete">✕</button>
    </div>
  `).join("");
}

window.deleteUpdate = async id => {
  const yes = await confirmModal("Delete Update Record", "Remove this update from history?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.UPDATES, id));
    toast("Update record deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

// ============================================================
//  ROOMS — read from "rooms" collection (live)
// ============================================================

/** Cached rooms list for detail modal */
let _roomsCache = [];

function listenRoomsAdmin() {
  const unsub = onSnapshot(
    collection(db, COLL.ROOMS),
    async snap => {
      const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _roomsCache = rooms;

      // Also update active-room count on dashboard
      const activeCnt = rooms.filter(r => {
        const mc = r.memberCount ?? (r.members ? Object.keys(r.members).length : 0);
        return mc > 0;
      }).length;
      animateStat($("activeRooms"), activeCnt || rooms.length);

      await renderRoomsAdmin(rooms);
    },
    err => console.error("Rooms admin listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

async function renderRoomsAdmin(rooms) {
  const container = $("roomsContainer");
  if (!container) return;

  // FIX-ROOM-MGMT: highlighted/pinned rooms (given a color by an admin) show
  // first, then sort by member count within each group.
  const sorted = [...rooms].sort((a, b) => {
    const mc = r => r.memberCount ?? (r.members ? Object.keys(r.members).length : 0);
    const pinA = a.pinned ? 1 : 0, pinB = b.pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    return mc(b) - mc(a);
  });

  // "+ Create Room" bar always shown at the very top, even with zero rooms.
  const createBar = `
    <div class="room-card" style="cursor:pointer;border:1.5px dashed var(--accent-cyan);
         background:rgba(0,224,255,0.04);display:flex;align-items:center;justify-content:center;
         gap:8px;padding:16px;font-weight:600;color:var(--accent-cyan);"
         onclick="openRoomFormModal()">
      <i class="fa-solid fa-circle-plus"></i> Create Room
    </div>`;

  if (!sorted.length) {
    container.innerHTML = createBar + `<div class="empty-state">
      <div class="empty-state-icon">🏠</div>
      <div class="empty-state-text">No rooms found in Firestore</div>
    </div>`;
    return;
  }

  // For each room, fetch members from STATE.allUsers by matching room field or members map
  container.innerHTML = createBar + sorted.map(room => {
    // Collect member data: room.members = {uid: true} map OR match users with u.room === room.id/name
    let memberIds = [];
    if (room.members && typeof room.members === "object") {
      memberIds = Object.keys(room.members);
    }

    // Match users currently in this room from STATE.allUsers
    const roomName = room.name || room.id;
    const usersInRoom = STATE.allUsers.filter(u =>
      (u.room && (u.room === room.id || u.room === roomName)) ||
      memberIds.includes(u.id)
    );

    const memberCount = room.memberCount ?? usersInRoom.length ?? memberIds.length;
    const isActive    = memberCount > 0;
    const createdAt   = room.createdAt ? formatTimestamp(room.createdAt) : "—";
    const color       = room.color || "";
    const hasPassword = !!room.password;

    return `
    <div class="room-card" onclick="viewRoomDetail('${escHtml(room.id)}')"
         style="${isActive ? 'border-color:rgba(0,229,160,0.25);' : ''}
                ${color ? `box-shadow:inset 3px 0 0 ${escHtml(color)};` : ''}">

      <div style="position:absolute;top:12px;right:12px;display:flex;gap:6px;">
        <button class="room-delete-btn" style="position:static;background:rgba(0,224,255,0.1);
                border-color:rgba(0,224,255,0.25);color:var(--accent-cyan);"
                onclick="event.stopPropagation();openRoomFormModal('${escHtml(room.id)}')"
                title="Edit room">✏️ Edit</button>
        <button class="room-delete-btn" style="position:static;"
                onclick="event.stopPropagation();deleteRoomAdmin('${escHtml(room.id)}','${escHtml(roomName)}')"
                title="Delete room">🗑️</button>
      </div>

      <div class="room-card-header">
        <div class="room-card-title">
          ${color ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${escHtml(color)};margin-right:2px;"></span>` : "🏠"}
          ${escHtml(roomName)}
          ${isActive ? `<span style="background:rgba(0,229,160,.1);color:var(--accent-green);
            border:1px solid rgba(0,229,160,.2);border-radius:99px;
            font-size:10px;font-weight:600;padding:2px 9px;">● Live</span>` : ""}
          ${hasPassword ? `<i class="fa-solid fa-lock" style="font-size:11px;color:var(--text-muted);" title="Password protected"></i>` : ""}
        </div>
        <div class="room-card-meta">
          👥 ${memberCount} member${memberCount !== 1 ? "s" : ""}
          &nbsp;·&nbsp; 📅 ${createdAt}
        </div>
        ${room.note ? `<div style="margin-top:6px;font-size:12px;color:var(--text-secondary);
            background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px;">📝 ${escHtml(room.note)}</div>` : ""}
      </div>

      ${usersInRoom.length ? `
        <div class="room-members-row">
          ${usersInRoom.slice(0, 6).map(u => `
            <div class="room-member-chip">
              <div class="room-member-avatar">${(u.name || "?")[0].toUpperCase()}</div>
              <div>
                <div style="font-size:12px;font-weight:600;">${escHtml(u.name || u.id)}</div>
                <div style="font-size:10px;color:var(--accent-green);">⏱️ ${formatFocusTime(u.focusTime || 0)}</div>
              </div>
            </div>
          `).join("")}
          ${usersInRoom.length > 6 ? `<div style="display:flex;align-items:center;font-size:12px;color:var(--text-muted);padding:8px 12px;">+${usersInRoom.length - 6} more</div>` : ""}
        </div>
      ` : `<div style="font-size:12px;color:var(--text-muted);">No users currently active · Click to view chats</div>`}

      <div style="margin-top:12px;font-size:11px;color:var(--accent-cyan);opacity:.7;">
        Tap to view room chats →
      </div>
    </div>
    `;
  }).join("");
}

// ============================================================
//  ROOM CREATE / EDIT MODAL
//  Self-contained (built entirely in JS, no HTML markup needed in either
//  admin page) so this works identically in both the Sub-Admin and main
//  SGPAdmin panels, since both load this same admin.js file.
// ============================================================
window.openRoomFormModal = (roomId) => {
  const editing = !!roomId;
  const room = editing ? (_roomsCache.find(r => r.id === roomId) || {}) : {};
  const existing = document.getElementById("roomFormModalOverlay");
  if (existing) existing.remove();

  const swatches = ["#6C63EC", "#38BDF8", "#00E5A0", "#FFB830", "#FF5C7A", "#A855F7"];

  const overlay = document.createElement("div");
  overlay.id = "roomFormModalOverlay";
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);`;
  overlay.innerHTML = `
    <div style="background:var(--bg-card,#141824);border:1px solid var(--border,rgba(255,255,255,0.08));
         border-radius:16px;padding:22px;width:100%;max-width:380px;max-height:88vh;overflow-y:auto;">
      <div style="font-size:17px;font-weight:700;margin-bottom:16px;">
        ${editing ? "✏️ Edit Room" : "➕ Create Room"}
      </div>

      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px;">Room name</label>
      <input id="rfRoomName" type="text" value="${escHtml(room.name || (editing ? roomId : ""))}"
        placeholder="e.g. Evening Study Group"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;margin-bottom:14px;
        background:rgba(255,255,255,0.04);border:1px solid var(--border,rgba(255,255,255,0.1));color:inherit;font-size:14px;">

      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px;">Highlight color (pins room to top)</label>
      <div id="rfColorRow" style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        ${swatches.map(c => `
          <div data-color="${c}" onclick="document.getElementById('rfColorValue').value='${c}';
            document.querySelectorAll('#rfColorRow > div').forEach(d=>d.style.outline='none');
            this.style.outline='2px solid #fff';"
            style="width:26px;height:26px;border-radius:50%;background:${c};cursor:pointer;
            outline:${room.color === c ? '2px solid #fff' : 'none'};outline-offset:2px;"></div>
        `).join("")}
        <div onclick="document.getElementById('rfColorValue').value='';
             document.querySelectorAll('#rfColorRow > div').forEach(d=>d.style.outline='none');"
             style="width:26px;height:26px;border-radius:50%;cursor:pointer;
             border:1.5px dashed var(--text-muted);display:flex;align-items:center;justify-content:center;
             font-size:13px;color:var(--text-muted);" title="No highlight">✕</div>
      </div>
      <input type="hidden" id="rfColorValue" value="${room.color || ''}">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px;">No color = normal room, not pinned to top.</div>

      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px;">Note (shown to admins, short)</label>
      <textarea id="rfNote" rows="2" maxlength="140" placeholder="e.g. Reserved for NEET batch, quiet hours 6–9 PM"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;margin-bottom:14px;
        background:rgba(255,255,255,0.04);border:1px solid var(--border,rgba(255,255,255,0.1));color:inherit;
        font-size:13px;resize:vertical;">${escHtml(room.note || "")}</textarea>

      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px;">Password (optional — leave blank for no password)</label>
      <input id="rfPassword" type="text" value="${escHtml(room.password || "")}" placeholder="Leave blank for open room"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;margin-bottom:18px;
        background:rgba(255,255,255,0.04);border:1px solid var(--border,rgba(255,255,255,0.1));color:inherit;font-size:14px;">

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('roomFormModalOverlay').remove();"
          style="flex:1;padding:11px;border-radius:8px;border:1px solid var(--border,rgba(255,255,255,0.1));
          background:none;color:var(--text-secondary);font-weight:600;cursor:pointer;">Cancel</button>
        <button onclick="saveRoomAdmin(${editing ? `'${escHtml(roomId)}'` : 'null'})"
          style="flex:1;padding:11px;border-radius:8px;border:none;
          background:var(--accent-cyan);color:#001;font-weight:700;cursor:pointer;">
          ${editing ? "Save Changes" : "Create Room"}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
};

window.saveRoomAdmin = async (roomId) => {
  const name     = document.getElementById("rfRoomName")?.value.trim();
  const color    = document.getElementById("rfColorValue")?.value.trim();
  const note     = document.getElementById("rfNote")?.value.trim().slice(0, 140);
  const password = document.getElementById("rfPassword")?.value.trim();

  if (!name) { toast("Please enter a room name.", "error"); return; }

  // FIX-ROOM-MGMT: slugify the name into an ID for new rooms (lowercase,
  // hyphenated, alnum only) so it matches the same id format timer.html
  // already expects for room links/joins.
  const id = roomId || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `room-${Date.now()}`;

  try {
    const payload = {
      name,
      color: color || null,
      pinned: !!color,
      note: note || null,
      password: password || null,
      updatedAt: serverTimestamp()
    };
    if (!roomId) payload.createdAt = serverTimestamp();
    await setDoc(doc(db, COLL.ROOMS, id), payload, { merge: true });
    document.getElementById("roomFormModalOverlay")?.remove();
    toast(roomId ? "Room updated." : `Room "${name}" created.`, "success");
  } catch (err) {
    toast("Save failed: " + err.message, "error");
  }
};

/** Open room detail modal — shows member list + recent chats */
window.viewRoomDetail = async (roomId) => {
  const room = _roomsCache.find(r => r.id === roomId);
  if (!room) return;

  const roomName = room.name || room.id;
  $("roomDetailTitle").textContent = `🏠 ${roomName}`;

  // Delete button wires up to this room
  $("roomDeleteBtn").onclick = () => {
    closeRoomModal();
    deleteRoomAdmin(roomId, roomName);
  };

  $("roomDetailBody").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Loading…</div>`;
  $("roomDetailModal").classList.add("open");

  // Fetch members
  const usersInRoom = STATE.allUsers.filter(u => {
    let memberIds = [];
    if (room.members && typeof room.members === "object") memberIds = Object.keys(room.members);
    return (u.room && (u.room === roomId || u.room === roomName)) || memberIds.includes(u.id);
  });

  // Fetch recent chats for this room
  let chats = [];
  try {
    const snap = await getDocs(
      query(
        collection(db, COLL.MESSAGES),
        where("room", "in", [roomId, roomName]),
        orderBy("time", "desc"),
        limit(30)
      )
    );
    chats = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
  } catch (e) {
    // fallback: try without where clause if index missing
    try {
      const snap2 = await getDocs(query(collection(db, COLL.MESSAGES), orderBy("time", "desc"), limit(100)));
      chats = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.room === roomId || m.room === roomName)
        .reverse()
        .slice(-30);
    } catch {}
  }

  const memberCount = room.memberCount ?? usersInRoom.length;

  $("roomDetailBody").innerHTML = `
    <!-- Members -->
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);
        text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;">
        👥 Members (${memberCount})
      </div>
      ${usersInRoom.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${usersInRoom.map(u => `
            <div style="
              background:var(--bg-input);border:1px solid rgba(0,229,160,.2);
              border-radius:10px;padding:8px 12px;
              display:flex;align-items:center;gap:8px;
            ">
              <div style="
                width:28px;height:28px;border-radius:50%;
                background:linear-gradient(135deg,var(--accent-green),var(--accent-cyan));
                display:flex;align-items:center;justify-content:center;
                font-size:11px;font-weight:700;color:#000;
              ">${(u.name || "?")[0].toUpperCase()}</div>
              <div>
                <div style="font-size:12px;font-weight:600;">${escHtml(u.name || u.id)}</div>
                <div style="font-size:10px;color:var(--accent-green);">⏱️ ${formatFocusTime(u.focusTime || 0)}</div>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div style="font-size:13px;color:var(--text-muted);">No active members</div>`}
    </div>

    <!-- Chats -->
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--text-secondary);
        text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;">
        💬 Recent Chats (${chats.length})
      </div>
      ${chats.length ? `
        <div style="display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto;
          background:var(--bg-input);border-radius:10px;padding:12px;border:1px solid var(--border);">
          ${chats.map(m => `
            <div class="msg-bubble">
              <div class="msg-avatar">${(m.from || m.sender || "?")[0].toUpperCase()}</div>
              <div class="msg-body">
                <div class="msg-meta">
                  <span class="msg-sender">${escHtml(m.from || m.sender || "Unknown")}</span>
                  <span class="msg-time">${formatTimestamp(m.time || m.timestamp)}</span>
                </div>
                <div class="msg-text">${escHtml(m.text || "")}</div>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div style="font-size:13px;color:var(--text-muted);">No messages in this room yet</div>`}
    </div>
  `;
};

window.closeRoomModal = () => {
  $("roomDetailModal").classList.remove("open");
};

window.deleteRoomAdmin = async (roomId, roomName) => {
  const yes = await confirmModal(
    "Delete Room",
    `Permanently delete room "${roomName}"? This will remove the room document from Firestore.`
  );
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.ROOMS, roomId));
    toast(`Room "${roomName}" deleted.`, "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

// ============================================================
//  LEADERBOARD — two tabs: Full (XP+Level+Badge) | Timer (Focus Time)
// ============================================================

/** Which tab is active: 'full' or 'timer' */
let _lbTab = "full";

/** Badge thresholds (same as uw-core.js) */
function adminGetBadge(xp) {
  if (xp >= 500) return "🏆 Grid Champion";
  if (xp >= 300) return "⚡ Study Master";
  if (xp >= 150) return "🔥 Focused Learner";
  if (xp >= 50)  return "⭐ Rising Learner";
  return          "🏅 Beginner";
}

/** Level from XP (same thresholds as uw-core.js) */
function adminGetLevel(xp) {
  const t = [0, 100, 250, 500, 800, 1200, 1700, 2300];
  for (let i = t.length - 1; i >= 0; i--) {
    if (xp >= t[i]) return i + 1;
  }
  return 1;
}

/** Switch between Full and Timer tabs */
// ============================================================
//  LEADERBOARD TIME RANGES — Today / This Week / All Time
//
//  FIX-RANGE-AUDIT: previously this snapshotted each user's cumulative XP
//  once per day into leaderboardSnapshots/{date} and showed the delta from
//  that snapshot. That was fragile in three ways: (1) it silently fell back
//  to showing the full LIFETIME total whenever no snapshot existed for the
//  exact reference day (e.g. admin didn't open the panel that day) — making
//  "Today"/"This Week" look identical to "All Time" with no warning that
//  mattered to the admin; (2) the snapshot key used UTC dates
//  (toISOString) while every other date-keyed field in this app uses the
//  local calendar day, so near midnight IST it could attribute a day's
//  numbers to the wrong bucket; (3) the "today" baseline was only captured
//  whenever an admin first happened to open the panel that day — usually
//  well after midnight — so anything earned before that got excluded from
//  "today" entirely.
//
//  Now it just reads the fields the app already keeps correctly scoped:
//    - todayTimerXP / focusTime (guarded by lastFocusResetDate) → reset
//      every night at midnight, maintained by script.js.
//    - weeklyTimerXP / weeklyXP / weeklyFocusTime → reset every week,
//      maintained by script.js + uw-core.js.
//  No snapshot, no "no baseline yet" fallback, no drift — it's exactly as
//  accurate as the live per-user data.
// ============================================================
let _lbRange = "all"; // 'today' | 'week' | 'all'

/** Returns { xp, timerXP, focusTime, partial } for the selected admin range. */
function computeLbRangeValues(u) {
  if (_lbRange === "today") {
    return {
      xp: 0, // study (playlist/todo) XP has no daily granularity anywhere in the app yet
      timerXP: Number(u.todayTimerXP || 0),
      focusTime: Number(u._todayFocusMin || 0),
      partial: true
    };
  }
  if (_lbRange === "week") {
    return {
      xp: Number(u.weeklyXP || 0),
      timerXP: Number(u.weeklyTimerXP || 0),
      focusTime: Number(u.weeklyFocusTime || 0),
      partial: false
    };
  }
  // all
  return {
    xp: Number(u.xp ?? u.totalXP ?? u.points ?? 0),
    timerXP: Number(u.timerXP || 0),
    focusTime: Number(u.focusTime || u.totalFocusTime || u.timerMinutes || 0),
    partial: false
  };
}

window.setLbRange = async function (range) {
  _lbRange = range;
  ["lbRangeToday", "lbRangeWeek", "lbRangeAll"].forEach(id => {
    const btn = $(id);
    if (!btn) return;
    const active = id === `lbRange${range[0].toUpperCase()}${range.slice(1)}`;
    btn.style.background = active ? "rgba(0,224,255,0.15)" : "none";
    btn.style.color = active ? "var(--accent-cyan)" : "var(--text-secondary)";
  });
  renderLeaderboardSection();
};

window.switchLbTab = function(tab) {
  _lbTab = tab;

  const btnFull  = document.getElementById("lbTabFull");
  const btnTimer = document.getElementById("lbTabTimer");
  const title    = document.getElementById("lbTableTitle");

  if (tab === "full") {
    if (btnFull)  { btnFull.style.background  = "rgba(0,224,255,0.1)"; btnFull.style.color  = "var(--accent-cyan)";      btnFull.style.borderColor  = "rgba(0,224,255,0.25)"; }
    if (btnTimer) { btnTimer.style.background = "none";                btnTimer.style.color = "var(--text-secondary)";   btnTimer.style.borderColor = "var(--border)"; }
    if (title)    title.innerHTML = "<i class=\"fa-solid fa-trophy\"></i> Full Leaderboard — Combined XP (Playlist + Todo + Timer)";
  } else {
    if (btnTimer) { btnTimer.style.background = "rgba(124,92,252,0.12)"; btnTimer.style.color = "var(--accent-violet)"; btnTimer.style.borderColor = "rgba(124,92,252,0.3)"; }
    if (btnFull)  { btnFull.style.background  = "none";                  btnFull.style.color  = "var(--text-secondary)"; btnFull.style.borderColor  = "var(--border)"; }
    if (title)    title.innerHTML = '<i class="fa-solid fa-stopwatch"></i> Timer Leaderboard — Ranked by Focus Time';
  }

  renderLeaderboardSection();
};



function listenLeaderboard() {
  // Listen directly to the "leaderboard" collection which uw-core.js keeps updated.
  // FIX-MISSING-DOCS: no orderBy('xp') — Firestore silently excludes any
  // document missing that field entirely, which made timer-only users
  // (whose leaderboard doc never got an `xp` field written, since they've
  // never opened playlist/todo) invisible in both the Full and Timer
  // leaderboard tabs here. renderFullLeaderboard/renderTimerLeaderboard
  // already sort correctly on the client afterward, so this was redundant.
  const unsub = onSnapshot(
    query(collection(db, "leaderboard"), limit(300)),
    snap => {
      STATE.leaderboardData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLeaderboardSection();
    },
    err => {
      console.warn("[Leaderboard] collection listen failed, falling back to users:", err);
      // Fallback: already rendered from STATE.allUsers in listenUsers
    }
  );
  STATE.unsubscribers.push(unsub);
}

async function renderLeaderboardSection() {
  const container = $("leaderboardContainer");
  if (!container) return;

  // Prefer dedicated leaderboard collection (populated by uw-core.js)
  // Merge with allUsers for status info
  const lbData = STATE.leaderboardData || [];
  const hasLbData = lbData.length > 0;

  if (!hasLbData && !STATE.allUsers.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-trophy"></i></div>
      <div class="empty-state-text">No users yet</div>
    </div>`;
    return;
  }

  if (_lbTab === "timer") {
    await renderTimerLeaderboard(container);
  } else {
    await renderFullLeaderboard(container);
  }
}

/** Full Leaderboard: sorted by COMBINED XP (playlist+todo from uw-core + timer from script.js) */
async function renderFullLeaderboard(container) {
  // Use leaderboard collection — combine xp (playlist+todo from uw-core.js)
  // + timerXP (focus from script.js) for COMBINED total ranking
  let users;
  if (STATE.leaderboardData && STATE.leaderboardData.length > 0) {
    users = [...STATE.leaderboardData].map(lb => {
      const u = STATE.allUsers.find(u => u.id === lb.id) || {};
      const studyXP = Number(lb.xp || 0);
      const timerXP = Number(lb.timerXP || 0);
      // FIX-FIELD-COLLISION: compute today's focus minutes from the pure
      // users-doc record BEFORE merging — `lb.focusTime` (cumulative) would
      // otherwise silently overwrite `u.focusTime` (daily) after the spread.
      return { ...u, ...lb, id: lb.id, liveStudyXP: studyXP, liveTimerXP: timerXP, _todayFocusMin: todaysFocusMinutes(u) };
    });
  } else {
    users = [...STATE.allUsers].map(u => {
      const studyXP = Number(u.xp ?? u.totalXP ?? u.points ?? 0);
      const timerXP = Number(u.timerXP || 0);
      return { ...u, liveStudyXP: studyXP, liveTimerXP: timerXP, _todayFocusMin: todaysFocusMinutes(u) };
    });
  }

  let partialCount = 0;
  for (const u of users) {
    const r = computeLbRangeValues(u);
    u.studyXP = r.xp;
    u.timerXP = r.timerXP;
    u.totalXP = r.xp + r.timerXP;
    if (r.partial) partialCount++;
  }
  users = users.sort((a, b) => b.totalXP - a.totalXP).slice(0, 100);

  if (!users.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-trophy"></i></div>
      <div class="empty-state-text">No users found</div>
    </div>`;
    return;
  }

  const rangeBanner = _lbRange === "today" && partialCount > 0 ? `
    <div style="padding:10px 16px;background:rgba(255,184,48,0.08);border:1px solid rgba(255,184,48,0.25);
      border-radius:8px;margin-bottom:14px;font-size:12.5px;color:var(--accent-amber);">
      <i class="fa-solid fa-circle-info"></i> "Today" shows focus-timer XP only — study (playlist/todo) XP isn't tracked per-day, only weekly and lifetime.
    </div>` : "";

  const medals = ['<i class="fa-solid fa-medal" style="color:#FFD700;"></i>', '<i class="fa-solid fa-medal" style="color:#C0C0C0;"></i>', '<i class="fa-solid fa-medal" style="color:#CD7F32;"></i>'];

  container.innerHTML = rangeBanner + `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Rank</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">User</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Total XP</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Breakdown</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Level</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Streak</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((u, i) => {
          const totalXP = u.totalXP || 0;
          const studyXP = u.studyXP || 0;
          const timerXP = u.timerXP || 0;
          const level   = adminGetLevel(totalXP);
          const badge   = adminGetBadge(totalXP);
          const streak  = u.streak ?? u.currentStreak ?? 0;
          const rank    = medals[i] || `#${i + 1}`;
          const name    = escHtml(u.name || u.displayName || "—");
          const email   = escHtml(u.email || "");
          const initials = (u.name || u.displayName || u.email || "?")[0].toUpperCase();
          return `
          <tr style="border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
            <td style="padding:12px;font-size:16px;">${rank}</td>
            <td style="padding:12px;">
              <div class="user-cell">
                <div class="user-avatar-sm">${initials}</div>
                <div>
                  <div style="font-weight:600;font-size:13px;">${name}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${email}</div>
                </div>
              </div>
            </td>
            <td style="padding:12px;font-family:var(--font-mono);color:var(--accent-amber);font-weight:700;"><i class="fa-solid fa-bolt"></i> ${totalXP}</td>
            <td style="padding:12px;">
              <div style="font-size:11px;color:var(--text-muted);line-height:1.6;">
                <div><i class="fa-solid fa-book"></i> ${studyXP} study</div>
                <div><i class="fa-solid fa-stopwatch"></i> ${timerXP} focus</div>
              </div>
            </td>
            <td style="padding:12px;">
              <div>
                <span style="background:rgba(124,92,252,0.15);color:var(--accent-violet);
                  border:1px solid rgba(124,92,252,0.3);border-radius:20px;
                  padding:3px 12px;font-size:12px;font-weight:700;">Lv.${level}</span>
                <div style="font-size:11px;margin-top:3px;color:var(--text-muted);">${badge}</div>
              </div>
            </td>
            <td style="padding:12px;font-family:var(--font-mono);font-size:12px;color:var(--accent-amber);">🔥 ${streak}</td>
            <td style="padding:12px;">${statusBadge(u.status, u.lastActive)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

/** Timer Leaderboard: sorted by focusTime — shows ONLY timer XP (not combined XP) */
async function renderTimerLeaderboard(container) {
  // Prefer leaderboard collection (has timerXP + focusTime written by script.js)
  // Fall back to allUsers if leaderboard collection has no focusTime data yet
  let source;
  if (STATE.leaderboardData && STATE.leaderboardData.some(u => (u.focusTime || 0) > 0)) {
    source = STATE.leaderboardData;
  } else {
    source = STATE.allUsers;
  }

  let users = [...source].map(u => {
    const usersRec = source === STATE.leaderboardData
      ? (STATE.allUsers.find(x => x.id === u.id) || {})
      : u;
    const lbRec = source === STATE.leaderboardData
      ? u
      : (STATE.leaderboardData?.find(x => x.id === u.id) || {});
    return { ...usersRec, ...lbRec, id: u.id, _todayFocusMin: todaysFocusMinutes(usersRec) };
  });

  let partialCount = 0;
  for (const u of users) {
    const r = computeLbRangeValues(u);
    u.timerXP = r.timerXP;
    u.focusTime = r.focusTime;
    if (r.partial) partialCount++;
  }

  users = users.filter(u => u.focusTime > 0).sort((a, b) => b.focusTime - a.focusTime).slice(0, 100);

  if (!users.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-stopwatch"></i></div>
      <div class="empty-state-text">No focus sessions recorded ${_lbRange === "all" ? "yet" : "in this range yet"}</div>
    </div>`;
    return;
  }

  const rangeBanner = "";

  const medals = ['<i class="fa-solid fa-medal" style="color:#FFD700;"></i>', '<i class="fa-solid fa-medal" style="color:#C0C0C0;"></i>', '<i class="fa-solid fa-medal" style="color:#CD7F32;"></i>'];

  container.innerHTML = rangeBanner + `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Rank</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">User</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Focus Time</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Weekly XP</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Level</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((u, i) => {
          const ft      = u.focusTime || 0;
          const timerXP = u.timerXP || 0;
          const level   = adminGetLevel(timerXP);
          const badge   = adminGetBadge(timerXP);
          const rank    = medals[i] || `#${i + 1}`;
          const name    = escHtml(u.name || u.displayName || "—");
          const email   = escHtml(u.email || "");
          const initials = (u.name || u.displayName || u.email || "?")[0].toUpperCase();
          return `
          <tr style="border-bottom:1px solid var(--border);transition:background .15s;"
              onmouseover="this.style.background='rgba(255,255,255,.03)'"
              onmouseout="this.style.background='transparent'">
            <td style="padding:12px;font-size:16px;">${rank}</td>
            <td style="padding:12px;">
              <div class="user-cell">
                <div class="user-avatar-sm">${initials}</div>
                <div>
                  <div style="font-weight:600;font-size:13px;">${name}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${email}</div>
                </div>
              </div>
            </td>
            <td style="padding:12px;font-family:var(--font-mono);color:var(--accent-cyan);font-weight:700;">${formatFocusTime(ft)}</td>
            <td style="padding:12px;font-family:var(--font-mono);color:var(--accent-amber);font-weight:700;">⏱ ${timerXP}</td>
            <td style="padding:12px;">
              <span style="background:rgba(124,92,252,0.15);color:var(--accent-violet);
                border:1px solid rgba(124,92,252,0.3);border-radius:20px;
                padding:3px 12px;font-size:12px;font-weight:700;">Lv.${level}</span>
            </td>
            <td style="padding:12px;">${statusBadge(u.status, u.lastActive)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

/** Format last active time */
function formatLastActive(u) {
  if (!u) return "—";

  let ts = 0;

  if (typeof u.lastActive === "number") {
    ts = u.lastActive;
  } else if (u.lastActive?.toMillis) {
    ts = u.lastActive.toMillis();
  }

  if (!ts) return "—";

  const now  = Date.now();
  const diff = now - ts;

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(diff / 60000);
  const hr  = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (sec < 60)  return `<span style="color:var(--accent-green)">${sec} sec ago</span>`;
  if (min < 60)  return `<span style="color:var(--text-secondary)">${min} min ago</span>`;
  if (hr  < 24)  return `<span style="color:var(--text-muted)">${hr} hr ago</span>`;
  if (day < 7)   return `<span style="color:var(--text-muted)">${day} day ago</span>`;

  return `<span style="color:var(--text-muted)">${new Date(ts).toLocaleString()}</span>`;
}

/**
 * Format the last page a user was on.
 * Reads currentPage / page / activePage field from the user doc.
 */
function formatLastPage(u) {
  if (!u) return "—";
  const pageName = u.currentPage || u.page || u.activePage || "";
  if (!pageName) return `<span style="color:var(--text-muted);">—</span>`;
  const p = pageName.toLowerCase();
  if (p.includes("timer"))                                 return `<span title="${escHtml(pageName)}">⏱️ Timer</span>`;
  if (p.includes("todo"))                                  return `<span title="${escHtml(pageName)}">✅ To-Do</span>`;
  if (p.includes("playlist"))                              return `<span title="${escHtml(pageName)}">🎵 Playlist</span>`;
  if (p.includes("profile"))                               return `<span title="${escHtml(pageName)}">👤 Profile</span>`;
  if (p.includes("leaderboard") && p.includes("full"))     return `<span title="${escHtml(pageName)}">🏅 Full LB</span>`;
  if (p.includes("leaderboard"))                           return `<span title="${escHtml(pageName)}">🏆 Leaderboard</span>`;
  if (p.includes("progress"))                              return `<span title="${escHtml(pageName)}">📊 Progress</span>`;
  if (p.includes("mock"))                                  return `<span title="${escHtml(pageName)}">📝 Mock</span>`;
  if (p.includes("dashboard-home") || p.includes("home") || p === "index" || p.includes("index")) return `<span title="${escHtml(pageName)}">🏠 Home</span>`;
  return `<span title="${escHtml(pageName)}" style="color:var(--text-muted);">📄 ${escHtml(pageName.replace(/\.html$/i,""))}</span>`;
}

// ============================================================
//  FEAT-3: MUSIC TRACKS (Admin-managed, shown in timer.html)
// ============================================================

/**
 * Real-time listener on "musicTracks" collection.
 * Renders the list in the Music section.
 */
function listenMusicTracks() {
  const unsub = onSnapshot(
    query(collection(db, COLL.MUSIC), orderBy("time", "desc")),
    snap => renderMusicTracks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error("Music listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

function renderMusicTracks(list) {
  const container = $("musicTrackList");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🎵</div>
      <div class="empty-state-text">No tracks added yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(t => `
    <div class="announce-item">
      <span style="font-size:22px;flex-shrink:0;">${escHtml(t.emoji || "🎵")}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${escHtml(t.title || "Untitled")}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${escHtml(t.subtitle || "")}</div>
        <div class="announce-meta">
          <a href="${escHtml(t.url || "#")}" target="_blank"
             style="color:var(--accent-cyan);font-size:11px;word-break:break-all;">
            ${escHtml(t.url || "—")}
          </a>
          &nbsp;·&nbsp;${formatTimestamp(t.time)}
        </div>
      </div>
      <button class="announce-delete" onclick="deleteMusicTrack('${t.id}')" title="Delete">✕</button>
    </div>
  `).join("");
}

/**
 * Add a new track document to Firestore.
 * timer.html listens on this collection and shows the tracks.
 */
window.addMusicTrack = async () => {
  const title    = ($("musicTitle")?.value    || "").trim();
  const url      = ($("musicUrl")?.value      || "").trim();
  const subtitle = ($("musicSubtitle")?.value || "").trim();
  const emoji    = ($("musicEmoji")?.value    || "🎵").trim();
  const btn      = $("musicAddBtn");

  if (!title) { toast("Enter a track title.", "warning"); return; }
  if (!url)   { toast("Enter a YouTube URL.", "warning"); return; }

  // Extract YouTube video ID for validation
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?/\s]{11})/);
  if (!m) { toast("❌ Invalid YouTube URL", "error"); return; }

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Adding…`;

  try {
    await addDoc(collection(db, COLL.MUSIC), {
      title,
      subtitle:  subtitle || "Admin Track",
      emoji,
      url,
      videoId:   m[1],
      active:    true,
      time:      Date.now(),
      createdAt: serverTimestamp()
    });

    toast(`Track "${title}" added! It will appear in the Focus Timer. 🎵`, "success");
    $("musicTitle").value    = "";
    $("musicUrl").value      = "";
    $("musicSubtitle").value = "";
    $("musicEmoji").value    = "🎵";
  } catch (err) {
    console.error("Music add error:", err);
    toast("Failed to add track: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "➕ Add Track";
  }
};

window.deleteMusicTrack = async id => {
  const yes = await confirmModal("Delete Track", "Remove this track from the timer music list?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.MUSIC, id));
    toast("Track deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

// ============================================================
//  VIDEO PROMOTIONS
// ============================================================

function listenVideoPromos() {
  const unsub = onSnapshot(
    query(collection(db, COLL.VIDEO_PROMOS), orderBy("time", "desc"), limit(30)),
    snap => renderVideoPromos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => console.error("VideoPromos listener error:", err)
  );
  STATE.unsubscribers.push(unsub);
}

function renderVideoPromos(list) {
  const container = $("vpHistory");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">▶️</div>
      <div class="empty-state-text">No video promotions sent yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(v => `
    <div class="announce-item">
      <span style="font-size:22px;flex-shrink:0;">▶️</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${escHtml(v.title || "Untitled Video Promo")}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${escHtml(v.body || "")}</div>
        <div class="announce-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>
            <a href="${escHtml(v.videoUrl || "#")}" target="_blank"
               style="color:var(--accent-cyan);font-size:11px;word-break:break-all;">
              ${escHtml(v.videoUrl || "—")}
            </a>
            &nbsp;·&nbsp; ${formatTimestamp(v.time)}
            &nbsp;·&nbsp; 📄 ${escHtml(v.page || "all")}
            ${v.delay ? `&nbsp;·&nbsp; ⏱ delay: ${v.delay}s` : ""}
            ${v.duration ? `&nbsp;·&nbsp; ⏳ ${v.duration}s` : ""}
            &nbsp;·&nbsp; <span style="color:${v.active ? "var(--accent-green)" : "var(--text-muted)"}">
              ${v.active ? "● Active" : "○ Inactive"}
            </span>
          </span>
          ${seenBadge(COLL.VIDEO_PROMOS, v.id, "Video Promotion", v.seenBy)}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
        <button class="announce-delete" onclick="deleteVideoPromo('${v.id}')" title="Delete">✕</button>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:11px;"
                onclick="toggleVideoPromoActive('${v.id}', ${!v.active})">
          ${v.active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  `).join("");
}


window.sendVideoPromo = async () => {
  const videoUrl  = ($("vpVideoUrl")?.value  || "").trim();
  const title     = ($("vpTitle")?.value     || "").trim();
  const body      = ($("vpBody")?.value      || "").trim();
  const cta       = ($("vpCTA")?.value       || "").trim();
  const ctaUrl    = ($("vpCtaUrl")?.value    || "").trim();
  const page      = $("vpPage")?.value       || "all";
  const platform  = $("vpPlatform")?.value   || "both";
  const delay     = parseInt($("vpDelay")?.value    || "0", 10);
  const duration  = parseInt($("vpDuration")?.value || "0", 10);
  const btn       = $("vpBtn");

  const targetType    = $("vpTarget").value;
  const selectedUser  = ($("vpUser")?.value || "").trim();

  if (!videoUrl) { toast("Please enter a video URL.", "warning"); return; }
  if (targetType === "user" && !selectedUser) { toast("Please enter a target username or email.", "warning"); return; }

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Sending…`;

  const finalTarget = targetType === "user" && selectedUser ? selectedUser : "all";

  try {
    await addDoc(collection(db, COLL.VIDEO_PROMOS), {
      videoUrl,
      title:    title  || "",
      body:     body   || "",
      cta:      cta    || "",
      ctaUrl:   ctaUrl || null,
      page,
      platform,
      target:   finalTarget,
      user:     targetType === "user" && selectedUser ? selectedUser : null,
      delay,
      duration,
      active:    true,
      time:      Date.now(),
      createdAt: serverTimestamp()
    });

    toast("Video promotion sent! ▶️", "success");
    $("vpVideoUrl").value = "";
    $("vpTitle").value    = "";
    $("vpBody").value     = "";
    $("vpCTA").value      = "";
    $("vpCtaUrl").value   = "";
    if ($("vpUser")) $("vpUser").value = "";
  } catch (err) {
    console.error("VideoPromo send error:", err);
    toast("Failed to send: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "▶️ Send Video Promotion";
  }
};

window.deleteVideoPromo = async id => {
  const yes = await confirmModal("Delete Video Promotion", "Remove this video promotion permanently?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.VIDEO_PROMOS, id));
    toast("Video promotion deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

window.toggleVideoPromoActive = async (id, active) => {
  try {
    await updateDoc(doc(db, COLL.VIDEO_PROMOS, id), { active });
    toast(active ? "Video promo activated." : "Video promo deactivated.", "info");
  } catch (err) {
    toast("Update failed: " + err.message, "error");
  }
};

// ============================================================
//  MAINTENANCE ANNOUNCEMENT
//  Admin can push a "App Under Maintenance" popup to all users.
//  - No dismiss button: users cannot close it
//  - Duration: admin sets how long it shows (0 = until manually removed)
//  - Delete from history = immediately removes popup from all user devices
// ============================================================

function listenMaintenance() {
  // Listen to history collection for admin panel display
  const histUnsub = onSnapshot(
    query(collection(db, COLL.MAINTENANCE + "History"), orderBy("sentAt", "desc"), limit(20)),
    snap => renderMaintenanceHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    // If custom collection doesn't exist yet, fail silently
    err => { if (err.code !== "permission-denied") console.warn("Maintenance history:", err); }
  );
  STATE.unsubscribers.push(histUnsub);

  // Listen to current active maintenance doc for real-time status display
  const curUnsub = onSnapshot(
    doc(db, COLL.MAINTENANCE, "current"),
    snap => {
      const statusEl = $("maintenanceStatus");
      if (!statusEl) return;
      if (snap.exists() && snap.data().active) {
        const d = snap.data();
        statusEl.innerHTML = `
          <div style="
            display:flex;align-items:center;gap:10px;
            background:rgba(255,184,48,.08);border:1px solid rgba(255,184,48,.25);
            border-radius:10px;padding:12px 16px;
          ">
            <span style="font-size:18px;">⚠️</span>
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--accent-amber);">MAINTENANCE ACTIVE</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${escHtml(d.heading || "App Under Maintenance")} — ${d.durationMinutes ? d.durationMinutes + ' min' : 'Until removed'}</div>
            </div>
            <button class="btn btn-danger" style="margin-left:auto;padding:6px 14px;font-size:12px;"
                    onclick="clearMaintenance()">✕ Clear Now</button>
          </div>`;
      } else {
        statusEl.innerHTML = `
          <div style="
            display:flex;align-items:center;gap:8px;
            background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.15);
            border-radius:10px;padding:10px 14px;
            font-size:12px;color:var(--accent-green);
          ">
            <span>✅</span> No active maintenance — app is running normally
          </div>`;
      }
    },
    err => { if (err.code !== "permission-denied") console.warn("Maintenance current:", err); }
  );
  STATE.unsubscribers.push(curUnsub);
}

function renderMaintenanceHistory(list) {
  const container = $("maintenanceHistory");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🔧</div>
      <div class="empty-state-text">No maintenance announcements sent yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(m => `
    <div class="announce-item" style="border-left:3px solid rgba(0,180,255,0.35);">
      <span style="font-size:22px;flex-shrink:0;">🔧</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;color:var(--accent-cyan);">${escHtml(m.heading || "App Under Maintenance")}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;white-space:pre-wrap;">${escHtml(m.message || "")}</div>
        <div class="announce-meta" style="margin-top:6px;">
          ${formatTimestamp(m.sentAt || m.time)}
          ${m.durationMinutes ? ` &nbsp;·&nbsp; ⏱ ${m.durationMinutes} min` : " &nbsp;·&nbsp; ⏱ Until removed"}
        </div>
      </div>
      <button class="announce-delete"
              onclick="deleteMaintenanceRecord('${m.id}')"
              title="Delete this maintenance record (also clears from user devices if still active)">✕</button>
    </div>
  `).join("");
}

window.sendMaintenance = async () => {
  const heading         = ($("maintHeading")?.value         || "").trim();
  const message         = ($("maintMessage")?.value         || "").trim();
  const durationMinutes = parseInt($("maintDuration")?.value || "0", 10);
  const platform        = $("maintPlatform")?.value          || "both";
  const excludeUser     = $("maintExcludeUser")?.value       || "";
  const btn             = $("maintBtn");

  if (!message) { toast("Please write a maintenance message.", "warning"); return; }

  const platformNote = platform === "pwa" ? " (PWA only)" : platform === "web" ? " (Website only)" : "";
  const yes = await confirmModal(
    "🔧 Push Maintenance Announcement",
    `This will immediately show a full-screen popup on ALL user devices${platformNote} that cannot be closed.\n\nNote: Admin account will NOT receive this. Continue?`
  );
  if (!yes) return;

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Sending…`;

  const finalHeading = heading || "App is Under Maintenance";
  const now          = Date.now();

  // Permanent admin exclusion — always skip admin email
  const excludedEmails = ["untitledworld9@gmail.com"];
  if (excludeUser) excludedEmails.push(excludeUser);

  try {
    // Write to "maintenance/current" — index.js onSnapshot picks this up on all devices
    await setDoc(doc(db, COLL.MAINTENANCE, "current"), {
      heading:         finalHeading,
      message,
      durationMinutes: durationMinutes || 0,
      platform,
      excludedEmails,          // client-side filters this out for admin/excluded user
      excludeUser:     excludeUser || null,
      active:          true,
      sentAt:          serverTimestamp(),
      time:            now
    });

    // Also write to history sub-collection for admin log
    await addDoc(collection(db, COLL.MAINTENANCE + "History"), {
      heading:         finalHeading,
      message,
      durationMinutes: durationMinutes || 0,
      platform,
      excludedEmails,
      excludeUser:     excludeUser || null,
      active:          true,
      sentAt:          serverTimestamp(),
      time:            now
    });

    toast("🔧 Maintenance announcement sent to all users!", "success");
    if ($("maintMessage"))      $("maintMessage").value = "";
    if ($("maintHeading"))      $("maintHeading").value = "";
    if ($("maintDuration"))     $("maintDuration").value = "0";
    if ($("maintExcludeUser"))  $("maintExcludeUser").value = "";

  } catch (err) {
    console.error("Maintenance send error:", err);
    toast("Failed to send: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "🔧 Push Maintenance Announcement";
  }
};

window.clearMaintenance = async () => {
  const yes = await confirmModal(
    "Clear Maintenance",
    "Remove the maintenance popup from all user devices immediately?"
  );
  if (!yes) return;
  try {
    await setDoc(doc(db, COLL.MAINTENANCE, "current"), { active: false, clearedAt: serverTimestamp() }, { merge: true });
    toast("Maintenance cleared. App is back to normal. ✅", "success");
  } catch (err) {
    toast("Failed to clear: " + err.message, "error");
  }
};

window.deleteMaintenanceRecord = async id => {
  const yes = await confirmModal(
    "Delete Maintenance Record",
    "Remove this record? If this is the currently active maintenance, users will be able to use the app again."
  );
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.MAINTENANCE + "History", id));
    // Also clear the active "current" doc so users can use the app
    await setDoc(doc(db, COLL.MAINTENANCE, "current"), { active: false, clearedAt: serverTimestamp() }, { merge: true });
    toast("Maintenance record deleted. App access restored. ✅", "success");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

// ============================================================
//  USER PERFORMANCE ANALYSIS
//  Reads studyGraphData from each user (7-day video completions)
//  Also shows focus time and XP progress
// ============================================================

function listenPerformance() {
  // Performance data is already in STATE.allUsers (studyGraphData field from progress.html)
  // renderPerformanceSection is called from listenUsers() → updateUserStats()
  // This is just a hook — no separate Firestore listener needed.
  renderPerformanceSection(STATE.allUsers);
}

function renderPerformanceSection(users) {
  const container = $("performanceContainer");
  if (!container) return;

  // Sort by combined XP (study + timer), then focus time
  const ranked = [...users]
    .map(u => {
      const graph    = Array.isArray(u.studyGraphData) ? u.studyGraphData : [0,0,0,0,0,0,0];
      const videos   = graph.reduce((s, v) => s + (Number(v) || 0), 0);
      const focus    = u.focusTime || u.totalFocusTime || u.timerMinutes || 0;
      const studyXP  = Number(u.xp ?? u.points ?? 0);
      const timerXP  = Number(u.timerXP || 0);
      const xp       = studyXP + timerXP;  // combined
      return { ...u, _videos: videos, _focus: focus, _xp: xp, _studyXP: studyXP, _timerXP: timerXP, _graph: graph };
    })
    .filter(u => u._videos > 0 || u._focus > 0 || u._xp > 0)
    .sort((a, b) => b._xp - a._xp || b._focus - a._focus);

  if (!ranked.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-text">No performance data yet — users need to complete videos or focus sessions</div>
    </div>`;
    return;
  }

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  // Current day index (0=Sun)
  const todayIdx = new Date().getDay();
  // Build ordered labels starting from 6 days ago → today
  const dayLabels = Array.from({length:7}, (_, i) => days[(todayIdx - 6 + i + 7) % 7]);

  container.innerHTML = ranked.map((u, i) => {
    const name    = escHtml(u.name || u.displayName || "—");
    const email   = escHtml(u.email || "");
    const initial = (u.name || u.displayName || u.email || "?")[0].toUpperCase();
    const level   = u.level ? Number(u.level) : adminGetLevel(u._xp);
    const badge   = adminGetBadge(u._xp);
    const maxVal  = Math.max(...u._graph, 1);

    // Bar chart bars
    const bars = u._graph.map((v, idx) => {
      const pct    = Math.round((v / maxVal) * 100);
      const isToday = idx === 6; // last index = today (we always show last 7 days ending today)
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:700;color:${v>0?'var(--accent-cyan)':'var(--text-muted)'};">${v||""}</div>
          <div style="
            width:100%;border-radius:4px 4px 0 0;
            background:${isToday ? 'rgba(0,224,255,0.7)' : v>0 ? 'rgba(0,224,255,0.35)' : 'rgba(255,255,255,0.05)'};
            height:${Math.max(pct * 0.6, v>0?4:1)}px;
            transition:height .4s ease;
            min-height:${v>0?'4px':'2px'};
          "></div>
          <div style="font-size:9px;color:var(--text-muted);white-space:nowrap;">${dayLabels[idx]}</div>
        </div>`;
    }).join("");

    const rank   = ["🥇","🥈","🥉"][i] || `#${i+1}`;
    const medals = i < 3;

    return `
    <div style="
      background:var(--bg-card);border:1px solid ${medals ? 'rgba(0,224,255,0.2)' : 'var(--border)'};
      border-radius:var(--radius-lg);padding:18px 20px;
      animation:fadeSlideUp .4s ease ${i*0.05}s both;
      transition:border-color .2s,transform .15s;
    " onmouseover="this.style.borderColor='rgba(0,224,255,0.3)';this.style.transform='translateY(-2px)'"
       onmouseout="this.style.borderColor='${medals?'rgba(0,224,255,0.2)':'var(--border)'}';this.style.transform=''">

      <!-- Header row -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="font-size:20px;min-width:28px;text-align:center;">${rank}</div>
        <div style="
          width:36px;height:36px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,var(--accent-cyan),var(--accent-violet));
          display:flex;align-items:center;justify-content:center;
          font-size:15px;font-weight:800;color:#000;
        ">${initial}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
          <div style="font-size:11px;color:var(--text-muted);">${email}</div>
        </div>
        <!-- Stats pills -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span style="background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.2);
            color:var(--accent-violet);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700;">
            📺 ${formatWatchTime(u.playlistWatchMinutes || 0)} watch
          </span>
          <span style="background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.2);
            color:var(--accent-violet);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700;">
            ⏱️ ${formatFocusTime(u._focus)}
          </span>
          <span style="background:rgba(255,184,48,.1);border:1px solid rgba(255,184,48,.2);
            color:var(--accent-amber);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700;">
            ⚡ ${u._xp} XP
          </span>
          <span style="background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.15);
            color:var(--accent-green);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700;">
            Lv.${level} · ${badge}
          </span>
        </div>
      </div>

      <!-- 7-day bar chart -->
      <div style="
        background:var(--bg-input);border:1px solid var(--border);
        border-radius:var(--radius-md);padding:12px 14px 8px;
        display:flex;align-items:flex-end;gap:4px;height:90px;
      ">
        ${bars}
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:6px;text-align:right;">
        7-day activity history
      </div>
    </div>`;
  }).join("");
}

// ============================================================
//  WATCH TIME SECTION
//  Reads playlistWatchMinutes from users collection
//  Called from listenUsers → renderWatchTimeSection
// ============================================================

/** Called from listenUsers() after STATE.allUsers updates */
function renderWatchTimeSection(users) {
  const container  = $("watchTimeContainer");
  if (!container) return;

  const searchVal  = ($("wtSearch")?.value || "").toLowerCase();

  // Filter + sort by watch time descending
  const sorted = [...users]
    .map(u => ({
      ...u,
      _watch: u.playlistWatchMinutes || 0
    }))
    .filter(u => {
      if (!searchVal) return true;
      return (u.name || "").toLowerCase().includes(searchVal) ||
             (u.email || "").toLowerCase().includes(searchVal);
    })
    .sort((a, b) => b._watch - a._watch);

  // Summary stats
  const activeUsers = sorted.filter(u => u._watch > 0);
  const totalMins   = activeUsers.reduce((s, u) => s + u._watch, 0);
  const avgMins     = activeUsers.length ? Math.round(totalMins / activeUsers.length) : 0;

  if ($("wtTotalTime"))   animateStat($("wtTotalTime"),   formatWatchTime(totalMins));
  if ($("wtActiveUsers")) animateStat($("wtActiveUsers"), activeUsers.length);
  if ($("wtAvgTime"))     animateStat($("wtAvgTime"),     formatWatchTime(avgMins));

  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📺</div>
      <div class="empty-state-text">No users found</div>
    </div>`;
    return;
  }

  const maxWatch = sorted[0]?._watch || 1;

  container.innerHTML = sorted.map((u, i) => {
    const watch     = u._watch;
    const pct       = Math.round((watch / maxWatch) * 100);
    const name      = escHtml(u.name || u.displayName || "—");
    const email     = escHtml(u.email || u.id || "");
    const initial   = (u.name || u.displayName || u.email || "?")[0].toUpperCase();
    const rankLabel = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    const barColor  = watch > 0 ? "var(--accent-violet)" : "rgba(255,255,255,0.06)";
    const isZero    = watch === 0;

    return `
    <div style="
      background:var(--bg-card);
      border:1px solid ${watch > 0 ? 'rgba(124,92,252,0.18)' : 'var(--border)'};
      border-radius:var(--radius-md);
      padding:14px 16px;
      transition:border-color .2s, transform .15s;
      ${isZero ? 'opacity:0.55;' : ''}
    " onmouseover="this.style.borderColor='rgba(124,92,252,0.35)';this.style.transform='translateY(-1px)'"
       onmouseout="this.style.borderColor='${watch > 0 ? 'rgba(124,92,252,0.18)' : 'var(--border)'}';this.style.transform=''">

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
        <!-- Rank -->
        <div style="font-size:16px;min-width:28px;text-align:center;">${rankLabel}</div>
        <!-- Avatar -->
        <div style="
          width:36px;height:36px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,var(--accent-violet),var(--accent-cyan));
          display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:800;color:#fff;
        ">${initial}</div>
        <!-- Name + email -->
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
          <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${email}</div>
        </div>
        <!-- Watch time chip -->
        <span style="
          background:${watch > 0 ? 'rgba(124,92,252,0.12)' : 'rgba(255,255,255,0.04)'};
          border:1px solid ${watch > 0 ? 'rgba(124,92,252,0.25)' : 'var(--border)'};
          color:${watch > 0 ? 'var(--accent-violet)' : 'var(--text-muted)'};
          border-radius:99px;padding:3px 12px;font-size:12px;font-weight:700;
          white-space:nowrap;
        ">📺 ${formatWatchTime(watch)}</span>
      </div>

      <!-- Progress bar -->
      <div style="background:rgba(255,255,255,0.05);border-radius:99px;height:5px;overflow:hidden;">
        <div style="
          height:100%;border-radius:99px;
          width:${pct}%;
          background:${barColor};
          transition:width .6s ease;
          min-width:${watch > 0 ? '4px' : '0'};
        "></div>
      </div>
      ${watch > 0 ? `
        <div style="font-size:10px;color:var(--text-muted);margin-top:5px;text-align:right;">
          ${pct}% of top watcher
        </div>` : `
        <div style="font-size:10px;color:var(--text-muted);margin-top:5px;">
          No playlist watch time yet
        </div>`
      }
    </div>`;
  }).join("");
}

/** Format minutes → "1h 23m" or "45m" */
function formatWatchTime(mins) {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Filter watch time on search input */
window.filterWatchTime = () => renderWatchTimeSection(STATE.allUsers);

// ============================================================
//  FOCUS TIMER SECTION
//  Full Focused Session (lifetime, accumulated via totalFocusTime) +
//  Today Focus (live, from focusTime which resets daily in script.js) +
//  a day-range summary built from the "analytics" daily snapshots +
//  a live list of users currently focusing right now.
// ============================================================

let _focusFilterDays  = 1;
let _focusFilterLabel = 'Today';

/** Called from listenUsers() after STATE.allUsers updates */
function renderFocusTimerSection() {
  if (!$("ftFullSession")) return; // section not on this page yet
  updateFocusTimerStats();
  renderFocusingNowList();
}

window.setFocusFilter = (key) => {
  const map = { today: 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30, '180d': 180, '365d': 365 };
  const labels = { today: 'Today', '3d': '3 Days', '7d': '1 Week', '14d': '14 Days', '30d': '1 Month', '180d': '6 Months', '365d': '1 Year' };
  _focusFilterDays  = map[key] ?? 1;
  _focusFilterLabel = labels[key] ?? 'Today';
  document.querySelectorAll('.ft-btn').forEach(b => b.classList.toggle('ef-active', b.dataset.ft === key));
  updateFocusTimerStats();
};

/** Compute & render the two summary cards + range card */
async function updateFocusTimerStats() {
  const todayFocusMin    = STATE.allUsers.reduce((s, u) => s + todaysFocusMinutes(u), 0);
  const lifetimeFocusMin = STATE.allUsers.reduce((s, u) => s + (u.totalFocusTime || 0) + (u.focusTime || 0), 0);

  if ($("ftFullSession")) animateStat($("ftFullSession"), formatWatchTime(lifetimeFocusMin));
  if ($("ftTodayFocus"))  animateStat($("ftTodayFocus"),  formatWatchTime(todayFocusMin));

  // Range total — today counted live, earlier days pulled from daily
  // "analytics" snapshots (these build up going forward day by day).
  let rangeTotal = todayFocusMin;
  if (_focusFilterDays > 1) {
    try {
      const snap     = await getDocs(collection(db, COLL.ANALYTICS));
      const todayKey = new Date().toISOString().split("T")[0];
      const cutoff   = new Date();
      cutoff.setDate(cutoff.getDate() - (_focusFilterDays - 1));
      const cutoffKey = cutoff.toISOString().split("T")[0];
      snap.forEach(d => {
        if (d.id === todayKey) return; // already counted live above
        if (d.id >= cutoffKey && d.id <= todayKey) {
          rangeTotal += (d.data().focusMinutes || 0);
        }
      });
    } catch (e) {
      console.warn("[FocusTimer] range fetch failed:", e);
    }
  }
  if ($("ftRangeFocus")) animateStat($("ftRangeFocus"), formatWatchTime(rangeTotal));
  if ($("ftRangeLabel")) $("ftRangeLabel").textContent = _focusFilterLabel;
}

/** Live list of users currently in a focus session, newest-active first */
function renderFocusingNowList() {
  const container = $("ftFocusingNow");
  if (!container) return;

  const q       = ($("ftSearch")?.value || "").toLowerCase().trim();
  const now     = Date.now();
  const STALE_MS = 5 * 60 * 1000;

  const list = STATE.allUsers.filter(u => {
    const s = (u.status || "").toLowerCase();
    if (!s.includes("focus")) return false;
    const ts = u.lastActive || u.lastSeen || 0;
    if (ts && (now - ts) > STALE_MS) return false;
    if (q && !(u.name || "").toLowerCase().includes(q) && !(u.email || "").toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (b.lastActive || b.lastSeen || 0) - (a.lastActive || a.lastSeen || 0));

  if ($("ftFocusingCount")) $("ftFocusingCount").textContent = list.length;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🧘</div>
      <div class="empty-state-text">No one is focusing right now</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(u => {
    const name    = escHtml(u.name || u.displayName || "—");
    const email   = escHtml(u.email || u.id || "");
    const initial = (u.name || u.email || "?")[0].toUpperCase();
    const mins    = u.focusTime || 0;
    return `<div style="
      display:flex;align-items:center;gap:12px;
      background:var(--bg-card);border:1px solid rgba(0,229,160,0.2);
      border-radius:var(--radius-md);padding:12px 14px;">
      <div style="
        width:36px;height:36px;border-radius:50%;flex-shrink:0;
        background:linear-gradient(135deg,#00e5a0,#00b8d4);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:800;color:#fff;">${initial}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
        <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${email}</div>
      </div>
      <span style="
        background:rgba(0,229,160,0.12);border:1px solid rgba(0,229,160,0.3);
        color:#00e5a0;border-radius:99px;padding:3px 12px;font-size:11px;
        font-weight:700;white-space:nowrap;">🧠 ${formatWatchTime(mins)} today</span>
    </div>`;
  }).join("");
}

window.filterFocusingNow = () => renderFocusingNowList();

// ============================================================
//  OFFERS SECTION
//  Admin sends flash offers/deals to users with countdown timer,
//  image banner, and page targeting. Shown as full-page overlay.
// ============================================================

function listenOffers() {
  const unsub = onSnapshot(
    query(collection(db, COLL.OFFERS), orderBy("time", "desc"), limit(30)),
    snap => renderOffersHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (err.code !== "permission-denied") console.warn("Offers listener:", err); }
  );
  STATE.unsubscribers.push(unsub);
}

function renderOffersHistory(list) {
  const container = $("offersHistory");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🎁</div>
      <div class="empty-state-text">No offers sent yet</div>
    </div>`;
    return;
  }

  container.innerHTML = list.map(o => `
    <div class="announce-item" style="border-left:3px solid rgba(255,184,48,0.5);">
      <span style="font-size:22px;flex-shrink:0;">🎁</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;color:var(--accent-amber);">${escHtml(o.heading || "Offer")}</div>
        ${o.message ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">${escHtml(o.message)}</div>` : ""}
        ${o.imageUrl ? `<div style="font-size:11px;color:var(--accent-cyan);margin-top:3px;">🖼️ Has image</div>` : ""}
        <div class="announce-meta" style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>
            ${formatTimestamp(o.time)}
            ${o.durationMinutes ? ` &nbsp;·&nbsp; ⏱ ${o.durationMinutes} min timer` : ""}
            ${o.page && o.page !== "all" ? ` &nbsp;·&nbsp; 📄 ${escHtml(o.page)}` : ""}
            ${o.user ? ` &nbsp;·&nbsp; 👤 ${escHtml(o.user)}` : " &nbsp;·&nbsp; 📣 All"}
            &nbsp;·&nbsp; <span style="color:${o.active ? "var(--accent-green)" : "var(--text-muted)"};">
              ${o.active ? "● Active" : "○ Inactive"}
            </span>
          </span>
          ${seenBadge(COLL.OFFERS, o.id, "Offer", o.seenBy)}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
        <button class="announce-delete" onclick="deleteOffer('${o.id}')" title="Delete">✕</button>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:11px;"
                onclick="toggleOfferActive('${o.id}', ${!o.active})">
          ${o.active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  `).join("");
}

window.sendOffer = async () => {
  const heading         = ($("offerHeading")?.value       || "").trim();
  const message         = ($("offerMessage")?.value       || "").trim();
  const imageUrl        = ($("offerImageUrl")?.value      || "").trim();
  const ctaUrl          = ($("offerCtaUrl")?.value        || "").trim();
  const durationMinutes = parseInt($("offerDuration")?.value || "0", 10);
  const page            = $("offerPage")?.value            || "all";
  const platform        = $("offerPlatform")?.value        || "both";
  const targetType      = $("offerTarget")?.value          || "all";
  const selectedUser    = ($("offerUser")?.value           || "").trim();
  const btn             = $("offerBtn");

  if (!heading) { toast("Please enter an offer heading.", "warning"); return; }
  if (targetType === "user" && !selectedUser) { toast("Please enter a target username or email.", "warning"); return; }

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Sending…`;

  const finalTarget = targetType === "user" && selectedUser ? selectedUser : "all";

  try {
    await addDoc(collection(db, COLL.OFFERS), {
      heading,
      message:         message || "",
      imageUrl:        imageUrl || null,
      ctaUrl:          ctaUrl || null,
      durationMinutes: durationMinutes || 0,
      page,
      platform,
      target:          finalTarget,
      user:            targetType === "user" && selectedUser ? selectedUser : null,
      active:          true,
      time:            Date.now(),
      createdAt:       serverTimestamp()
    });

    toast("🎁 Offer sent to users!", "success");
    if ($("offerHeading"))  $("offerHeading").value  = "";
    if ($("offerMessage"))  $("offerMessage").value  = "";
    if ($("offerImageUrl")) $("offerImageUrl").value = "";
    if ($("offerCtaUrl"))   $("offerCtaUrl").value   = "";
    if ($("offerUser"))     $("offerUser").value     = "";
    if ($("offerDuration")) $("offerDuration").value = "0";
  } catch (err) {
    console.error("Offer send error:", err);
    toast("Failed to send offer: " + err.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "🎁 Send Offer";
  }
};

window.deleteOffer = async id => {
  const yes = await confirmModal("Delete Offer", "Remove this offer permanently?");
  if (!yes) return;
  try {
    await deleteDoc(doc(db, COLL.OFFERS, id));
    toast("Offer deleted.", "info");
  } catch (err) {
    toast("Delete failed: " + err.message, "error");
  }
};

window.toggleOfferActive = async (id, active) => {
  try {
    await updateDoc(doc(db, COLL.OFFERS, id), { active });
    toast(active ? "Offer activated." : "Offer deactivated.", "info");
  } catch (err) {
    toast("Update failed: " + err.message, "error");
  }
};

/** Called from user management "Send Offer" button */
window.sendOfferToUser = (uid, uname) => {
  showSection("offers");
  const sel = $("offerTarget"); if (sel) sel.value = "user";
  const ug = $("offerUserGroup"); if (ug) ug.style.display = "flex";
  const ui = $("offerUser"); if (ui) ui.value = uname;
};

window.toggleOfferUserField = () => {
  const v = $("offerTarget")?.value;
  const g = $("offerUserGroup");
  if (g) g.style.display = v === "user" ? "flex" : "none";
};

// ============================================================
//  END OF admin.js
// ============================================================





