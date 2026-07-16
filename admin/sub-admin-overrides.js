/**
 * ============================================================
 *  Study Grid Prep — sub-admin-overrides.js
 *  Patches the DOM that admin.js renders, WITHOUT modifying
 *  admin.js itself (which is shared with the main admin panel).
 *
 *  - User Management: removes the Delete User button
 *  - Payment Requests: adds a "Report" button next to Approve/Reject
 *  - Subscriptions: wires up the "Send Report to Admin" button
 *    added directly in sub-admin.html's markup
 *
 *  Waits for the "subadmin-ready" event (fired by sub-admin-auth.js
 *  after the role check passes) before doing anything.
 * ============================================================
 */

import { db, collection, addDoc, serverTimestamp } from "../firebase.js";
import { sgpLogActivity } from "../activity-log.js";

function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ============================================================
//  SHARED REPORT-TO-ADMIN FLOW
// ============================================================
async function fileReport({ type, targetLabel, targetId, note }) {
  if (!note || !note.trim()) {
    alert("Please add a short note before sending.");
    return false;
  }
  try {
    await addDoc(collection(db, "reports"), {
      type,                      // "subscription" | "payment"
      targetLabel: targetLabel || "",
      targetId: targetId || "",
      note: note.trim(),
      reportedBy: window.__adminPanelUser?.email || "unknown",
      reportedByName: window.__adminPanelUser?.displayName || "",
      resolved: false,
      createdAt: serverTimestamp()
    });
    if (typeof window.toast === "function") window.toast("Report sent to admin", "success");
    else alert("Report sent to admin.");
    sgpLogActivity("report_sent", `${type} report re: ${targetLabel} — "${note.trim().slice(0, 80)}"`);
    return true;
  } catch (e) {
    console.error(e);
    if (typeof window.toast === "function") window.toast("Failed to send report", "error");
    else alert("Failed to send report: " + e.message);
    return false;
  }
}

// Wired to the "Send Report to Admin" button in the Subscriptions section
window.sendSubscriptionReport = async () => {
  const nameEl = document.getElementById("selSubName");
  const emailEl = document.getElementById("selSubEmail");
  const noteEl = document.getElementById("subReportNote");

  const name = nameEl?.textContent?.trim();
  const email = emailEl?.textContent?.trim();
  if (!name || name === "—") {
    alert("Please search and select a user first.");
    return;
  }

  const ok = await fileReport({
    type: "subscription",
    targetLabel: `${name} (${email})`,
    targetId: email,
    note: noteEl?.value
  });
  if (ok && noteEl) noteEl.value = "";
};

// Report button for a specific payment row
window.reportPaymentToAdmin = async (paymentId, userLabel) => {
  const note = prompt(`Note for admin about this payment (${userLabel}):`);
  if (note === null) return; // cancelled
  await fileReport({ type: "payment", targetLabel: userLabel, targetId: paymentId, note });
};

// ============================================================
//  DOM PATCHES — run once ready, then keep re-patching on re-render
// ============================================================
function removeDeleteUserButtons() {
  document.querySelectorAll('[onclick^="deleteUser("]').forEach(btn => btn.remove());
}

function addReportButtonsToPayments() {
  const tbody = document.getElementById("payRequestsBody");
  if (!tbody) return;
  tbody.querySelectorAll("tr").forEach(row => {
    if (row.querySelector(".sa-report-btn")) return; // already patched
    const approveBtn = row.querySelector('[onclick^="approvePayment("]');
    if (!approveBtn) return; // not a pending row (no actions to append to)

    const match = approveBtn.getAttribute("onclick").match(/approvePayment\('([^']+)'\)/);
    const paymentId = match ? match[1] : "";
    const nameCell = row.querySelector("td");
    const userLabel = nameCell ? nameCell.textContent.trim() : paymentId;

    const reportBtn = document.createElement("button");
    reportBtn.className = "sa-report-btn";
    reportBtn.innerHTML = `<i class="fa-solid fa-flag"></i> Report`;
    reportBtn.style.cssText = `
      background:rgba(255,184,48,0.12);color:var(--accent-amber);
      border:1px solid rgba(255,184,48,0.3);border-radius:8px;
      padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;
      transition:.2s;font-family:var(--font-body);margin-left:6px;`;
    reportBtn.onclick = () => window.reportPaymentToAdmin(paymentId, userLabel);
    approveBtn.parentElement.appendChild(reportBtn);
  });
}

function startPatchLoop() {
  removeDeleteUserButtons();
  addReportButtonsToPayments();

  // admin.js re-renders these tables on every Firestore snapshot update —
  // a MutationObserver catches that without needing to touch admin.js.
  const userTable = document.getElementById("userTable");
  if (userTable) {
    new MutationObserver(removeDeleteUserButtons).observe(userTable, { childList: true, subtree: true });
  }
  const payTable = document.getElementById("payRequestsBody");
  if (payTable) {
    new MutationObserver(addReportButtonsToPayments).observe(payTable, { childList: true, subtree: true });
  }
}

window.addEventListener("subadmin-ready", startPatchLoop);
