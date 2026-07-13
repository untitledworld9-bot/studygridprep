/**
 * ============================================================
 *  Study Grid Prep Admin Panel — appoint.js
 *  Appoint / revoke access to the separate content-admin.html panel.
 *  Writes editors/{email} docs — matched by Google account email
 *  when the appointee signs in to content-admin.html.
 *
 *  Import in studygridadmin.html:
 *    <script type="module" src="appoint.js"></script>
 * ============================================================
 */

import {
  db, collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp
} from "../firebase.js";

const AP = { expandedEmail: null };

const $ = id => document.getElementById(id);
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function apToast(message, type = "info") {
  if (typeof window.toast === "function") { window.toast(message, type); return; }
  console.log(`[${type}]`, message);
}

async function apLoadList() {
  const wrap = $("apList");
  if (!wrap) return;

  const [editorsSnap, contentSnap] = await Promise.all([
    getDocs(collection(db, "editors")),
    getDocs(collection(db, "content"))
  ]);

  const editors = editorsSnap.docs.map(d => ({ email: d.id, ...d.data() }));
  const allContent = contentSnap.docs.map(d => d.data());

  if (!editors.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-user-group"></i></div>
      <div class="empty-state-text">No one appointed yet.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = editors.map(e => {
    const theirContent = allContent.filter(c => c.createdByEmail === e.email);
    const total = theirContent.length;
    const isOpen = AP.expandedEmail === e.email;

    // breakdown by type
    const byType = {};
    theirContent.forEach(c => { byType[c.type || "unknown"] = (byType[c.type || "unknown"] || 0) + 1; });
    const typeChips = Object.entries(byType).map(([t, n]) => `<span class="pill" style="margin-right:6px;">${escHtml(t)} · ${n}</span>`).join("");

    const detailRows = theirContent.map(c => `
      <tr>
        <td>${escHtml(c.title || "(untitled)")}</td>
        <td>${escHtml(c.type || "-")}</td>
        <td>${escHtml(c.category || "-")}</td>
        <td><span class="badge badge-${c.status === "published" ? "green" : "gray"}">${escHtml(c.status || "draft")}</span></td>
      </tr>
    `).join("");

    return `
      <div class="tx-row" style="flex-direction:column;align-items:stretch;cursor:pointer;" onclick="apToggleExpand('${escHtml(e.email)}')">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <div>
            <strong>${escHtml(e.name || "Unnamed")}</strong>
            <div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${escHtml(e.email)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="pill">${total} piece${total === 1 ? "" : "s"}</span>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); apRevoke('${escHtml(e.email)}')">
              <i class="fa-solid fa-user-xmark"></i> Revoke
            </button>
            <i class="fa-solid fa-chevron-${isOpen ? "up" : "down"}" style="color:var(--text-muted);"></i>
          </div>
        </div>
        ${isOpen ? `
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);" onclick="event.stopPropagation()">
            ${total === 0 ? `<div style="color:var(--text-muted);font-size:13px;">No content created yet.</div>` : `
              <div style="margin-bottom:12px;">${typeChips}</div>
              <table class="admin-table">
                <thead><tr><th>Title</th><th>Type</th><th>Category</th><th>Status</th></tr></thead>
                <tbody>${detailRows}</tbody>
              </table>
            `}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function apToggleExpand(email) {
  AP.expandedEmail = AP.expandedEmail === email ? null : email;
  apLoadList();
}
window.apToggleExpand = apToggleExpand;

async function apAppoint() {
  const name = $("apName").value.trim();
  const email = $("apEmail").value.trim().toLowerCase();

  if (!name) { apToast("Name is required", "error"); return; }
  if (!/^[^\s@]+@(gmail\.com|googlemail\.com)$/.test(email)) {
    apToast("Please enter a valid Gmail address", "error");
    return;
  }

  try {
    await setDoc(doc(db, "editors", email), {
      name,
      email,
      appointedAt: serverTimestamp()
    });
    apToast(`${name} appointed — they can now log in to Content Admin`, "success");
    $("apName").value = "";
    $("apEmail").value = "";
    apLoadList();
  } catch (e) {
    console.error(e);
    apToast("Failed to appoint — check Firestore rules", "error");
  }
}

async function apRevoke(email) {
  if (!confirm(`Revoke Content Admin access for ${email}?`)) return;
  await deleteDoc(doc(db, "editors", email));
  apToast("Access revoked", "success");
  apLoadList();
}

window.apAppoint = apAppoint;
window.apRevoke = apRevoke;
window.initAppoint = apLoadList;
