const CACHE = "uw-cache-v6";

const ASSETS = [
"/",
"/offline.html",
"/icon-192.png",
"/icon-512.png",
"/background.webp",
"/manifest.json"
];

self.addEventListener("install", e=>{
  self.skipWaiting();

  e.waitUntil(
    caches.open(CACHE).then(cache=>{
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e=>{

  if(e.request.mode === "navigate"){

    e.respondWith(
      fetch(e.request).catch(()=>{
        return caches.match("/offline.html");
      })
    );

    return;
  }

  e.respondWith(
    caches.match(e.request).then(res=>{
      return res || fetch(e.request);
    })
  );

});