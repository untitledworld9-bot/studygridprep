/**
 * Study Grid Prep — Cloudflare Pages Function
 * Serves content-render.html for all CMS content paths WITHOUT
 * redirecting/changing the URL (unlike _redirects, which Cloudflare
 * auto-redirects to the .html file's "clean URL", breaking our routes).
 *
 * Also injects per-content Open Graph meta tags (title/description/image)
 * for content.html, college-view.html, notes-hub-view.html — these pages
 * are pure client-side (Firestore fetch happens in JS), so link-preview
 * crawlers (WhatsApp, Telegram, etc.) never ran that JS and only ever
 * saw the blank static <head> — hence no preview card when sharing.
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

// ── Per-content OG tag injection (new) ─────────────────────────────────
const FIREBASE_PROJECT_ID = "untitled-world-2e645";
const FIREBASE_API_KEY = "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs";
// TODO: point this at your actual default share image if you have one —
// used only when a piece of content has no image of its own.
const DEFAULT_OG_IMAGE = "https://studygridprep.online/assets/og-default.jpg";

const OG_VIEWS = {
  "content.html": { collection: "content" },
  "college-view.html": { collection: "collegeInfo" },
  "notes-hub-view.html": { collection: "notes" }
};

function fsValue(v) {
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("mapValue" in v) return fsFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsValue);
  return undefined;
}
function fsFields(fields) {
  const out = {};
  for (const k in fields) out[k] = fsValue(fields[k]);
  return out;
}

async function getFirestoreDoc(collectionName, id) {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}?key=${FIREBASE_API_KEY}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.fields ? fsFields(json.fields) : null;
  } catch (e) {
    return null;
  }
}

// Same field priority each page already uses client-side to render itself.
function ogFieldsFor(fileName, d) {
  if (!d) return null;
  if (fileName === "content.html") {
    const title = d.title || "Study Grid Prep";
    const description = d.description || "";
    const image = d.thumbnailUrl || d.imageUrl || (d.seo && d.seo.ogImage) || DEFAULT_OG_IMAGE;
    return { title, description, image };
  }
  if (fileName === "college-view.html") {
    const title = d.name || "College";
    const description = (d.seo && d.seo.metaDescription) ||
      `${title} — fees, cutoffs, placements and reviews on Study Grid Prep.`;
    const image = d.logoUrl || DEFAULT_OG_IMAGE;
    return { title, description, image };
  }
  if (fileName === "notes-hub-view.html") {
    const title = d.chapterName || "Notes";
    const description = `Download ${title} notes on Study Grid Prep.`;
    const image = DEFAULT_OG_IMAGE;
    return { title, description, image };
  }
  return null;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[m]));
}

class HeadAppender {
  constructor(meta, pageUrl) { this.meta = meta; this.pageUrl = pageUrl; }
  element(el) {
    const { title, description, image } = this.meta;
    el.append(`
<meta property="og:type" content="article">
<meta property="og:site_name" content="Study Grid Prep">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(this.pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
`, { html: true });
  }
}
class TitleReplacer {
  constructor(title) { this.title = title; }
  element(el) { el.setInnerContent(this.title); }
}

function injectOgTags(assetResponse, meta, pageUrl) {
  if (!meta) return assetResponse;
  return new HTMLRewriter()
    .on("head", new HeadAppender(meta, pageUrl))
    .on("title", new TitleReplacer(`${meta.title} - Study Grid Prep`))
    .transform(assetResponse);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] || "";

  if (segments.length >= 1 && CONTENT_PREFIXES.includes(segments[0])) {
    const assetUrl = new URL("/content-render.html", url.origin);
    // Return the fetched Response object directly — no reconstruction,
    // no header copying. This avoids content-encoding/length mismatches
    // that cause a blank page. The browser's address bar still keeps
    // the original /blog/slug URL since this is a Function response,
    // not a redirect.
    return context.env.ASSETS.fetch(assetUrl);
  }

  // Per-content OG tags for content.html / college-view.html / notes-hub-view.html
  const ogView = OG_VIEWS[fileName];
  if (ogView) {
    const id = url.searchParams.get("id");
    const assetResponse = await context.next();
    if (!id) return assetResponse;
    const doc = await getFirestoreDoc(ogView.collection, id);
    const meta = ogFieldsFor(fileName, doc);
    return injectOgTags(assetResponse, meta, url.href);
  }

  // Not a content path — let normal static asset serving handle it.
  return context.next();
}
