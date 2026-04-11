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
  const title = payload.notification.title;
  const options = {
    body: payload.notification.body,
    icon: "/icon-192.png"
  };
  self.registration.showNotification(title, options);
});

// ─── Study Grid Prep – Advanced Service Worker ───────────────────────────────
const CACHE = "uw-cache-v25"; // ← version bump important hai

const ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/focus.html",
  "/todo.html",
  "/profile.html",
  "/subscription.html",
  "/timer.html",
  "/playlist.html",
  "/mock.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/background.webp"
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const req = event.request;

  // External requests ignore karo
  if (!req.url.startsWith(self.location.origin)) return;

  // 🔥 NAVIGATION REQUEST — Stale While Revalidate strategy
  if (req.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(req);

        // Background mein network se update karo
        const networkFetch = fetch(req)
          .then(res => {
            if (res && res.status === 200) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => null);

        // Cache hai → turant dikha, background mein update karo
        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }

        // Cache nahi → network try karo
        const networkRes = await networkFetch;
        if (networkRes) return networkRes;

        // Dono fail → offline page
        return (await cache.match("/offline.html")) || getOfflinePage();
      })
    );
    return;
  }

  // 🔥 STATIC FILES — Stale While Revalidate
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);

      const networkFetch = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // Cache instant return, background update
      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      // Cache nahi toh network wait karo
      const networkRes = await networkFetch;
      if (networkRes) return networkRes;

      // Dono fail
      return new Response("", { status: 408, statusText: "Offline" });
    })
  );
});

// ── MESSAGE ──────────────────────────────────────────────────────────────────
const scheduledNotifications = new Map();

self.addEventListener("message", event => {
  const data = event.data;
  if (!data) return;

  if (data === "skipWaiting" || data.type === "skipWaiting") {
    self.skipWaiting();
    return;
  }

  // ✅ NET WAPAS AYA → Sab clients ko reload karo
  if (data.type === "CLIENT_ONLINE") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then(clientList => {
        clientList.forEach(client => {
          client.postMessage({ type: "RELOAD_NOW" });
        });
      })
    );
    return;
  }

  if (data.type === "SCHEDULE_NOTIFICATION") {
    const { id = "default", endTime, title, body, url } = data;
    const delay = endTime - Date.now();

    if (scheduledNotifications.has(id)) {
      const existing = scheduledNotifications.get(id);
      clearTimeout(existing.timeout);
      existing.resolve();
      scheduledNotifications.delete(id);
    }

    if (delay <= 0) return;

    event.waitUntil(new Promise(resolve => {
      const timeout = setTimeout(async () => {
        await self.registration.showNotification(title || "Study Grid Prep", {
          body: body || "",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
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
      const existing = scheduledNotifications.get(id);
      clearTimeout(existing.timeout);
      existing.resolve();
      scheduledNotifications.delete(id);
    }
    return;
  }
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data ? event.notification.data.url : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── OFFLINE PAGE FALLBACK ─────────────────────────────────────────────────────
async function getOfflinePage() {
  const cache = await caches.open(CACHE);
  const cached = await cache.match("/offline.html");
  if (cached) return cached;

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline – Study Grid Prep</title>
<style>
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
font-family:sans-serif;background:#f5f6fa;text-align:center;}
button{margin-top:20px;padding:12px 24px;border:none;border-radius:10px;
background:#ff7a18;color:white;font-size:16px;cursor:pointer;}
</style>
</head>
<body>
<div>
<h2>📡 Offline</h2>
<p>Check your internet connection</p>
<button onclick="location.reload()">Retry</button>
</div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}