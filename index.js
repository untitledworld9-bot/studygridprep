/**
 * ============================================================
 *  UNTITLED WORLD — index.js
 *  Production-Grade Architecture v2.0
 * ============================================================
 *
 *  Sections:
 *    1.  Imports
 *    2.  Constants & Session State
 *    3.  Utility Helpers
 *    4.  Service Worker Registration & Update Detection
 *    5.  Announcement System
 *    6.  Notification System
 *    7.  Promotion Popup System
 *    8.  Bootstrap  ← single entry point, fires on DOMContentLoaded
 *
 *  Architecture rules applied:
 *    ✔  Singleton listeners  (listenersBooted flag)
 *    ✔  sessionStorage IDs   (survives hot-reload; cleared on new tab)
 *    ✔  Defensive DOM checks everywhere
 *    ✔  Zero duplicate Firestore listeners across refreshes
 *    ✔  SW update toast with forced reload
 * ============================================================
 */


// ─────────────────────────────────────────────────────────────
// 1. IMPORTS
// ─────────────────────────────────────────────────────────────

import { db } from "./firebase.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ─────────────────────────────────────────────────────────────
// 2. CONSTANTS & SESSION STATE
// ─────────────────────────────────────────────────────────────

/**
 * SESSION KEYS — used to persist seen-IDs across hot-refreshes
 * inside the same browser tab (sessionStorage is cleared when
 * the tab is closed, so new visits always get fresh content).
 */
const SK = {
  ANNOUNCEMENTS : "uw_seen_announcements",
  NOTIFICATIONS : "uw_seen_notifications",
  PROMOTIONS    : "uw_seen_promotions",
  LISTENERS_BOOT: "uw_listeners_booted"
};

/**
 * In-memory Sets (fast O(1) lookup).
 * Seeded from sessionStorage so a refresh never replays old docs.
 */
const seen = {
  announcements : new Set(JSON.parse(sessionStorage.getItem(SK.ANNOUNCEMENTS) || "[]")),
  notifications : new Set(JSON.parse(sessionStorage.getItem(SK.NOTIFICATIONS) || "[]")),
  promotions    : new Set(JSON.parse(sessionStorage.getItem(SK.PROMOTIONS)    || "[]"))
};

/** Persist a doc-id into both the in-memory Set and sessionStorage. */
function markSeen(type, id) {
  seen[type].add(id);
  try {
    sessionStorage.setItem(SK[type.toUpperCase()], JSON.stringify([...seen[type]]));
  } catch (_) {
    // sessionStorage quota exceeded — ignore; in-memory Set still protects
  }
}

/** Current user from localStorage (set during login). */
const CURRENT_USER = localStorage.getItem("userName") || null;

/** Unsubscribe handles — kept so we never re-attach the same listener. */
const unsubs = {
  announcements : null,
  notifications : null,
  promotions    : null
};


// ─────────────────────────────────────────────────────────────
// 3. UTILITY HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Safe querySelector — returns null (not throws) if element is missing.
 * @param {string} selector
 * @param {Document|Element} [root=document]
 */
function qs(selector, root = document) {
  try { return root.querySelector(selector); } catch (_) { return null; }
}

/**
 * Append a child element to a parent only if both exist.
 * @param {Element|null} parent
 * @param {Element} child
 */
function safeAppend(parent, child) {
  if (parent && child) parent.appendChild(child);
}

/**
 * Auto-remove an element from the DOM after `ms` milliseconds.
 * Guards against the element already being removed.
 * @param {Element} el
 * @param {number}  ms
 */
function autoRemove(el, ms) {
  setTimeout(() => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }, ms);
}

/**
 * Show a small bottom-right toast message.
 * Used for the SW update banner.
 * @param {string} html
 * @param {number} [duration=5000]
 */
function showToast(html, duration = 5000) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position:fixed;bottom:24px;right:20px;
    background:#1e3a5f;color:#e2f0ff;
    padding:14px 20px;border-radius:14px;
    font-size:14px;font-weight:600;
    box-shadow:0 6px 20px rgba(0,0,0,0.5);
    z-index:99999;max-width:300px;
    border:1px solid rgba(0,242,254,0.25);
    line-height:1.5;
  `;
  toast.innerHTML = html;
  safeAppend(document.body, toast);
  autoRemove(toast, duration);
}

/**
 * Returns true when running as an installed PWA.
 */
function isPWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}


// ─────────────────────────────────────────────────────────────
// 4. SERVICE WORKER REGISTRATION & UPDATE DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Registers /sw.js and watches for new SW installations.
 *
 * Flow:
 *   install → waiting → (we send skipWaiting) → activating → active
 *
 * When a new SW enters "waiting" state we:
 *   1. Show a toast.
 *   2. Tell the SW to skip waiting.
 *   3. Reload once the new SW takes control.
 */
function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // --- Register firebase-messaging SW (required for FCM background) ---
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js")
    .then(reg => console.log("[SW] FCM worker registered:", reg.scope))
    .catch(err => console.warn("[SW] FCM worker error:", err));

  // --- Register main app SW ---
  navigator.serviceWorker
    .register("/sw.js")
    .then(reg => {
      console.log("[SW] App worker registered:", reg.scope);

      /**
       * A SW may already be waiting on first load (e.g. hard refresh
       * while a previous update was pending).  Handle both cases.
       */
      const handleWaiting = (waitingWorker) => {
        if (!waitingWorker) return;

        showToast(
          `🔄 New update available!<br>
           <span style="font-weight:400;font-size:12px">Reloading in 3 s…</span>`,
          4000
        );

        // Tell the waiting SW to activate immediately.
        waitingWorker.postMessage("skipWaiting");
      };

      // Already waiting on page load?
      if (reg.waiting) handleWaiting(reg.waiting);

      // Becomes waiting later (normal background update)
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            handleWaiting(newWorker);
          }
        });
      });
    })
    .catch(err => console.warn("[SW] App worker error:", err));

  /**
   * Once the new SW takes control (controllerchange), reload once.
   * The `reloading` flag prevents an infinite reload loop.
   */
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}


// ─────────────────────────────────────────────────────────────
// 5. ANNOUNCEMENT SYSTEM
// ─────────────────────────────────────────────────────────────

/**
 * Firestore collection : "announcements"
 * Required fields      : text (string), active (bool), createdAt (Timestamp)
 *
 * Behaviour:
 *  • Listens only for docs added in the current session window.
 *  • Ignores docs already seen (tracked via sessionStorage).
 *  • Injects a banner into #announcement-container or <body>.
 *  • Auto-removes after 5 s.
 *  • Listener attached once per page lifecycle (singleton guard).
 */
function initAnnouncements() {

  if (unsubs.announcements) return; // already attached

  /**
   * Only fetch announcements created in the last 60 seconds on the
   * very first load, then catch everything new in real-time.
   * This prevents ALL historical docs from firing as "added" on
   * every page refresh — the root cause of duplicate announcements.
   */
  const startTime = Timestamp.now();

  const q = query(
    collection(db, "announcements"),
    where("active", "==", true),
    where("createdAt", ">=", startTime),
    orderBy("createdAt", "desc"),
    limit(5)
  );

  unsubs.announcements = onSnapshot(q, (snap) => {

    snap.docChanges().forEach((change) => {

      // Only care about genuinely new documents.
      if (change.type !== "added") return;

      const id   = change.doc.id;
      const data = change.doc.data();

      // Duplicate guard — skip if we showed this already this session.
      if (seen.announcements.has(id)) return;
      markSeen("announcements", id);

      if (!data.text) return; // malformed doc — skip silently

      renderAnnouncementBanner(data.text);
    });

  }, (err) => {
    console.warn("[Announcements] Firestore error:", err);
  });
}

/**
 * Build and inject the announcement banner element.
 * @param {string} text
 */
function renderAnnouncementBanner(text) {

  const banner = document.createElement("div");
  banner.className = "admin-msg";          // keep existing CSS class
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  // Sanitise — only set as text, never innerHTML, to avoid XSS.
  banner.textContent = "📢 " + text;

  // Prefer a dedicated container; fall back to body.
  const container = qs("#announcement-container") || document.body;
  safeAppend(container, banner);
  autoRemove(banner, 5000);
}


// ─────────────────────────────────────────────────────────────
// 6. NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────────

/**
 * Firestore collection : "notifications"
 * Required fields      : title (string), body (string),
 *                        user ("all" | username), createdAt (Timestamp)
 *
 * Behaviour:
 *  • Filters to docs targeting this user or "all".
 *  • De-duplicates via sessionStorage.
 *  • Fires a Service Worker notification (works in both PWA & browser).
 *  • Listener attached once per page lifecycle (singleton guard).
 */
function initNotifications() {

  if (unsubs.notifications) return; // already attached

  // Request permission once, non-blocking.
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  const startTime = Timestamp.now();

  /**
   * We query for notifications addressed to the current user OR "all".
   * Firestore doesn't support OR across different fields in a single
   * query, so we use two separate listeners and merge them.
   */
  const makeQuery = (userValue) =>
    query(
      collection(db, "notifications"),
      where("user", "==", userValue),
      where("createdAt", ">=", startTime),
      orderBy("createdAt", "desc"),
      limit(10)
    );

  const handleChange = (snap) => {
    snap.docChanges().forEach((change) => {

      if (change.type !== "added") return;

      const id   = change.doc.id;
      const data = change.doc.data();

      if (seen.notifications.has(id)) return;
      markSeen("notifications", id);

      if (!data.title || !data.body) return;

      fireNotification(data.title, data.body);
    });
  };

  const errHandler = (err) =>
    console.warn("[Notifications] Firestore error:", err);

  // Attach listener for "all" broadcasts.
  const unsubAll = onSnapshot(makeQuery("all"), handleChange, errHandler);

  // Attach listener for this specific user (only if logged in).
  let unsubUser = () => {};
  if (CURRENT_USER) {
    unsubUser = onSnapshot(makeQuery(CURRENT_USER), handleChange, errHandler);
  }

  // Store a combined unsub handle.
  unsubs.notifications = () => { unsubAll(); unsubUser(); };
}

/**
 * Show a push notification via the Service Worker.
 * Falls back to Notification API if SW isn't active.
 * @param {string} title
 * @param {string} body
 */
function fireNotification(title, body) {

  if (Notification.permission !== "granted") return;

  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png" };

  // Prefer SW notification (works when app is in background / PWA).
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => {
        // SW ready timed-out; fall back to foreground notification.
        new Notification(title, opts);
      });
  } else {
    // Plain browser notification (tab is in foreground, no SW yet).
    try { new Notification(title, opts); } catch (_) {}
  }
}


// ─────────────────────────────────────────────────────────────
// 7. PROMOTION POPUP SYSTEM
// ─────────────────────────────────────────────────────────────

/**
 * Firestore collection : "promotions"
 * Required fields      : title (string), message (string), active (bool)
 *
 * Behaviour:
 *  • Shows each active promotion popup once per session.
 *  • Auto-closes after 6 s.
 *  • Prevents duplicate popups via sessionStorage.
 *  • Listener attached once per page lifecycle (singleton guard).
 */
function initPromotions() {

  if (unsubs.promotions) return; // already attached

  const q = query(
    collection(db, "promotions"),
    where("active", "==", true),
    limit(5)
  );

  unsubs.promotions = onSnapshot(q, (snap) => {

    snap.docChanges().forEach((change) => {

      if (change.type !== "added") return;

      const id   = change.doc.id;
      const data = change.doc.data();

      if (seen.promotions.has(id)) return;
      markSeen("promotions", id);

      if (!data.active) return;
      if (!data.title && !data.message) return;

      renderPromotionPopup(data);
    });

  }, (err) => {
    console.warn("[Promotions] Firestore error:", err);
  });
}

/**
 * Build and inject the promotion popup card.
 * @param {{ title: string, message: string }} data
 */
function renderPromotionPopup(data) {

  const box = document.createElement("div");
  box.className = "promo-popup";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Promotion");

  // Inline styles kept minimal; project CSS can override `.promo-popup`.
  box.style.cssText = `
    position:fixed;bottom:20px;left:20px;
    background:#111827;color:#f1f5f9;
    padding:16px 20px;border-radius:14px;
    z-index:9998;max-width:300px;
    box-shadow:0 6px 24px rgba(0,0,0,0.5);
    border:1px solid rgba(0,242,254,0.2);
    font-size:14px;line-height:1.5;
  `;

  // Use textContent for title/message to prevent XSS.
  const titleEl = document.createElement("b");
  titleEl.textContent = data.title || "";

  const br = document.createElement("br");

  const msgEl = document.createElement("span");
  msgEl.textContent = data.message || "";

  box.appendChild(titleEl);
  box.appendChild(br);
  box.appendChild(msgEl);

  safeAppend(document.body, box);
  autoRemove(box, 6000);
}


// ─────────────────────────────────────────────────────────────
// 8. BOOTSTRAP  — single DOMContentLoaded entry point
// ─────────────────────────────────────────────────────────────

/**
 * All systems start here.
 *
 * Wrapping everything in DOMContentLoaded ensures:
 *   ✔  document.body always exists before we try to append children.
 *   ✔  No "Cannot read properties of null" errors.
 *   ✔  Single execution path — no race conditions.
 *
 * The `listenersBooted` sessionStorage flag prevents Firestore
 * listeners from being re-created during script re-evaluation
 * (can happen with certain bundlers or HMR setups).  In vanilla
 * HTML/JS the unsubs object itself already guards this, but the
 * flag is a belt-and-suspenders safety net.
 */
document.addEventListener("DOMContentLoaded", () => {

  console.log("[UW] index.js booted.");

  // ── 4. Service Worker (always re-register; SW API is idempotent) ──
  initServiceWorker();

  // ── Guard: prevent duplicate Firestore listeners on hot-reload ───
  if (sessionStorage.getItem(SK.LISTENERS_BOOT) === "1") {
    console.log("[UW] Listeners already live — skipping re-attachment.");
    return;
  }
  sessionStorage.setItem(SK.LISTENERS_BOOT, "1");

  // ── 5. Announcements ─────────────────────────────────────────────
  initAnnouncements();

  // ── 6. Notifications ─────────────────────────────────────────────
  initNotifications();

  // ── 7. Promotions ────────────────────────────────────────────────
  initPromotions();

  console.log("[UW] All systems initialised.");
});


/**
 * Safety net: on full page unload (tab close / navigate away)
 * detach all Firestore listeners to avoid ghost callbacks.
 * (onSnapshot listeners are automatically cleaned up by Firebase
 *  when the page unloads, but explicit cleanup is good practice.)
 */
window.addEventListener("pagehide", () => {
  if (typeof unsubs.announcements === "function") unsubs.announcements();
  if (typeof unsubs.notifications  === "function") unsubs.notifications();
  if (typeof unsubs.promotions     === "function") unsubs.promotions();

  // Reset boot flag so the next fresh load re-attaches listeners.
  sessionStorage.removeItem(SK.LISTENERS_BOOT);
});
