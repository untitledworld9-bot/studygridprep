/**
 * Study Grid Prep — Dynamic CMS Sitemap
 * Serves at: /sitemap-content.xml  (separate from your existing static
 * sitemap.xml — add both to Search Console, or reference this one from
 * a sitemap index if you prefer a single submission point.)
 *
 * Place this file at: /functions/sitemap-content.xml.js  (repo root)
 * Deploy to BOTH .online and .info repos — each will generate URLs for
 * its own domain automatically (destination-filtered).
 *
 * Queries Firestore's REST API directly (no SDK/auth needed — the
 * `content` collection's security rule already allows public read for
 * status == "published" documents).
 */

const PROJECT_ID = "untitled-world-2e645";

// Maps a content `type` to its URL path prefix — must match _redirects /
// [[catchall]].js. Add new types here as you add routes for them.
const TYPE_PREFIX = {
  blog: "blog",
  notes: "notes",
  formulaSheet: "formula-sheet",
  pyq: "pyq",
  mockTest: "mock",
  news: "news",
  examUpdate: "exam-update",
  collegeArticle: "college",
  careerGuide: "career"
};

function escapeXml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const domain = url.hostname.includes("studygridprep.info") ? "info" : "online";
  const baseUrl = `https://studygridprep.${domain}`;

  const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "content" }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
                  { fieldFilter: { field: { fieldPath: "destinations" }, op: "ARRAY_CONTAINS", value: { stringValue: domain } } }
                ]
              }
            },
            limit: 1000
          }
        })
      }
    );

    if (!res.ok) {
      return new Response(emptyXml, { status: 200, headers: { "Content-Type": "application/xml" } });
    }

    const rows = await res.json();
    const urls = [];

    for (const row of Array.isArray(rows) ? rows : []) {
      const doc = row.document;
      if (!doc) continue;
      const fields = doc.fields || {};
      const type = fields.type?.stringValue;
      const slug = fields.slug?.stringValue;
      const prefix = TYPE_PREFIX[type];
      if (!prefix || !slug) continue; // skip types without a routed URL yet

      const lastmod = doc.updateTime ? doc.updateTime.split("T")[0] : "";
      urls.push({ loc: `${baseUrl}/${prefix}/${escapeXml(slug)}`, lastmod });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;

    return new Response(xml, { headers: { "Content-Type": "application/xml" } });
  } catch (e) {
    return new Response(emptyXml, { status: 200, headers: { "Content-Type": "application/xml" } });
  }
}
