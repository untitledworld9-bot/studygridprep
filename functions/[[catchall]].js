/**
 * Study Grid Prep — Cloudflare Pages Function
 * Serves content-render.html for all CMS content paths WITHOUT
 * redirecting/changing the URL (unlike _redirects, which Cloudflare
 * auto-redirects to the .html file's "clean URL", breaking our routes).
 *
 * Place this file at: /functions/[[catchall]].js  (repo root)
 * Works alongside your existing _redirects file — you can leave the
 * old /blog/* etc. lines in _redirects, they just won't be reached
 * anymore since this Function runs first. No need to delete them.
 */

const CONTENT_PREFIXES = [
  "blog", "notes", "formula-sheet", "pyq", "mock",
  "news", "exam-update", "college", "career", "guide"
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length >= 1 && CONTENT_PREFIXES.includes(segments[0])) {
    const assetUrl = new URL("/content-render.html", url.origin);
    // Return the fetched Response object directly — no reconstruction,
    // no header copying. This avoids content-encoding/length mismatches
    // that cause a blank page. The browser's address bar still keeps
    // the original /blog/slug URL since this is a Function response,
    // not a redirect.
    return context.env.ASSETS.fetch(assetUrl);
  }

  // Not a content path — let normal static asset serving handle it.
  return context.next();
}
