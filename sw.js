importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs",
  authDomain: "untitled-world-2e645.firebaseapp.com",
  projectId: "untitled-world-2e645",
  messagingSenderId: "990115586087",
  appId: "1:990115586087:web:963f68bd59dec5ef0c6e02"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const n = payload.notification;
  const d = payload.data || {};

  self.registration.showNotification(n.title, {
    body: n.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    image: n.image || d.image || null,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url: d.url || "/" }
  });
});

// ─────────────────────────────────────────────────────────────
const CACHE = "sgp-cache-v13";

// ✅ Sirf wahi files jo 100% exist karti hain
const ASSETS = [
  "/dashboard-home.html",
  "/offline.html",
  "/focus.html",
  "/timer.html",
  "/todo.html",
  "/playlist.html",
  "/profile.html",
  "/mock.html",
  "/manifest.json",
  "/style.css",
  "/script.js",
  "/theme.js",
  "/icon-192.png",
  "/icon-512.png",
  "/game/game.html",
  "/game/game.css", 
  "/game/game.js",
  "/game/game-patch.js",
  "/game/gameleaderboard.html",
  "/admin/studygridadmin.html",
  "/admin/manifestadmin.json"
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn("Cache miss:", url, err)
          )
        )
      );
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const req = event.request;

  if (!req.url.startsWith(self.location.origin)) return;
  if (req.method !== "GET") return;

  // ── NAVIGATION (page open) ──────────────────────────────
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req, { ignoreSearch: true });
          if (cached) return cached;

          const offlinePage = await caches.match("/offline.html");
          return offlinePage || new Response(
            "<h2>Offline</h2><button onclick='location.reload()'>Retry</button>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // ── STATIC FILES (CSS, JS, images) ──────────────────────
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      return networkFetch;
    })
  );
});

// ── MESSAGE ──────────────────────────────────────────────────
const scheduledNotifications = new Map();

// ✅ FIX (root cause of "app fully closed → no notification"):
// setTimeout inside a Service Worker only survives while the SW stays
// alive in memory. The browser is free to terminate an idle SW after a
// short period (usually well under a minute), which silently wipes out
// any pending setTimeout — that's exactly why the reminder fired when the
// app was merely backgrounded (SW still warm) but not when it was fully
// closed/swiped away (SW got killed, timer gone with it).
//
// The Notification Triggers API (TimestampTrigger) hands the scheduling
// off to the browser/OS itself, so it survives SW termination and even
// a full app close. It's supported on Chrome/Edge for installed PWAs on
// Android (desktop support is limited). We use it when available and
// fall back to the old in-memory setTimeout otherwise, so nothing breaks
// on browsers that don't support it — they just keep today's behavior.
const supportsTrigger = typeof TimestampTrigger !== "undefined";

self.addEventListener("message", event => {
  const data = event.data;
  if (!data) return;

  if (data === "skipWaiting" || data.type === "skipWaiting") {
    self.skipWaiting();
    return;
  }

  if (data.type === "CLIENT_ONLINE") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then(list => {
        list.forEach(c => c.postMessage({ type: "RELOAD_NOW" }));
      })
    );
    return;
  }

  if (data.type === "SCHEDULE_NOTIFICATION") {
    const { id = "default", endTime, title, body, url } = data;
    const delay = endTime - Date.now();

    // Cancel any earlier one scheduled under the same id
    if (scheduledNotifications.has(id)) {
      const ex = scheduledNotifications.get(id);
      if (ex.timeout) clearTimeout(ex.timeout);
      if (ex.resolve) ex.resolve();
      scheduledNotifications.delete(id);
    }

    if (delay <= 0) return;

    if (supportsTrigger) {
      // ✅ OS-level scheduled notification — fires even if the SW was
      // terminated or the app fully closed in the meantime.
      event.waitUntil(
        self.registration.showNotification(title || "Study Grid Prep", {
          body: body || "",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: id,
          showTrigger: new TimestampTrigger(endTime),
          data: { url: url || "/" }
        }).catch(err => console.warn("[SW] showTrigger failed:", err))
      );
      return;
    }

    // Fallback (browsers without Notification Triggers support) — same
    // as before: reliable only while the SW/tab stays alive.
    event.waitUntil(new Promise(resolve => {
      const timeout = setTimeout(async () => {
        await self.registration.showNotification(title || "Study Grid Prep", {
          body: body || "",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: id,
          data: { url: url || "/" }
        });
        scheduledNotifications.delete(id);
        resolve();
      }, delay);
      scheduledNotifications.set(id, { timeout, resolve });
    }));
    return;
  }

  if (data.type === "CANCEL_NOTIFICATION") {
    const { id = "default" } = data;
    if (scheduledNotifications.has(id)) {
      const ex = scheduledNotifications.get(id);
      if (ex.timeout) clearTimeout(ex.timeout);
      if (ex.resolve) ex.resolve();
      scheduledNotifications.delete(id);
    }
    // Also cancel any already-scheduled Triggers-API notification with this tag
    if (supportsTrigger) {
      self.registration.getNotifications({ tag: id }).then(list => {
        list.forEach(n => n.close());
      }).catch(() => {});
    }
    return;
  }
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(async list => {
        for (const c of list) {
          if ("focus" in c) { await c.focus(); return; }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
