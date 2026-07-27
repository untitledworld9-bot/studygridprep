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
 * ============================================================
 */
(function () {
  var OFFLINE_PATH = '/offline.html';

  function alreadyOnOfflinePage() {
    return location.pathname.indexOf('offline.html') !== -1;
  }

  function goOffline() {
    if (alreadyOnOfflinePage()) return;
    try {
      // Remember where we were, so offline.html can send the user back
      // to the exact page once the connection returns.
      sessionStorage.setItem('sgp_offline_from', location.pathname + location.search);
    } catch (e) {}
    location.replace(OFFLINE_PATH);
  }

  // Instant check — catches the case where the page was opened while
  // already offline (e.g. tapped from a home-screen icon with no signal).
  if (!navigator.onLine && !alreadyOnOfflinePage()) {
    goOffline();
    return;
  }

  // Instant redirect the moment connectivity drops mid-session.
  window.addEventListener('offline', goOffline);
})();
