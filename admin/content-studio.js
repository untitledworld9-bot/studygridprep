/**
 * ============================================================
 *  Study Grid Prep Admin Panel — content-studio.js
 *  Phase 3: unified content editor (blog / notes / guides / etc.)
 *  Writes to the `content` collection defined in firestore-schema.md
 *
 *  Import in studygridadmin.html:
 *    <script type="module" src="content-studio.js"></script>
 *  Requires firebase.js to already export the functions below.
 * ============================================================
 */

import {
  db, auth, collection, addDoc, doc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, limit, serverTimestamp
} from "../firebase.js";
import { sgpLogActivity } from "../activity-log.js";

const COLL_CONTENT = "content";

// ════════════════════════════════════════════════════════════
// AI CONTENT STUDIO — Phase 4 config
// Fill this in once your AI Cloudflare Worker is deployed.
// See the JSON contract documented above csAiGenerate() below —
// your worker must accept/return exactly that shape.
// ════════════════════════════════════════════════════════════
const AI_WORKER_URL = "https://sgp-content-ai.untitledworld9.workers.dev";

// ── tiny local helpers (kept self-contained, no coupling to admin.js internals) ──
const $ = id => document.getElementById(id);
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function csToast(message, type = "info") {
  // Reuses the admin panel's existing toast container if present, else no-ops quietly.
  if (typeof window.toast === "function") { window.toast(message, type); return; }
  console.log(`[${type}]`, message);
}
function slugify(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── state ──
const CS = {
  allContent: [],
  blocks: [],
  editingId: null,
  slugTouchedManually: false,
  aiGenerating: false,
  aiAbort: null
};

// ============================================================
//  LIST VIEW
// ============================================================
async function csLoadAuthorsDropdown() {
  const sel = $("csAuthor");
  if (!sel) return;
  try {
    const snap = await getDocs(collection(db, "authors"));
    const authors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sel.innerHTML = `<option value="">No author selected</option>` +
      authors.map(a => `<option value="${a.id}" data-name="${escHtml(a.name || "")}">${escHtml(a.name || "Unnamed")}</option>`).join("");
  } catch (e) {
    console.warn("Could not load authors:", e.message);
  }
}

async function csLoadCategoriesDropdown() {
  const sel = $("csCategory");
  if (!sel) return;
  try {
    const snap = await getDocs(collection(db, "categories"));
    const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sel.innerHTML = `<option value="">No category</option>` +
      categories.map(c => `<option value="${c.slug || c.id}">${escHtml(c.name || c.slug || "Unnamed")}</option>`).join("");
  } catch (e) {
    console.warn("Could not load categories:", e.message);
  }
}

async function csLoadContent() {
  try {
    const snap = await getDocs(query(collection(db, COLL_CONTENT), orderBy("updatedAt", "desc"), limit(200)));
    CS.allContent = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // Composite index / ordering issues fall back to client-side sort, same pattern as the rest of admin.js
    const snap = await getDocs(collection(db, COLL_CONTENT));
    CS.allContent = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    CS.allContent.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  }
  csRenderList();
}

function csRenderList() {
  const typeFilter = $("csFilterType")?.value || "";
  const statusFilter = $("csFilterStatus")?.value || "";
  const search = ($("csSearch")?.value || "").toLowerCase();

  let rows = CS.allContent.filter(c => {
    if (typeFilter && c.type !== typeFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (search && !(`${c.title} ${c.slug}`.toLowerCase().includes(search))) return false;
    return true;
  });

  // FIX-COUNT: show total content count (badge near "All Content") and,
  // whenever a filter/search is active, a "Showing X of Y" line so it's
  // always clear exactly how many items exist and how many match.
  const totalCountEl = $("csTotalCount");
  if (totalCountEl) totalCountEl.textContent = CS.allContent.length;

  const filterActive = !!(typeFilter || statusFilter || search);
  const countLineEl = $("csFilterCountLine");
  if (countLineEl) {
    countLineEl.textContent = filterActive
      ? `Showing ${rows.length} of ${CS.allContent.length} total`
      : `${CS.allContent.length} item${CS.allContent.length === 1 ? "" : "s"} total`;
  }

  const wrap = $("csTableWrap");
  if (!wrap) return;

  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="empty-state-text">No content matches these filters.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-scroll">
    <table class="admin-table" style="min-width:640px;">
      <thead><tr>
        <th>Title</th><th>Type</th><th>Status</th><th>Destinations</th><th>Updated</th><th style="min-width:90px;">Actions</th>
      </tr></thead>
      <tbody>
        ${rows.map(c => `
          <tr>
            <td><strong>${escHtml(c.title || "(untitled)")}</strong><br><span style="color:var(--text-muted);font-size:12px;">/${escHtml(c.slug || "")}</span></td>
            <td>${escHtml(c.type || "-")}</td>
            <td><span class="badge badge-${c.status === "published" ? "green" : c.status === "scheduled" ? "amber" : "gray"}">${escHtml(c.status || "draft")}</span></td>
            <td>${(c.destinations || []).map(d => `<span class="pill">${escHtml(d)}</span>`).join(" ")}</td>
            <td>${c.updatedAt?.seconds ? new Date(c.updatedAt.seconds * 1000).toLocaleDateString() : "-"}</td>
            <td style="white-space:nowrap;">
              <button class="btn btn-outline btn-sm" onclick="csEditContent('${c.id}')" style="margin-right:6px;"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-sm" onclick="csDeleteContent('${c.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    </div>`;
}

// ============================================================
//  EDITOR VIEW — open / new / edit
// ============================================================
function csShowList() {
  $("csListView").style.display = "";
  $("csEditorView").style.display = "none";
  csRenderList();
}

function csNewContent() {
  CS.editingId = null;
  CS.blocks = [];
  CS.slugTouchedManually = false;
  $("csType").value = "blog";
  $("csStatus").value = "draft";
  $("csTitle").value = "";
  $("csSlug").value = "";
  $("csCategory").value = "";
  $("csTags").value = "";
  $("csAccentColor").value = "primary";
  $("csAuthor").value = "";
  $("csDestOnline").checked = true;
  $("csDestInfo").checked = false;
  $("csMetaTitle").value = "";
  $("csMetaDesc").value = "";
  $("csKeywords").value = "";
  csRenderBlocks();
  csRenderPreview();
  $("csListView").style.display = "none";
  $("csEditorView").style.display = "";
}

async function csEditContent(id) {
  const docSnap = await getDoc(doc(db, COLL_CONTENT, id));
  if (!docSnap.exists()) { csToast("Content not found", "error"); return; }
  const c = docSnap.data();

  CS.editingId = id;
  CS.blocks = Array.isArray(c.data?.blocks) ? c.data.blocks : [];
  CS.slugTouchedManually = true; // don't auto-overwrite an existing slug

  $("csType").value = c.type || "blog";
  $("csStatus").value = c.status || "draft";
  $("csTitle").value = c.title || "";
  $("csSlug").value = c.slug || "";
  $("csCategory").value = c.category || "";
  $("csTags").value = (c.tags || []).join(", ");
  $("csAccentColor").value = c.accentColor || "primary";
  $("csAuthor").value = c.authorId || "";
  $("csDestOnline").checked = (c.destinations || []).includes("online");
  $("csDestInfo").checked = (c.destinations || []).includes("info");
  $("csMetaTitle").value = c.seo?.metaTitle || "";
  $("csMetaDesc").value = c.seo?.metaDescription || "";
  $("csKeywords").value = (c.seo?.keywords || []).join(", ");

  csRenderBlocks();
  csRenderPreview();
  $("csListView").style.display = "none";
  $("csEditorView").style.display = "";
}

async function csDeleteContent(id) {
  if (!confirm("Delete this content permanently? This cannot be undone.")) return;
  await deleteDoc(doc(db, COLL_CONTENT, id));
  csToast("Content deleted", "success");
  csLoadContent();
}

function csOnTitleInput() {
  if (!CS.slugTouchedManually) {
    $("csSlug").value = slugify($("csTitle").value);
  }
  csRenderPreview();
}
$("csSlug")?.addEventListener?.("input", () => { CS.slugTouchedManually = true; });

// ============================================================
//  BLOCK EDITOR
// ============================================================
function csBlockDefaults(type) {
  switch (type) {
    case "heading":   return { type, level: 2, text: "" };
    case "paragraph": return { type, text: "" };
    case "tip":       return { type, tone: "info", text: "" };
    case "image":     return { type, url: "", alt: "", size: "full" };
    case "table":     return { type, csv: "Column A, Column B\nValue 1, Value 2" };
    case "faq":       return { type, items: [{ q: "", a: "" }] };
    case "cta":       return { type, text: "", href: "", buttonLabel: "Get Started" };
    default:          return { type: "paragraph", text: "" };
  }
}

function csAddBlock(type) {
  CS.blocks.push(csBlockDefaults(type));
  csRenderBlocks();
  csRenderPreview();
}
function csRemoveBlock(i) { CS.blocks.splice(i, 1); csRenderBlocks(); csRenderPreview(); }
function csMoveBlock(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= CS.blocks.length) return;
  [CS.blocks[i], CS.blocks[j]] = [CS.blocks[j], CS.blocks[i]];
  csRenderBlocks(); csRenderPreview();
}
function csUpdateBlock(i, field, value) {
  CS.blocks[i][field] = value;
  csRenderPreview();
}
function csUpdateFaqItem(i, itemIdx, field, value) {
  CS.blocks[i].items[itemIdx][field] = value;
  csRenderPreview();
}
function csAddFaqItem(i) { CS.blocks[i].items.push({ q: "", a: "" }); csRenderBlocks(); csRenderPreview(); }

function csRenderBlocks() {
  const wrap = $("csBlockList");
  if (!wrap) return;
  if (!CS.blocks.length) {
    wrap.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">No blocks yet — add one above.</div>`;
    return;
  }
  wrap.innerHTML = CS.blocks.map((b, i) => `
    <div class="cs-block-card">
      <div class="cs-block-card-head">
        <span class="cs-block-type-label">${b.type}</span>
        <div class="cs-block-actions">
          <button onclick="csMoveBlock(${i},-1)" title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
          <button onclick="csMoveBlock(${i},1)" title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
          <button onclick="csRemoveBlock(${i})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      ${csBlockFieldsHtml(b, i)}
    </div>
  `).join("");
}

function csBlockFieldsHtml(b, i) {
  switch (b.type) {
    case "heading":
      return `
        <select class="form-select" style="margin-bottom:8px;" onchange="csUpdateBlock(${i},'level',parseInt(this.value))">
          <option value="2" ${b.level===2?"selected":""}>H2</option>
          <option value="3" ${b.level===3?"selected":""}>H3</option>
        </select>
        <input class="form-input" placeholder="Heading text" value="${escHtml(b.text)}" oninput="csUpdateBlock(${i},'text',this.value)" />`;
    case "paragraph":
      return `<textarea class="form-textarea" rows="3" placeholder="Paragraph text" oninput="csUpdateBlock(${i},'text',this.value)">${escHtml(b.text)}</textarea>`;
    case "tip":
      return `
        <select class="form-select" style="margin-bottom:8px;" onchange="csUpdateBlock(${i},'tone',this.value)">
          <option value="info" ${b.tone==="info"?"selected":""}>Info</option>
          <option value="warning" ${b.tone==="warning"?"selected":""}>Warning</option>
          <option value="success" ${b.tone==="success"?"selected":""}>Success</option>
        </select>
        <textarea class="form-textarea" rows="2" placeholder="Tip text" oninput="csUpdateBlock(${i},'text',this.value)">${escHtml(b.text)}</textarea>`;
    case "image":
      return `
        <input class="form-input" style="margin-bottom:8px;" placeholder="Image URL (paste from Media Library)" value="${escHtml(b.url)}" oninput="csUpdateBlock(${i},'url',this.value)" />
        <input class="form-input" style="margin-bottom:8px;" placeholder="Alt text (for SEO)" value="${escHtml(b.alt)}" oninput="csUpdateBlock(${i},'alt',this.value)" />
        <select class="form-select" onchange="csUpdateBlock(${i},'size',this.value)">
          <option value="small" ${b.size==="small"?"selected":""}>Small (40% width)</option>
          <option value="medium" ${b.size==="medium"?"selected":""}>Medium (65% width)</option>
          <option value="full" ${!b.size||b.size==="full"?"selected":""}>Full width</option>
        </select>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Use the ↑ ↓ arrows above to move this image earlier or later in the page.</div>`;
    case "table":
      return `<textarea class="form-textarea" rows="4" placeholder="Row 1 Col A, Row 1 Col B" oninput="csUpdateBlock(${i},'csv',this.value)">${escHtml(b.csv)}</textarea>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">One row per line, comma-separated. First row = header.</div>`;
    case "faq":
      return `
        ${b.items.map((it, idx) => `
          <input class="form-input" style="margin-bottom:6px;" placeholder="Question" value="${escHtml(it.q)}" oninput="csUpdateFaqItem(${i},${idx},'q',this.value)" />
          <textarea class="form-textarea" rows="2" style="margin-bottom:10px;" placeholder="Answer" oninput="csUpdateFaqItem(${i},${idx},'a',this.value)">${escHtml(it.a)}</textarea>
        `).join("")}
        <button class="btn btn-outline btn-sm" onclick="csAddFaqItem(${i})">+ Add Question</button>`;
    case "cta":
      return `
        <input class="form-input" style="margin-bottom:8px;" placeholder="Heading" value="${escHtml(b.text)}" oninput="csUpdateBlock(${i},'text',this.value)" />
        <input class="form-input" style="margin-bottom:8px;" placeholder="Button label" value="${escHtml(b.buttonLabel)}" oninput="csUpdateBlock(${i},'buttonLabel',this.value)" />
        <input class="form-input" placeholder="Button link" value="${escHtml(b.href)}" oninput="csUpdateBlock(${i},'href',this.value)" />`;
    default:
      return "";
  }
}

// ============================================================
//  AI CONTENT STUDIO — Phase 4
//
//  CONTRACT with your AI Cloudflare Worker:
//
//  REQUEST  (POST, JSON body):
//  {
//    "prompt": "user's instruction, e.g. 'Write a JEE Main 2027 prep guide'",
//    "contentType": "blog",              // current csType value
//    "existingTitle": "current title or empty string",
//    "existingBlocks": [ ...current CS.blocks... ],  // for edit/continue/rewrite requests
//    "action": "generate"                // one of: generate | continue | improve | rewrite | expand | shorten | seo
//  }
//
//  RESPONSE (JSON, single response — no streaming required):
//  {
//    "title": "Suggested page title",
//    "slug": "suggested-slug",                       // optional, auto-slugified if absent
//    "seo": {
//      "metaTitle": "...", "metaDescription": "...", "keywords": ["...","..."]
//    },
//    "blocks": [
//      { "type": "heading", "level": 2, "text": "..." },
//      { "type": "paragraph", "text": "..." },
//      { "type": "tip", "tone": "info", "text": "..." },
//      { "type": "table", "csv": "Col A, Col B\nVal 1, Val 2" },
//      { "type": "faq", "items": [{ "q": "...", "a": "..." }] },
//      { "type": "cta", "text": "...", "buttonLabel": "...", "href": "..." }
//    ]
//  }
//
//  Your AI prompt on the worker side should be instructed to
//  respond with ONLY this JSON — no markdown fences, no preamble —
//  so it can be parsed directly with JSON.parse().
// ============================================================

function csAiLog(text, cls = "") {
  const log = $("csAiLog");
  if (!log) return;
  const line = document.createElement("div");
  line.className = "cs-ai-line " + cls;
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function csAiClearLog() {
  const log = $("csAiLog");
  if (log) log.innerHTML = "";
}

const CS_BLOCK_LABELS = {
  heading: "Heading", paragraph: "Paragraph", tip: "Tip Box",
  image: "Image", table: "Table", faq: "FAQ Section", cta: "Call-to-Action"
};

async function csAiRevealBlocks(newBlocks, { replace = false } = {}) {
  if (replace) CS.blocks = [];
  for (const block of newBlocks) {
    if (CS.aiAbort?.signal.aborted) { csAiLog("Stopped by user.", "cs-ai-stop"); break; }
    csAiLog(`Generating ${CS_BLOCK_LABELS[block.type] || block.type}…`);
    await new Promise(r => setTimeout(r, 450)); // gives the "live build" feel
    CS.blocks.push(block);
    csRenderBlocks();
    csRenderPreview();
  }
}

async function csAiGenerate(action = "generate") {
  if (CS.aiGenerating) { csToast("Already generating — press Stop first", "error"); return; }

  const promptInput = $("csAiPrompt");
  const prompt = promptInput ? promptInput.value.trim() : "";
  if (action === "generate" && !prompt) { csToast("Type what you want the page to be about", "error"); return; }

  if (AI_WORKER_URL.includes("YOUR-WORKER-SUBDOMAIN")) {
    csToast("AI worker not configured yet — set AI_WORKER_URL in content-studio.js", "error");
    return;
  }

  CS.aiGenerating = true;
  CS.aiAbort = new AbortController();
  $("csAiSendBtn")?.setAttribute("disabled", "true");
  $("csAiStopBtn")?.removeAttribute("disabled");
  csAiClearLog();
  csAiLog(prompt ? `“${prompt}”` : `Running: ${action}`, "cs-ai-prompt-echo");

  try {
    const res = await fetch(AI_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: CS.aiAbort.signal,
      body: JSON.stringify({
        prompt,
        action,
        contentType: $("csType")?.value || "blog",
        existingTitle: $("csTitle")?.value || "",
        existingBlocks: CS.blocks
      })
    });
    if (!res.ok) {
      let detail = `Worker returned ${res.status}`;
      try { const errBody = await res.json(); if (errBody.error) detail += `: ${errBody.error}`; } catch {}
      throw new Error(detail);
    }
    const data = await res.json();

    if (data.title && (action === "generate" || !$("csTitle").value)) {
      $("csTitle").value = data.title;
      csOnTitleInput();
    }
    if (data.slug) { $("csSlug").value = data.slug; CS.slugTouchedManually = true; }
    if (data.seo) {
      if (data.seo.metaTitle) $("csMetaTitle").value = data.seo.metaTitle;
      if (data.seo.metaDescription) $("csMetaDesc").value = data.seo.metaDescription;
      if (data.seo.keywords) $("csKeywords").value = data.seo.keywords.join(", ");
    }

    const replaceBlocks = ["generate", "rewrite"].includes(action);
    await csAiRevealBlocks(data.blocks || [], { replace: replaceBlocks });

    if (!CS.aiAbort.signal.aborted) csAiLog("Done. Review and Save/Publish when ready.", "cs-ai-done");
  } catch (e) {
    if (e.name === "AbortError") {
      csAiLog("Generation stopped.", "cs-ai-stop");
    } else {
      console.error(e);
      csAiLog(`Error: ${e.message}`, "cs-ai-error");
      csToast("AI generation failed", "error");
    }
  } finally {
    CS.aiGenerating = false;
    CS.aiAbort = null;
    $("csAiSendBtn")?.removeAttribute("disabled");
    $("csAiStopBtn")?.setAttribute("disabled", "true");
  }
}

function csAiStop() {
  if (CS.aiAbort) CS.aiAbort.abort();
}

// Quick-action buttons: Continue / Improve / Rewrite / Expand / Shorten / SEO Optimize / Fix Grammar
function csAiQuickAction(action) {
  csAiGenerate(action);
}

// ============================================================
//  SEO AUTO-FILL — simple heuristic; the AI worker above also
//  returns seo{} directly when it generates a page.
// ============================================================
function csAutoFillSeo() {
  const title = $("csTitle").value.trim();
  if (title) $("csMetaTitle").value = title.length > 60 ? title.slice(0, 57) + "…" : title;

  const firstParagraph = CS.blocks.find(b => b.type === "paragraph")?.text || "";
  if (firstParagraph) {
    $("csMetaDesc").value = firstParagraph.length > 155 ? firstParagraph.slice(0, 152) + "…" : firstParagraph;
  }
  if (!$("csKeywords").value.trim()) {
    $("csKeywords").value = $("csTags").value;
  }
  csToast("SEO fields auto-filled — review before publishing", "info");
}

// ============================================================
//  LIVE PREVIEW — renders blocks using the actual design-system
//  components (design-system.css must be deployed at /design-system.css)
// ============================================================
function csBlocksToHtml() {
  return CS.blocks.map(b => {
    switch (b.type) {
      case "heading":
        return `<h${b.level}>${escHtml(b.text)}</h${b.level}>`;
      case "paragraph":
        return `<p>${escHtml(b.text)}</p>`;
      case "tip": {
        const toneColor = { info: "var(--primary)", warning: "var(--amber)", success: "var(--teal)" }[b.tone] || "var(--primary)";
        const toneBg = { info: "var(--primary-light)", warning: "var(--amber-light)", success: "var(--teal-light)" }[b.tone] || "var(--primary-light)";
        return `<div class="tip-box" style="border-color:${toneColor};background:${toneBg};"><p>${escHtml(b.text)}</p></div>`;
      }
      case "image": {
        const widthMap = { small: "40%", medium: "65%", full: "100%" };
        const w = widthMap[b.size] || "100%";
        return `<img src="${escHtml(b.url)}" alt="${escHtml(b.alt)}" style="width:${w};max-width:100%;border-radius:var(--radius);margin:20px auto;display:block;" />`;
      }
      case "table": {
        const rows = (b.csv || "").split("\n").filter(Boolean).map(r => r.split(",").map(c => c.trim()));
        const [head, ...body] = rows;
        return `<table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead><tr>${(head||[]).map(h=>`<th style="text-align:left;padding:8px;border-bottom:2px solid var(--border);font-family:var(--font);">${escHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${body.map(r=>`<tr>${r.map(c=>`<td style="padding:8px;border-bottom:1px solid var(--border-soft);">${escHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>`;
      }
      case "faq":
        return `<div class="faq-list" style="margin:20px 0;">${b.items.map(it => `
          <div class="faq-item open">
            <div class="faq-q">${escHtml(it.q)}</div>
            <div class="faq-a" style="max-height:none;padding:0 20px 18px;"><p>${escHtml(it.a)}</p></div>
          </div>`).join("")}</div>`;
      case "cta":
        return `<div class="article-cta-block" style="background:linear-gradient(135deg,var(--primary),var(--accent));">
          <h3>${escHtml(b.text)}</h3>
          <a href="${escHtml(b.href)}" class="btn-cta-white" style="color:var(--primary);">${escHtml(b.buttonLabel)}</a>
        </div>`;
      default:
        return "";
    }
  }).join("\n");
}

function csRenderPreview() {
  const frame = $("csPreviewFrame");
  if (!frame) return;
  const title = $("csTitle")?.value || "Untitled";
  const accentColor = $("csAccentColor")?.value || "primary";

  const accentMap = {
    primary: ["rgba(99,102,241,0.11)", "rgba(6,182,212,0.06)", "rgba(124,58,237,0.06)"],
    accent:  ["rgba(6,182,212,0.13)",  "rgba(99,102,241,0.05)", "rgba(13,148,136,0.06)"],
    teal:    ["rgba(13,148,136,0.13)", "rgba(6,182,212,0.05)",  "rgba(16,185,129,0.06)"],
    violet:  ["rgba(124,58,237,0.13)", "rgba(99,102,241,0.06)", "rgba(225,29,72,0.05)"],
    orange:  ["rgba(234,88,12,0.13)",  "rgba(217,119,6,0.06)",  "rgba(124,58,237,0.05)"],
    rose:    ["rgba(225,29,72,0.13)",  "rgba(124,58,237,0.05)", "rgba(217,119,6,0.05)"],
    amber:   ["rgba(217,119,6,0.13)",  "rgba(234,88,12,0.06)",  "rgba(124,58,237,0.05)"]
  };
  const [g1, g2, g3] = accentMap[accentColor] || accentMap.primary;
  const heroStyle = `--hero-glow-1:${g1};--hero-glow-2:${g2};--hero-glow-3:${g3};`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/design-system.css">
    </head><body>
      <div class="article-hero" style="padding:40px 5% 32px;${heroStyle}">
        <h1>${escHtml(title)}</h1>
      </div>
      <div class="article-body">
        ${csBlocksToHtml()}
      </div>
    </body></html>`;
  frame.srcdoc = html;
}

// ============================================================
//  SAVE
// ============================================================
async function csSaveContent(status) {
  const title = $("csTitle").value.trim();
  const slug = $("csSlug").value.trim() || slugify(title);
  if (!title) { csToast("Title is required", "error"); return; }
  if (!slug) { csToast("Slug is required", "error"); return; }

  const destinations = [];
  if ($("csDestOnline").checked) destinations.push("online");
  if ($("csDestInfo").checked) destinations.push("info");
  if (!destinations.length) { csToast("Pick at least one destination", "error"); return; }

  const payload = {
    type: $("csType").value,
    title,
    slug,
    status,
    destinations,
    category: $("csCategory").value.trim(),
    tags: $("csTags").value.split(",").map(t => t.trim()).filter(Boolean),
    accentColor: $("csAccentColor").value || "primary",
    authorId: $("csAuthor").value || null,
    authorName: $("csAuthor").value ? $("csAuthor").selectedOptions[0]?.dataset.name || null : null,
    seo: {
      metaTitle: $("csMetaTitle").value.trim() || title,
      metaDescription: $("csMetaDesc").value.trim(),
      keywords: $("csKeywords").value.split(",").map(k => k.trim()).filter(Boolean)
    },
    data: { blocks: CS.blocks },
    updatedAt: serverTimestamp()
  };

  try {
    if (CS.editingId) {
      await updateDoc(doc(db, COLL_CONTENT, CS.editingId), payload);
      csToast(status === "published" ? "Published" : "Draft saved", "success");
      sgpLogActivity("content_update", `${status}: "${title}" (${payload.type})`);
    } else {
      payload.createdAt = serverTimestamp();
      payload.createdByEmail = auth.currentUser?.email || null;
      payload.createdByName = auth.currentUser?.displayName || auth.currentUser?.email || null;
      const ref = await addDoc(collection(db, COLL_CONTENT), payload);
      CS.editingId = ref.id;
      csToast(status === "published" ? "Published" : "Draft saved", "success");
      sgpLogActivity("content_create", `${status}: "${title}" (${payload.type})`);
    }
    csLoadContent();
    csShowList();
  } catch (e) {
    console.error(e);
    csToast("Save failed — check Firestore rules for the `content` collection", "error");
  }
}

// ============================================================
//  INIT — expose to window for inline onclick handlers,
//  matching the existing admin.js convention
// ============================================================
window.csShowList = csShowList;
window.csNewContent = csNewContent;
window.csEditContent = csEditContent;
window.csDeleteContent = csDeleteContent;
window.csOnTitleInput = csOnTitleInput;
window.csAddBlock = csAddBlock;
window.csRemoveBlock = csRemoveBlock;
window.csMoveBlock = csMoveBlock;
window.csUpdateBlock = csUpdateBlock;
window.csUpdateFaqItem = csUpdateFaqItem;
window.csAddFaqItem = csAddFaqItem;
window.csAutoFillSeo = csAutoFillSeo;
window.csRenderList = csRenderList;
window.csSaveContent = csSaveContent;
window.csAiGenerate = csAiGenerate;
window.csAiStop = csAiStop;
window.csAiQuickAction = csAiQuickAction;
window.csRenderPreview = csRenderPreview;

// Call this once from your existing DOMContentLoaded / auth-success handler
window.initContentStudio = function () {
  csLoadAuthorsDropdown();
  csLoadCategoriesDropdown();
  csLoadContent();
};
