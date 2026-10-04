import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const FIREBASE_PROJECT_ID = "untitled-world-2e645";
const FIREBASE_API_KEY = "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs";
const DEFAULT_FALLBACK_ICON = "https://studygridprep.online/icon-192.png";

// CMS content prefixes mapped to content-render.html
const CONTENT_PREFIXES = [
  '/blog/*',
  '/notes/*',
  '/formula-sheet/*',
  '/pyq/*',
  '/mock/*',
  '/news/*',
  '/exam-update/*',
  '/college/*',
  '/career/*',
  '/guide/*'
];

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

function toAbsoluteUrl(img, req) {
  if (!img) return "";
  const s = String(img).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const host = req.get('host') || 'studygridprep.online';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const origin = `${protocol}://${host}`;
  return s.startsWith("/") ? `${origin}${s}` : `${origin}/${s}`;
}

function extractImage(d, req, fallback) {
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

  return found ? toAbsoluteUrl(found, req) : fallback;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[m]));
}

function ogFieldsFor(pageType, d, req) {
  const defaultImg = toAbsoluteUrl("/icon-192.png", req) || DEFAULT_FALLBACK_ICON;
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
    const image = extractImage(d, req, defaultImg);
    return { title, description, image };
  }

  if (pageType === "college") {
    const title = d.name || (d.seo && d.seo.metaTitle) || "College";
    const description = (d.seo && d.seo.metaDescription) || `${title} — fees, cutoffs, placements and reviews on Study Grid Prep.`;
    const image = extractImage(d, req, defaultImg);
    return { title, description, image };
  }

  if (pageType === "notes") {
    const title = d.chapterName || d.title || "Notes";
    const description = (d.seo && d.seo.metaDescription) || `Download ${title} handwritten and chapter notes on Study Grid Prep.`;
    const image = extractImage(d, req, defaultImg);
    return { title, description, image };
  }

  return {
    title: d.title || d.name || "Study Grid Prep",
    description: (d.seo && d.seo.metaDescription) || d.description || "Study Grid Prep",
    image: extractImage(d, req, defaultImg)
  };
}

function injectOgIntoHtml(htmlStr, meta, fullUrl) {
  const { title, description, image } = meta;
  const ogTags = `
<title>${esc(title)} - Study Grid Prep</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Study Grid Prep">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:url" content="${esc(fullUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
`;
  const cleaned = htmlStr
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');

  return cleaned.replace(/<head>/i, `<head>${ogTags}`);
}

// ── Per-content dynamic OG route handler ──
async function handleDynamicOgRoute(req, res, targetFile, pageType, collectionName) {
  const filePath = path.join(__dirname, targetFile);
  let html = '';
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return res.status(404).send('Page not found');
  }

  const id = req.query.id;
  const fullUrl = req.protocol + '://' + (req.get('host') || 'studygridprep.online') + req.originalUrl;

  if (!id) {
    const meta = ogFieldsFor(pageType, null, req);
    return res.type('html').send(injectOgIntoHtml(html, meta, fullUrl));
  }

  const doc = await getFirestoreDoc(collectionName, id);
  const meta = ogFieldsFor(pageType, doc, req);
  return res.type('html').send(injectOgIntoHtml(html, meta, fullUrl));
}

// Dynamic OpenGraph routes for sharing
app.get(['/content', '/content.html'], (req, res) => handleDynamicOgRoute(req, res, 'content.html', 'content', 'content'));
app.get(['/college-view', '/college-view.html'], (req, res) => handleDynamicOgRoute(req, res, 'college-view.html', 'college', 'collegeInfo'));
app.get(['/notes-hub-view', '/notes-hub-view.html'], (req, res) => handleDynamicOgRoute(req, res, 'notes-hub-view.html', 'notes', 'notes'));
app.get(['/notes-download', '/notes-download.html'], (req, res) => handleDynamicOgRoute(req, res, 'notes-download.html', 'notes', 'notes'));

// Serve content-render.html for dynamic CMS routes
app.get(CONTENT_PREFIXES, (req, res) => {
  res.sendFile(path.join(__dirname, 'content-render.html'));
});

// Serve static files with automatic .html extension resolution
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for non-matching GET requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Grid Prep server running on http://0.0.0.0:${PORT}`);
});
