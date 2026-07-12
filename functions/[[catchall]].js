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
    const assetResponse = await context.env.ASSETS.fetch(new Request(assetUrl, context.request));

    // Strip encoding/length headers — the fetched body is already decoded,
    // but these headers (if copied as-is) tell the browser it's still
    // gzip-compressed, which causes a blank/corrupted page.
    const headers = new Headers(assetResponse.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");

    return new Response(assetResponse.body, {
      status: 200,
      headers
    });
  }

  // Not a content path — let normal static asset serving handle it.
  return context.next();
      }
