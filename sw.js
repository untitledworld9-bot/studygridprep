// ─── Untitled World – Service Worker ───────────────────────────────────────
// Strategy:
//   • Navigation  → Network-first  → cache fallback → offline.html fallback
//   • Static      → Cache-first    → network fallback
// ────────────────────────────────────────────────────────────────────────────

const CACHE = "uw-cache-v12";          // ← bumped from v11 to force fresh install

const ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/focus.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/background.webp"
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting();                 // activate immediately on first install

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

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {

  // ── Navigation requests (HTML page loads) ──────────────────────────────────
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => serveCachedPageOrOffline(event.request))
    );
    return;
  }

  // ── Static assets (cache-first) ────────────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Core helper: serve a navigation request from cache ───────────────────────
// Uses a 4-layer matching chain so path quirks can never cause a miss.
async function serveCachedPageOrOffline(request) {
  const cache = await caches.open(CACHE);
  const url   = new URL(request.url);

  // ── Layer 1 ─ Exact request match (full URL, as the browser sent it)
  //    This is the most reliable match; it hits when the URL is identical to
  //    what cache.addAll() stored (same origin + pathname, no query string).
  let response = await cache.match(request, { ignoreVary: true });
  if (response) return response;

  // ── Layer 2 ─ Canonical URL (origin + pathname, query string stripped)
  //    Guards against cases like /focus.html?v=2 not matching /focus.html.
  const canonicalUrl = url.origin + url.pathname;
  response = await cache.match(canonicalUrl, { ignoreVary: true });
  if (response) return response;

  // ── Layer 3 ─ Pathname resolved against the SW's own origin
  //    Handles rare browsers that don't resolve bare strings the same way.
  const resolvedUrl = new URL(url.pathname, self.location.origin).href;
  response = await cache.match(resolvedUrl, { ignoreVary: true });
  if (response) return response;

  // ── Layer 4 ─ Trailing-slash variants
  //    Catches /focus.html/ ↔ /focus.html mismatches.
  const withoutSlash = url.pathname.replace(/\/$/, "");
  const withSlash    = withoutSlash + "/";
  response = await cache.match(new URL(withoutSlash, self.location.origin).href, { ignoreVary: true })
          || await cache.match(new URL(withSlash,    self.location.origin).href, { ignoreVary: true });
  if (response) return response;

  // ── Nothing matched → serve offline.html ───────────────────────────────────
  return getOfflinePage();
}

// ── Helper: always return a valid Response for the offline page ───────────────
async function getOfflinePage() {
  const cache  = await caches.open(CACHE);
  const cached = await cache.match("/offline.html", { ignoreVary: true })
              || await cache.match(new URL("/offline.html", self.location.origin).href, { ignoreVary: true });

  if (cached) return cached;

  // Last-resort inline fallback – guarantees NO ERR_FAILED ever appears
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title>
<style>
  body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;
       justify-content:center;font-family:system-ui,sans-serif;background:#f4f6f8;text-align:center;}
  button{margin-top:24px;padding:12px 28px;border:none;border-radius:12px;
         background:#ff7a18;color:#fff;font-size:16px;font-weight:600;cursor:pointer;}
</style>
</head>
<body>
  <h1>📡 You're Offline</h1>
  <p>Please check your internet connection.</p>
  <button onclick="location.href='/'">Retry</button>
  <script>window.addEventListener("online",()=>location.href="/");<\/script>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
