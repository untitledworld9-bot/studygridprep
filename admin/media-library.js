/**
 * ============================================================
 *  Study Grid Prep Admin Panel — media-library.js
 *  Upload, browse, search and delete images.
 *  Upload backend: Cloudinary (unsigned upload — no server needed).
 *  Firestore metadata: media/{docId}
 *
 *  Import in studygridadmin.html:
 *    <script type="module" src="media-library.js"></script>
 * ============================================================
 */

import {
  db, collection, addDoc, doc, deleteDoc, getDocs, query, orderBy, serverTimestamp
} from "../firebase.js";
import { sgpLogActivity } from "../activity-log.js";

// ════════════════════════════════════════════════════════════
// CLOUDINARY CONFIG — fill these in from your Cloudinary dashboard
// 1. Go to https://cloudinary.com/console → copy your "Cloud name"
// 2. Settings → Upload → Upload presets → Add upload preset
//    → Signing Mode: UNSIGNED → Save → copy its name
// ════════════════════════════════════════════════════════════
const CLOUDINARY_CLOUD_NAME = "kvyah2au";
const CLOUDINARY_UPLOAD_PRESET = "wo1vdgbo";

const $ = id => document.getElementById(id);
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function mlToast(message, type = "info") {
  if (typeof window.toast === "function") { window.toast(message, type); return; }
  console.log(`[${type}]`, message);
}
function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  return kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.round(kb) + " KB";
}

const ML = { allMedia: [] };

// ============================================================
//  LOAD + RENDER
// ============================================================
async function mlLoad() {
  try {
    const snap = await getDocs(query(collection(db, "media"), orderBy("uploadedAt", "desc")));
    ML.allMedia = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(collection(db, "media"));
    ML.allMedia = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ML.allMedia.sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
  }
  mlRender();
  mlPopulateFolderFilter();
}

function mlPopulateFolderFilter() {
  const sel = $("mlFolderFilter");
  if (!sel) return;
  const current = sel.value;
  const folders = [...new Set(ML.allMedia.map(m => m.folder).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">All Folders</option>` + folders.map(f => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join("");
  sel.value = current;
}

function mlRender() {
  const search = ($("mlSearch")?.value || "").toLowerCase();
  const folder = $("mlFolderFilter")?.value || "";

  let items = ML.allMedia.filter(m => {
    if (search && !(m.alt || "").toLowerCase().includes(search) && !(m.publicId || "").toLowerCase().includes(search)) return false;
    if (folder && m.folder !== folder) return false;
    return true;
  });

  const wrap = $("mlGrid");
  if (!wrap) return;

  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-images"></i></div>
      <div class="empty-state-text">No media yet — upload your first image above.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="ml-grid">
    ${items.map(m => `
      <div class="ml-card">
        <div class="ml-thumb" style="background-image:url('${escHtml(m.url)}')"></div>
        <div class="ml-meta">
          <div class="ml-name" title="${escHtml(m.publicId)}">${escHtml((m.publicId || "").split("/").pop())}</div>
          <div class="ml-size">${formatBytes(m.sizeBytes)}${m.width ? ` · ${m.width}×${m.height}` : ""}</div>
        </div>
        <div class="ml-actions">
          <button class="btn btn-outline btn-sm" onclick="mlCopyUrl('${m.id}')"><i class="fa-solid fa-copy"></i> Copy URL</button>
          <button class="btn btn-outline btn-sm" onclick="mlDelete('${m.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join("")}
  </div>`;
}

// ============================================================
//  UPLOAD — via Cloudinary unsigned upload (no backend needed)
// ============================================================
async function mlHandleUpload(fileList) {
  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    mlToast("Cloudinary not configured yet — set CLOUDINARY_CLOUD_NAME in media-library.js", "error");
    return;
  }

  const files = Array.from(fileList || []);
  if (!files.length) return;

  const folder = $("mlUploadFolder")?.value.trim() || "general";
  const progressWrap = $("mlUploadProgress");

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      mlToast(`Skipped ${file.name} — not an image`, "error");
      continue;
    }

    const rowId = "ml-progress-" + Date.now() + Math.random().toString(36).slice(2);
    if (progressWrap) {
      progressWrap.insertAdjacentHTML("beforeend", `
        <div class="ml-progress-row" id="${rowId}">
          <span>${escHtml(file.name)}</span>
          <div class="ml-progress-bar"><div class="ml-progress-fill" style="width:30%"></div></div>
        </div>`);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", `study-grid-prep/${folder}`);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
      });

      const fill = document.querySelector(`#${rowId} .ml-progress-fill`);
      if (fill) fill.style.width = "90%";

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `Cloudinary upload failed (${res.status})`);
      }

      const data = await res.json();

      await addDoc(collection(db, "media"), {
        url: data.secure_url,
        publicId: data.public_id,
        folder,
        alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        sizeBytes: data.bytes || file.size,
        width: data.width || null,
        height: data.height || null,
        uploadedAt: serverTimestamp()
      });

      document.getElementById(rowId)?.remove();
    } catch (e) {
      console.error(e);
      mlToast(`Upload failed: ${file.name} — ${e.message}`, "error");
      document.getElementById(rowId)?.remove();
    }
  }

  mlToast("Upload complete", "success");
  sgpLogActivity("media_upload", `Uploaded ${files.length} image(s) to folder "${folder}"`);
  mlLoad();
}

function mlCopyUrl(id) {
  const m = ML.allMedia.find(x => x.id === id);
  if (!m) return;
  navigator.clipboard?.writeText(m.url).then(() => mlToast("URL copied", "success"))
    .catch(() => mlToast("Could not copy — long-press the URL manually", "error"));
}

// Note: this removes the entry from the Media Library list (Firestore).
// The file itself stays in Cloudinary storage — deleting from Cloudinary
// directly requires a signed API call (needs your API secret), which
// isn't safe to do from the browser. Delete unused files periodically
// from the Cloudinary dashboard if you want to reclaim storage space.
async function mlDelete(id) {
  const m = ML.allMedia.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Remove "${(m.publicId || "").split("/").pop()}" from the library? (The file stays in Cloudinary storage — delete it there too if you want it fully gone.)`)) return;
  await deleteDoc(doc(db, "media", id));
  mlToast("Removed from library", "success");
  mlLoad();
}

// ============================================================
//  INIT
// ============================================================
window.mlCopyUrl = mlCopyUrl;
window.mlDelete = mlDelete;
window.mlRender = mlRender;
window.mlHandleUpload = mlHandleUpload;
window.initMediaLibrary = mlLoad;
