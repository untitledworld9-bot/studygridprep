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
    icon: APP_ICON,
    badge: APP_ICON,
    image: n.image || d.image || null,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url: d.url || "/" }
  });
});

// ─────────────────────────────────────────────────────────────
const CACHE = "sgp-cache-v15";

// ✅ FIX: notification icon was showing as a generic grey letter-avatar
// instead of the app logo. Android/Chrome fetches notification icons
// through the network stack at the moment the notification is shown —
// that fetch isn't always caught by this SW's own fetch handler, so if
// it happened while offline (exactly when reminders matter most) the
// icon silently failed to load and the OS fell back to a monogram.
// Embedding the icon directly as a base64 data URI removes the network
// dependency entirely — it's always available, online or offline.
const APP_ICON = "data:image/png;base64,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";

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
          // ✅ FIX: Cloudflare Pages serves "clean" URLs (e.g. /profile
          // instead of /profile.html), but ASSETS above are cached under
          // their real .html filenames. An exact-URL cache lookup for
          // the clean URL was missing, so try the .html version too
          // before falling all the way back to the generic offline page.
          let cached = await caches.match(req, { ignoreSearch: true });
          if (!cached) {
            const url = new URL(req.url);
            if (!url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) {
              cached = await caches.match(url.pathname + ".html", { ignoreSearch: true });
            }
          }
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

    if (scheduledNotifications.has(id)) {
      const ex = scheduledNotifications.get(id);
      if (ex.timeout) clearTimeout(ex.timeout);
      if (ex.resolve) ex.resolve();
      scheduledNotifications.delete(id);
    }

    if (delay <= 0) return;

    if (supportsTrigger) {
      event.waitUntil(
        self.registration.showNotification(title || "Study Grid Prep", {
          body: body || "",
          icon: APP_ICON,
          badge: APP_ICON,
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: id,
          showTrigger: new TimestampTrigger(endTime),
          data: { url: url || "/" }
        }).catch(err => console.warn("[SW] showTrigger failed:", err))
      );
      return;
    }

    event.waitUntil(new Promise(resolve => {
      const timeout = setTimeout(async () => {
        await self.registration.showNotification(title || "Study Grid Prep", {
          body: body || "",
          icon: APP_ICON,
          badge: APP_ICON,
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
