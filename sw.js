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
    console.warn("[SW] IDB push save error:", err);
  }
}

messaging.onBackgroundMessage(function(payload) {
  const n = payload.notification || {};
  const d = payload.data || {};

  const title = n.title || d.title || "Study Grid Prep";
  const body = n.body || d.body || d.message || "";
  const image = n.image || d.image || d.imageUrl || null;
  const url = d.url || n.click_action || "/";

  self.registration.showNotification(title, {
    body: body,
    icon: APP_ICON,
    badge: APP_ICON,
    image: image,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url: url }
  });

  savePushToIndexedDB({
    title,
    body,
    image,
    icon: APP_ICON,
    url,
    ts: Date.now()
  });

  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: "PUSH_NOTIFICATION",
        notification: {
          title,
          body,
          image,
          icon: APP_ICON,
          url,
          ts: Date.now()
        }
      });
    });
  });
});

self.addEventListener("push", function(event) {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch(e) {
    payload = { notification: { body: event.data.text() } };
  }
  const n = payload.notification || payload;
  const d = payload.data || {};
  const type = d.type || n.type || "exam-alert";
  let defaultTitle = "Study Grid Prep Alert 🔔";
  if (type === "exam" || type === "exam-alert") defaultTitle = "📢 Exam Alert - Study Grid Prep";
  else if (type === "reminder" || type === "study-reminder") defaultTitle = "⏰ Study Reminder - Time to Focus!";
  else if (type === "mock" || type === "test") defaultTitle = "📝 New Mock Test Available!";

  const title = n.title || d.title || defaultTitle;
  const body = n.body || d.body || d.message || "Important exam alerts & study reminders for students.";
  const image = n.image || d.image || d.imageUrl || null;
  const url = d.url || n.click_action || (type === "timer" ? "/timer.html" : type === "mock" ? "/mock.html" : "/dashboard-home.html");

  const actions = [
    { action: "open_app", title: "📖 Open App" },
    { action: "start_study", title: "⏱️ Start Timer" }
  ];

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: APP_ICON,
      badge: APP_ICON,
      image: image,
      tag: d.tag || ("sgp-" + type + "-" + Date.now()),
      renotify: true,
      vibrate: [250, 100, 250, 100, 250],
      requireInteraction: true,
      actions: actions,
      data: { url: url, type: type, ts: Date.now() }
    }).then(() => {
      savePushToIndexedDB({ title, body, image, icon: APP_ICON, url, type, ts: Date.now() });
      return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: "PUSH_NOTIFICATION",
            notification: { title, body, image, icon: APP_ICON, url, type, ts: Date.now() }
          });
        });
      });
    })
  );
});

// ── NOTIFICATION ACTION CLICK (EXAM ALERTS & STUDY REMINDERS) ──
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const d = event.notification.data || {};
  let targetUrl = d.url || "/dashboard-home.html";
  if (event.action === "start_study") {
    targetUrl = "/timer.html";
  } else if (event.action === "open_app") {
    targetUrl = d.url || "/dashboard-home.html";
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(async list => {
        for (const c of list) {
          if ("focus" in c) { await c.focus(); return; }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ── BACKGROUND SYNC & PERIODIC SYNC (PWABUILDER ENHANCEMENTS) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-study-progress' || event.tag === 'sync-notes' || event.tag === 'sync-todos') {
    event.waitUntil(
      (async () => {
        try {
          const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          allClients.forEach(client => {
            client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC', tag: event.tag });
          });
        } catch(e) {}
      })()
    );
  }
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-daily-streak' || event.tag === 'check-announcements') {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE);
          await cache.add('/dashboard-home.html').catch(() => {});
        } catch(e) {}
      })()
    );
  }
});
