/**
 * offline-guard.js — Study Grid Prep
 * ============================================================
 * Add this ONE line to every page EXCEPT todo.html and focus.html:
 *
 *   <script src="/offline-guard.js"></script>
 *
 * (put it early in <head>, right after the theme script is fine)
 *
 * Todo and Focus Timer are intentionally excluded — both already work
 * fully offline (tasks saved on device, timer keeps running locally),
 * so redirecting them away on a dropped connection would interrupt
 * something that's actually still working. Every other page has no
 * real offline functionality, so it should hand off to the branded
 * /offline.html screen immediately instead of leaving the browser to
 * show its own raw "This site can't be reached" error page.
 *
 * ✅ FIX: the 'offline' browser event alone is NOT reliable — on
 * Android/Chrome it's based on OS network-interface changes and can
 * fail to fire promptly (or at all) when mobile data is toggled off,
 * even though the connection is genuinely gone. So this now ALSO
 * actively polls a tiny same-origin resource every few seconds with a
 * short timeout; if that fails, it treats it as offline regardless of
 * whether the 'offline' event ever fired. The event listener is kept
 * as a fast-path for the cases where it DOES fire correctly.
 * ============================================================
 */
(function () {
  var OFFLINE_PATH = '/offline.html';
  var PING_URL = '/manifest.json';   // small, always-cached file
  var POLL_MS = 4000;
  var TIMEOUT_MS = 3000;

  function alreadyOnOfflinePage() {
    return location.pathname.indexOf('offline.html') !== -1;
  }

  function goOffline() {
    if (alreadyOnOfflinePage()) return;
    try {
      sessionStorage.setItem('sgp_offline_from', location.pathname + location.search);
    } catch (e) {}
    location.replace(OFFLINE_PATH);
  }

  function pingOnce() {
    if (alreadyOnOfflinePage()) return;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    fetch(PING_URL + '?t=' + Date.now(), { cache: 'no-store', signal: controller.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res || !res.ok) goOffline();
      })
      .catch(function () {
        clearTimeout(timer);
        goOffline();
      });
  }

  // Instant check on load — catches the case where the page was opened
  // while already offline (e.g. tapped from a home-screen icon with no signal).
  if (!navigator.onLine && !alreadyOnOfflinePage()) {
    goOffline();
    return;
  }

  // Fast-path: redirect immediately if the browser DOES fire this event.
  window.addEventListener('offline', goOffline);

  // Reliable path: active polling catches everything the event misses.
  setInterval(pingOnce, POLL_MS);
})();
