/**
 * ============================================================
 *  Study Grid Prep Admin Panel — media-library.js
 *  Upload, browse, search and delete images.
 *  Storage path: media/{timestamp}-{filename}
 *  Firestore metadata: media/{docId}
 *
 *  Import in studygridadmin.html:
 *    <script type="module" src="media-library.js"></script>
 * ============================================================
 */

import {
  db, storage, collection, addDoc, doc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp,
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "../firebase.js";

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
    if (search && !(m.alt || "").toLowerCase().includes(search) && !(m.storagePath || "").toLowerCase().includes(search)) return false;
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
          <div class="ml-name" title="${escHtml(m.storagePath)}">${escHtml((m.storagePath || "").split("/").pop())}</div>
          <div class="ml-size">${formatBytes(m.sizeBytes)}</div>
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
//  UPLOAD
// ============================================================
async function mlHandleUpload(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const folder = $("mlUploadFolder")?.value.trim() || "general";
  const progressWrap = $("mlUploadProgress");

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      mlToast(`Skipped ${file.name} — not an image`, "error");
      continue;
    }
    const storagePath = `media/${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const rowId = "ml-progress-" + Date.now() + Math.random().toString(36).slice(2);
    if (progressWrap) {
      progressWrap.insertAdjacentHTML("beforeend", `
        <div class="ml-progress-row" id="${rowId}">
          <span>${escHtml(file.name)}</span>
          <div class="ml-progress-bar"><div class="ml-progress-fill" style="width:0%"></div></div>
        </div>`);
    }

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          const fill = document.querySelector(`#${rowId} .ml-progress-fill`);
          if (fill) fill.style.width = pct + "%";
        },
        (err) => { mlToast(`Upload failed: ${file.name}`, "error"); reject(err); },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, "media"), {
              url, storagePath, folder,
              alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
              sizeBytes: file.size,
              width: null, height: null,
              uploadedAt: serverTimestamp()
            });
            document.getElementById(rowId)?.remove();
            resolve();
          } catch (e) { reject(e); }
        }
      );
    }).catch(() => {});
  }

  mlToast("Upload complete", "success");
  mlLoad();
}

function mlCopyUrl(id) {
  const m = ML.allMedia.find(x => x.id === id);
  if (!m) return;
  navigator.clipboard?.writeText(m.url).then(() => mlToast("URL copied", "success"))
    .catch(() => mlToast("Could not copy — long-press the URL manually", "error"));
}

async function mlDelete(id) {
  const m = ML.allMedia.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Delete "${(m.storagePath || "").split("/").pop()}"? This removes it from Storage too.`)) return;
  try {
    await deleteObject(ref(storage, m.storagePath));
  } catch (e) {
    console.warn("Storage file already gone or inaccessible:", e.message);
  }
  await deleteDoc(doc(db, "media", id));
  mlToast("Deleted", "success");
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
