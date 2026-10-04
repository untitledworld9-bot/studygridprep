// ─── Study Grid Prep – FCM Background Messaging Service Worker ──────────────
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

function savePushToIndexedDB(notifData) {
  try {
    const req = indexedDB.open("sgp_push_db", 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("push_notifs")) {
        db.createObjectStore("push_notifs", { keyPath: "id" });
      }
    };
    req.onsuccess = function(e) {
      const db = e.target.result;
      const tx = db.transaction("push_notifs", "readwrite");
      const store = tx.objectStore("push_notifs");
      const id = notifData.id || "push_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      store.put({
        id: id,
        title: notifData.title || "Study Grid Prep",
        body: notifData.body || "",
        image: notifData.image || null,
        icon: notifData.icon || "/icon-192.png",
        url: notifData.url || "/",
        ts: notifData.ts || Date.now(),
        source: "push"
      });
    };
  } catch(err) {
    console.warn("[FCM SW] IDB save error:", err);
  }
}

// ── BACKGROUND MESSAGE ─────────────────────────────────────────────────────
messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const data         = payload.data         || {};

  const title = notification.title || data.title || "Study Grid Prep";
  const body  = notification.body  || data.body  || data.message || "";
  const url   = data.url || notification.click_action || "/";
  const image = notification.image || data.image || data.imageUrl || null;

  self.registration.showNotification(title, {
    body,
    icon    : "/icon-192.png",
    badge   : "/icon-192.png",
    image   : image || undefined,
    vibrate : [200, 100, 200],
    data    : { url },
    actions : [{ action: "open", title: "Open" }]
  });

  savePushToIndexedDB({ title, body, image, icon: "/icon-192.png", url, ts: Date.now() });

  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: "PUSH_NOTIFICATION",
        notification: { title, body, image, icon: "/icon-192.png", url, ts: Date.now() }
      });
    });
  });
});

// ── NOTIFICATION CLICK ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  const rawUrl = (event.notification.data && event.notification.data.url) || "/";
  const origin = self.location.origin;
  const absoluteUrl = rawUrl.startsWith("http") ? rawUrl : (origin + (rawUrl.startsWith("/") ? "" : "/") + rawUrl);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === absoluteUrl && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clientList) {
          if (client.url.startsWith(origin) && "navigate" in client) {
            return client.navigate(absoluteUrl).then(c => c && c.focus());
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(absoluteUrl);
        }
      })
  );
});
