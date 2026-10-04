/**
 * Study Grid Prep — Cloudflare Pages Function
 * Serves content-render.html for all CMS content paths WITHOUT
 * redirecting/changing the URL.
 *
 * Injects rich per-content Open Graph and Twitter meta tags
 * (title, description, dynamic image / article image block, and fallback to icon-192.png)
 * for WhatsApp, Telegram, Facebook, Twitter, LinkedIn, and other social scrapers.
 */

const CONTENT_PREFIXES = [
  "blog", "notes", "formula-sheet", "pyq", "mock",
  "news", "exam-update", "college", "career", "guide"
];

const FIREBASE_PROJECT_ID = "untitled-world-2e645";
const FIREBASE_API_KEY = "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs";
const DEFAULT_FALLBACK_ICON = "https://studygridprep.online/icon-192.png";

const OG_VIEWS = {
  "content": { collection: "content", page: "content", file: "content.html" },
  "content.html": { collection: "content", page: "content", file: "content.html" },
  "college-view": { collection: "collegeInfo", page: "college", file: "college-view.html" },
  "college-view.html": { collection: "collegeInfo", page: "college", file: "college-view.html" },
  "notes-hub-view": { collection: "notes", page: "notes", file: "notes-hub-view.html" },
  "notes-hub-view.html": { collection: "notes", page: "notes", file: "notes-hub-view.html" },
  "notes-download": { collection: "notes", page: "notes", file: "notes-download.html" },
  "notes-download.html": { collection: "notes", page: "notes", file: "notes-download.html" }
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
  if (!id) return null;
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

function toAbsoluteUrl(img, origin) {
  if (!img) return "";
  const s = String(img).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = origin || "https://studygridprep.online";
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
}

function extractImage(d, origin, fallback) {
  if (!d) return fallback;
  let found = d.thumbnailUrl || d.imageUrl || d.image || d.thumbnail || d.coverImage || d.logoUrl || d.bannerUrl;
  if (!found && d.seo && d.seo.ogImage) found = d.seo.ogImage;

  // Search inside data.blocks, blocks, overviewBlocks for the first image block
  if (!found) {
    const blocks = (d.data && Array.isArray(d.data.blocks)) ? d.data.blocks :
                   (Array.isArray(d.blocks) ? d.blocks :
                   (Array.isArray(d.overviewBlocks) ? d.overviewBlocks : []));
    for (const b of blocks) {
      if (b && (b.type === "image" || b.kind === "image") && b.url) {
        found = b.url;
        break;
      }
    }
  }

  return found ? toAbsoluteUrl(found, origin) : fallback;
}

function ogFieldsFor(pageType, d, origin) {
  const defaultImg = toAbsoluteUrl("/icon-192.png", origin) || DEFAULT_FALLBACK_ICON;
  if (!d) {
    return {
      title: "Study Grid Prep",
      description: "Practice mock tests, explore colleges, read exam updates, and access study materials on Study Grid Prep.",
      image: defaultImg
    };
  }

  if (pageType === "content") {
    const title = d.title || (d.seo && d.seo.metaTitle) || "Study Grid Prep";
    const description = (d.seo && d.seo.metaDescription) || d.description || "Read this exam update & article on Study Grid Prep.";
    const image = extractImage(d, origin, defaultImg);
    return { title, description, image };
  }

  if (pageType === "college") {
    const title = d.name || (d.seo && d.seo.metaTitle) || "College";
    const description = (d.seo && d.seo.metaDescription) || `${title} — fees, cutoffs, placements and reviews on Study Grid Prep.`;
    const image = extractImage(d, origin, defaultImg);
    return { title, description, image };
  }

  if (pageType === "notes") {
    const title = d.chapterName || d.title || "Notes";
    const description = (d.seo && d.seo.metaDescription) || `Download ${title} handwritten and chapter notes on Study Grid Prep.`;
    const image = extractImage(d, origin, defaultImg);
    return { title, description, image };
  }

  return {
    title: d.title || d.name || "Study Grid Prep",
    description: (d.seo && d.seo.metaDescription) || d.description || "Study Grid Prep",
    image: extractImage(d, origin, defaultImg)
  };
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
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:url" content="${esc(this.pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="description" content="${esc(description)}">
`, { html: true });
  }
}

class TitleReplacer {
  constructor(title) { this.title = title; }
  element(el) { el.setInnerContent(`${this.title} - Study Grid Prep`); }
}

function injectOgTags(assetResponse, meta, pageUrl) {
  if (!meta) return assetResponse;
  return new HTMLRewriter()
    .on("head", new HeadAppender(meta, pageUrl))
    .on("title", new TitleReplacer(meta.title))
    .transform(assetResponse);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const rawKey = segments[segments.length - 1] || "";
  const keyWithoutExt = rawKey.replace(/\.html$/i, "");

  // 1. CMS Routes (/blog/*, /exam-update/*, etc.)
  if (segments.length >= 1 && CONTENT_PREFIXES.includes(segments[0])) {
    const assetUrl = new URL("/content-render.html", url.origin);
    const assetResponse = await context.env.ASSETS.fetch(assetUrl);
    return assetResponse;
  }

  // 2. Dynamic content pages: content, college-view, notes-hub-view, notes-download
  const ogView = OG_VIEWS[rawKey] || OG_VIEWS[keyWithoutExt];
  if (ogView) {
    const id = url.searchParams.get("id");
    const assetResponse = await context.next();
    if (!id) {
      const defaultMeta = ogFieldsFor(ogView.page, null, url.origin);
      return injectOgTags(assetResponse, defaultMeta, url.href);
    }

    const doc = await getFirestoreDoc(ogView.collection, id);
    const meta = ogFieldsFor(ogView.page, doc, url.origin);
    return injectOgTags(assetResponse, meta, url.href);
  }

  // Normal static asset serving
  return context.next();
}
