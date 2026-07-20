/**
 * ============================================================
 *  Study Grid Prep Admin Panel — appoint.js
 *  Appoint / revoke access to the separate sub-admin.html panel,
 *  and review each sub-admin's activity (logins + actions).
 *  Writes subAdmins/{email} docs — matched by Google account email
 *  when the appointee signs in to sub-admin.html.
 *
 *  Activity data (activityLogs collection) auto-prunes anything
 *  older than 30 days on load, and can be manually cleared by a
 *  custom day-range from this panel.
 *
 *  Import in SGPAdmin-main.html:
 *    <script type="module" src="appoint.js"></script>
 * ============================================================
 */

import {
  db, collection, doc, setDoc, deleteDoc, getDocs, query, where, orderBy, serverTimestamp
} from "../firebase.js";

const AP = { expandedEmail: null };
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const $ = id => document.getElementById(id);
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function apToast(message, type = "info") {
  if (typeof window.toast === "function") { window.toast(message, type); return; }
  console.log(`[${type}]`, message);
}
function timeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
const ACTION_LABELS = {
  login: { icon: "fa-right-to-bracket", label: "Logged in" },
  content_create: { icon: "fa-plus", label: "Created content" },
  content_update: { icon: "fa-pen", label: "Updated content" },
  media_upload: { icon: "fa-image", label: "Uploaded media" },
  report_sent: { icon: "fa-flag", label: "Sent report" }
};

// ============================================================
//  AUTO-PRUNE — delete any activity log older than 30 days,
//  runs quietly once whenever this section loads.
// ============================================================
async function apAutoPruneOldActivity() {
  try {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const snap = await getDocs(query(collection(db, "activityLogs"), where("timestamp", "<", cutoff)));
    if (snap.empty) return;
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "activityLogs", d.id))));
    console.log(`Auto-pruned ${snap.docs.length} activity log(s) older than 30 days`);
  } catch (e) {
    console.warn("Auto-prune skipped:", e.message);
  }
}

// ============================================================
//  MANUAL DELETE — admin picks how many days of data to wipe
// ============================================================
async function apDeleteOldActivity() {
  const days = parseInt($("apDeleteDays")?.value, 10);
  if (!days || days < 1) { apToast("Enter a valid number of days", "error"); return; }
  if (!confirm(`Delete all activity data older than ${days} day(s)? This can't be undone.`)) return;

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const snap = await getDocs(query(collection(db, "activityLogs"), where("timestamp", "<", cutoff)));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "activityLogs", d.id))));
    apToast(`Deleted ${snap.docs.length} activity record(s)`, "success");
    apLoadList();
  } catch (e) {
    console.error(e);
    apToast("Delete failed — check Firestore rules", "error");
  }
}

// ============================================================
//  LOAD + RENDER
// ============================================================
async function apLoadList() {
  const wrap = $("apList");
  if (!wrap) return;

  await apAutoPruneOldActivity();

  const [subAdminsSnap, activitySnap] = await Promise.all([
    getDocs(collection(db, "subAdmins")),
    getDocs(query(collection(db, "activityLogs"), orderBy("timestamp", "desc")))
  ]);

  const subAdmins = subAdminsSnap.docs.map(d => ({ email: d.id, ...d.data() }));
  const allActivity = activitySnap.docs.map(d => d.data());

  if (!subAdmins.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-user-group"></i></div>
      <div class="empty-state-text">No one appointed yet.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = subAdmins.map(sa => {
    const theirActivity = allActivity.filter(a => a.email === sa.email);
    const total = theirActivity.length;
    const lastEvent = theirActivity[0]; // already sorted desc
    const lastLoginEvent = theirActivity.find(a => a.action === "login");
    const isOpen = AP.expandedEmail === sa.email;

    const activityRows = theirActivity.map(a => {
      const meta = ACTION_LABELS[a.action] || { icon: "fa-circle", label: a.action };
      const ts = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : null;
      return `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border-soft, var(--border));">
          <i class="fa-solid ${meta.icon}" style="color:var(--accent-cyan);width:16px;margin-top:2px;"></i>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${escHtml(meta.label)}</div>
            ${a.details ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${escHtml(a.details)}</div>` : ""}
          </div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${ts ? timeAgo(ts) : ""}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="tx-row" style="flex-direction:column;align-items:stretch;cursor:pointer;" onclick="apToggleExpand('${escHtml(sa.email)}')">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <div>
            <strong>${escHtml(sa.name || "Unnamed")}</strong>
            <div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${escHtml(sa.email)}</div>
            ${lastLoginEvent?.timestamp?.seconds ? `<div style="color:var(--text-muted);font-size:11px;margin-top:2px;"><i class="fa-solid fa-right-to-bracket"></i> Last login ${timeAgo(lastLoginEvent.timestamp.seconds * 1000)}</div>` : `<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Never logged in yet</div>`}
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="pill">${total} event${total === 1 ? "" : "s"} · 30d</span>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); apRevoke('${escHtml(sa.email)}')">
              <i class="fa-solid fa-user-xmark"></i> Revoke
            </button>
            <i class="fa-solid fa-chevron-${isOpen ? "up" : "down"}" style="color:var(--text-muted);"></i>
          </div>
        </div>
        ${isOpen ? `
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);max-height:360px;overflow-y:auto;" onclick="event.stopPropagation()">
            ${total === 0 ? `<div style="color:var(--text-muted);font-size:13px;">No activity in the last 30 days.</div>` : activityRows}
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
    await setDoc(doc(db, "subAdmins", email), {
      name,
      email,
      appointedAt: serverTimestamp()
    });
    apToast(`${name} appointed — they can now log in to Sub-Admin panel`, "success");
    $("apName").value = "";
    $("apEmail").value = "";
    apLoadList();
  } catch (e) {
    console.error(e);
    apToast("Failed to appoint — check Firestore rules", "error");
  }
}

async function apRevoke(email) {
  if (!confirm(`Revoke Sub-Admin access for ${email}?`)) return;
  await deleteDoc(doc(db, "subAdmins", email));
  apToast("Access revoked", "success");
  apLoadList();
}

window.apAppoint = apAppoint;
window.apRevoke = apRevoke;
window.apDeleteOldActivity = apDeleteOldActivity;
window.initAppoint = apLoadList;
