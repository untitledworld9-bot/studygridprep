/**
 * ============================================================
 *  Study Grid Prep Admin Panel — appoint.js
 *  Appoint / revoke access to the sub-admin.html and admin-mock.html
 *  panels, and review each appointee's activity (logins + actions).
 *  Writes subAdmins/{email} docs — matched by Google account email
 *  when the appointee signs in to either panel.
 *
 *  Each doc now carries a `role` field:
 *    "sub-admin"  → sub-admin.html only
 *    "mock-admin" → admin-mock.html only
 *    "both"       → both panels
 *  Docs written before this field existed are treated as "sub-admin"
 *  for backward compatibility.
 *
 *  Activity data (activityLogs collection) auto-prunes anything
 *  older than 30 days on load, and can be manually cleared by a
 *  custom day-range, or per-appointee, from this panel.
 *
 *  Import in SGPAdmin-main.html:
 *    <script type="module" src="appoint.js"></script>
 * ============================================================
 */

import {
  db, collection, doc, setDoc, deleteDoc, updateDoc, getDocs, query, where, orderBy, serverTimestamp
} from "../firebase.js";

const AP = {
  expandedEmail: null,
  activeTab: "sub-admin",   // "sub-admin" | "mock-admin"
  search: "",
  cache: { subAdmins: [], allActivity: [] }
};
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
function apRole(sa) { return sa.role || "sub-admin"; } // backward-compat default

// FIX-ACTIVITY-TIME: entries older than a day previously only showed "Xd
// ago" with no way to tell exactly when something happened — now anything
// a day or older also shows the actual date + time alongside the relative
// label, e.g. "3d ago · 20 Jul, 04:12 pm".
function timeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  const dateStr = new Date(ms).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
  return `${days}d ago · ${dateStr}`;
}
const ACTION_LABELS = {
  login:                 { icon: "fa-right-to-bracket",     label: "Logged in" },
  content_create:        { icon: "fa-plus",                 label: "Created content" },
  content_update:        { icon: "fa-pen",                  label: "Updated content" },
  media_upload:          { icon: "fa-image",                label: "Uploaded media" },
  media_delete:          { icon: "fa-trash",                label: "Deleted media" },
  report_sent:           { icon: "fa-flag",                 label: "Sent report" },
  test_create:           { icon: "fa-file-circle-plus",     label: "Created a test" },
  test_ai_create:        { icon: "fa-wand-magic-sparkles",  label: "Created a test with AI" },
  test_draft_save:       { icon: "fa-floppy-disk",          label: "Saved test as draft" },
  test_publish:          { icon: "fa-bullhorn",             label: "Published a test" },
  test_update:           { icon: "fa-pen-to-square",        label: "Edited a test" },
  test_delete:           { icon: "fa-trash",                label: "Deleted a test" },
  test_attempt:          { icon: "fa-clipboard-check",      label: "Attempted a free test" },
  notification_broadcast:{ icon: "fa-tower-broadcast",      label: "Sent a broadcast" }
};
const ROLE_LABELS = {
  "sub-admin":  { label: "Sub-Admin",  color: "var(--accent-cyan, #00e0ff)" },
  "mock-admin": { label: "Mock-Admin", color: "var(--accent-violet, #7c5cfc)" },
  "both":       { label: "Both",       color: "var(--accent-green, #00e5a0)" }
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
//  (applies across every appointee, both tabs)
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
//  PER-USER DELETE — wipe just one appointee's activity history
//  (their appointment itself stays — use Revoke for that)
// ============================================================
async function apDeleteUserData(email) {
  if (!confirm(`Delete all activity data for ${email}? This can't be undone.`)) return;
  try {
    const snap = await getDocs(query(collection(db, "activityLogs"), where("email", "==", email)));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "activityLogs", d.id))));
    apToast(`Deleted ${snap.docs.length} activity record(s) for ${email}`, "success");
    apLoadList();
  } catch (e) {
    console.error(e);
    apToast("Delete failed — check Firestore rules", "error");
  }
}

// ============================================================
//  TABS + SEARCH
// ============================================================
function apSetTab(tab) {
  AP.activeTab = tab;
  AP.expandedEmail = null;
  apRenderList();
}
function apSetSearch(value) {
  AP.search = (value || "").trim().toLowerCase();
  apRenderList();
}
window.apSetTab = apSetTab;
window.apSetSearch = apSetSearch;

function apUpdateTabButtons() {
  ["sub-admin", "mock-admin"].forEach(tab => {
    const btn = $("apTab-" + tab);
    if (!btn) return;
    const active = AP.activeTab === tab;
    btn.style.background = active ? "rgba(0,224,255,.1)" : "";
    btn.style.borderColor = active ? "var(--accent-cyan, #00e0ff)" : "";
    btn.style.color = active ? "var(--accent-cyan, #00e0ff)" : "";
  });
}

// ============================================================
//  LOAD (fetch) + RENDER (draw from cache — no refetch needed
//  when just switching tabs or typing in search)
// ============================================================
async function apLoadList() {
  const wrap = $("apList");
  if (!wrap) return;

  await apAutoPruneOldActivity();

  const [subAdminsSnap, activitySnap] = await Promise.all([
    getDocs(collection(db, "subAdmins")),
    getDocs(query(collection(db, "activityLogs"), orderBy("timestamp", "desc")))
  ]);

  AP.cache.subAdmins = subAdminsSnap.docs.map(d => ({ email: d.id, ...d.data() }));
  AP.cache.allActivity = activitySnap.docs.map(d => d.data());

  apRenderList();
}

function apRenderList() {
  const wrap = $("apList");
  if (!wrap) return;
  apUpdateTabButtons();

  const { subAdmins, allActivity } = AP.cache;

  let filtered = subAdmins.filter(sa => {
    const role = apRole(sa);
    return role === AP.activeTab || role === "both";
  });

  if (AP.search) {
    filtered = filtered.filter(sa =>
      (sa.name || "").toLowerCase().includes(AP.search) ||
      (sa.email || "").toLowerCase().includes(AP.search)
    );
  }

  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i class="fa-solid fa-user-group"></i></div>
      <div class="empty-state-text">${subAdmins.length ? "No matches." : "No one appointed yet."}</div>
    </div>`;
    return;
  }

  wrap.innerHTML = filtered.map(sa => {
    const theirActivity = allActivity.filter(a => a.email === sa.email);
    const total = theirActivity.length;
    const lastLoginEvent = theirActivity.find(a => a.action === "login");
    const isOpen = AP.expandedEmail === sa.email;
    const role = apRole(sa);
    const roleInfo = ROLE_LABELS[role] || ROLE_LABELS["sub-admin"];

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
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;text-align:right;">${ts ? timeAgo(ts) : ""}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="tx-row" style="flex-direction:column;align-items:stretch;cursor:pointer;" onclick="apToggleExpand('${escHtml(sa.email)}')">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;">
          <div>
            <strong>${escHtml(sa.name || "Unnamed")}</strong>
            <span class="pill" style="margin-left:8px;color:${roleInfo.color};border-color:${roleInfo.color};">${roleInfo.label}</span>
            <div style="color:var(--text-muted);font-size:12px;margin-top:2px;">${escHtml(sa.email)}</div>
            ${lastLoginEvent?.timestamp?.seconds ? `<div style="color:var(--text-muted);font-size:11px;margin-top:2px;"><i class="fa-solid fa-right-to-bracket"></i> Last login ${timeAgo(lastLoginEvent.timestamp.seconds * 1000)}</div>` : `<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">Never logged in yet</div>`}
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="pill">${total} event${total === 1 ? "" : "s"} · 30d</span>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); apDeleteUserData('${escHtml(sa.email)}')" title="Delete this appointee's activity data">
              <i class="fa-solid fa-trash-can"></i> Delete Data
            </button>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); apRevoke('${escHtml(sa.email)}', '${AP.activeTab}')" title="Revoke ${ROLE_LABELS[AP.activeTab].label} access">
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
  apRenderList();
}
window.apToggleExpand = apToggleExpand;

async function apAppoint() {
  const name = $("apName").value.trim();
  const email = $("apEmail").value.trim().toLowerCase();
  const role = $("apRole")?.value || "sub-admin";

  if (!name) { apToast("Name is required", "error"); return; }
  if (!/^[^\s@]+@(gmail\.com|googlemail\.com)$/.test(email)) {
    apToast("Please enter a valid Gmail address", "error");
    return;
  }

  try {
    await setDoc(doc(db, "subAdmins", email), {
      name,
      email,
      role,
      appointedAt: serverTimestamp()
    });
    const panelName = role === "both" ? "Sub-Admin and Mock-Admin panels" : role === "mock-admin" ? "Mock-Admin panel" : "Sub-Admin panel";
    apToast(`${name} appointed — they can now log in to the ${panelName}`, "success");
    $("apName").value = "";
    $("apEmail").value = "";
    apLoadList();
  } catch (e) {
    console.error(e);
    apToast("Failed to appoint — check Firestore rules", "error");
  }
}

// Revoking from a specific tab only removes that panel's access.
// If the appointee had "both", they're downgraded to the other role
// instead of being fully removed.
async function apRevoke(email, fromTab) {
  const sa = AP.cache.subAdmins.find(s => s.email === email);
  const role = sa ? apRole(sa) : fromTab;

  if (role === "both") {
    const remaining = fromTab === "sub-admin" ? "mock-admin" : "sub-admin";
    if (!confirm(`Revoke ${ROLE_LABELS[fromTab].label} access for ${email}? They'll keep ${ROLE_LABELS[remaining].label} access.`)) return;
    await updateDoc(doc(db, "subAdmins", email), { role: remaining });
    apToast(`${ROLE_LABELS[fromTab].label} access revoked`, "success");
  } else {
    if (!confirm(`Revoke access for ${email}? This removes them completely.`)) return;
    await deleteDoc(doc(db, "subAdmins", email));
    apToast("Access revoked", "success");
  }
  apLoadList();
}

window.apAppoint = apAppoint;
window.apRevoke = apRevoke;
window.apDeleteOldActivity = apDeleteOldActivity;
window.apDeleteUserData = apDeleteUserData;
window.initAppoint = apLoadList;
