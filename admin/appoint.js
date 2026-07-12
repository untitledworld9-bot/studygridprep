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
  const snap = await getDocs(collection(db, "editors"));
  const editors = snap.docs.map(d => ({ email: d.id, ...d.data() }));

  if (!editors.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-user-group"></i></div>
      <div class="empty-state-text">No one appointed yet.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = editors.map(e => `
    <div class="tx-row">
      <div>
        <strong>${escHtml(e.name || "Unnamed")}</strong>
        <div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${escHtml(e.email)}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="apRevoke('${escHtml(e.email)}')">
        <i class="fa-solid fa-user-xmark"></i> Revoke
      </button>
    </div>
  `).join("");
}

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
