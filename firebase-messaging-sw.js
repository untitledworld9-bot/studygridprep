// ─── Untitled World – FCM Background Messaging + PWA Cache Service Worker ────
// Must be named exactly "firebase-messaging-sw.js" for FCM to work.
//
// This single file replaces BOTH firebase-messaging-sw.js AND sw.js.
// ─────────────────────────────────────────────────────────────────────────────

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs",
  authDomain:        "untitled-world-2e645.firebaseapp.com",
  projectId:         "untitled-world-2e645",
  messagingSenderId: "990115586087",
  appId:             "1:990115586087:web:963f68bd59dec5ef0c6e02"
});

const messaging = firebase.messaging();

// ── BACKGROUND MESSAGE ─────────────────────────────────────────────────────
// payload.notification → title/body set in Firebase Console or FCM API
// payload.data         → custom keys, e.g. { url: "/todo.html" }
messaging.onBackgroundMessage(function(payload) {

  const notification = payload.notification || {};
  const data         = payload.data         || {};

  const title = notification.title || "Untitled World";
  const body  = notification.body  || "";
  // data.url: relative ("/todo.html") or absolute ("https://...")
  const url   = data.url || "/";

  self.registration.showNotification(title, {
    body,
    icon    : "/icon-192.png",
    badge   : "/icon-192.png",
    vibrate : [200, 100, 200],
    data    : { url },       // passed through to notificationclick
    actions : [
      { action: "open", title: "Open" }
    ]
  });
});

// ── NOTIFICATION CLICK ─────────────────────────────────────────────────────
// Tapping the notification opens the app at the correct page.
// data.url is set from payload.data.url sent by admin/FCM.
self.addEventListener("notificationclick", function(event) {

  event.notification.close();

  const rawUrl      = (event.notification.data && event.notification.data.url) || "/";
  const absoluteUrl = rawUrl.startsWith("http")
    ? rawUrl
    : "https://untitledworld.us.cc" + rawUrl;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        // If a tab already shows that exact URL, focus it
        for (const client of clientList) {
          if (client.url === absoluteUrl && "focus" in client) {
            return client.focus();
          }
        }
        // If any app tab is open, navigate it to the target URL
        for (const client of clientList) {
          if (client.url.includes("untitledworld.us.cc") && "navigate" in client) {
            return client.navigate(absoluteUrl).then(c => c && c.focus());
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(absoluteUrl);
        }
      })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  PWA OFFLINE CACHING  (merged from sw.js)
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = "uw-cache-v22";

const ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/focus.html",
  "/todo.html",
  "/profile.html",
  "/subscription.html",
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

  // Only handle same-origin GET requests
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  // ── HTML NAVIGATION — network first, NO caching of HTML ───────────────────
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => res)
        .catch(async () => {
          const cache   = await caches.open(CACHE);
          const offline = await cache.match("/offline.html");
          return offline || getOfflinePage();
        })
    );
    return;
  }

  // ── STATIC ASSETS (JS, CSS, images, fonts) — cache first ──────────────────
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ── MESSAGE (AUTO UPDATE TRIGGER) ────────────────────────────────────────────
self.addEventListener("message", event => {

  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});

// ── SAFE OFFLINE PAGE ────────────────────────────────────────────────────────
async function getOfflinePage() {

  const cache  = await caches.open(CACHE);
  const cached = await cache.match("/offline.html");

  if (cached) return cached;

  return new Response(
`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title>
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
  { headers: { "Content-Type": "text/html" } });
}
