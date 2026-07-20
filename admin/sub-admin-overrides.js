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
window.reportPaymentToAdmin = (paymentId, userLabel) => {
  openNoteModal(`Note for admin about this payment (${userLabel})`, async (note) => {
    if (note == null) return; // cancelled
    await fileReport({ type: "payment", targetLabel: userLabel, targetId: paymentId, note });
  });
};

// ============================================================
//  IN-APP NOTE MODAL — replaces the browser's native prompt(),
//  which looked like a raw Chrome dialog and broke the flow's UI.
// ============================================================
function openNoteModal(title, onSubmit) {
  let modal = document.getElementById("saNoteModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "saNoteModal";
    modal.innerHTML = `
      <div class="sa-note-modal-backdrop" onclick="closeNoteModal()"></div>
      <div class="sa-note-modal-box">
        <div class="sa-note-modal-title" id="saNoteModalTitle"></div>
        <textarea class="sa-note-modal-textarea" id="saNoteModalInput" rows="4" placeholder="Type your note…"></textarea>
        <div class="sa-note-modal-actions">
          <button class="btn btn-outline" onclick="closeNoteModal()">Cancel</button>
          <button class="btn btn-primary" id="saNoteModalSend">
            <i class="fa-solid fa-paper-plane"></i> Send
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const styleTag = document.createElement("style");
    styleTag.textContent = `
      #saNoteModal { display:none; position:fixed; inset:0; z-index:99999; }
      #saNoteModal.open { display:block; }
      .sa-note-modal-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.6); }
      .sa-note-modal-box {
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        width:min(420px, 90vw); background:var(--bg-card, #111420);
        border:1px solid var(--border, rgba(255,255,255,.08)); border-radius:14px;
        padding:20px; box-shadow:0 20px 60px rgba(0,0,0,0.5);
      }
      .sa-note-modal-title { font-family:var(--font-display,inherit); font-weight:700; font-size:15px; color:var(--text-primary,#eef0ff); margin-bottom:14px; }
      .sa-note-modal-textarea {
        width:100%; padding:10px 12px; border-radius:10px; background:var(--bg-input,#0f1220);
        border:1px solid var(--border,rgba(255,255,255,.08)); color:var(--text-primary,#eef0ff);
        font-family:var(--font-body,inherit); font-size:13.5px; resize:vertical; outline:none;
      }
      .sa-note-modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
    `;
    document.head.appendChild(styleTag);
  }

  document.getElementById("saNoteModalTitle").textContent = title;
  const input = document.getElementById("saNoteModalInput");
  input.value = "";
  modal.classList.add("open");
  setTimeout(() => input.focus(), 50);

  const sendBtn = document.getElementById("saNoteModalSend");
  sendBtn.onclick = () => {
    const val = input.value;
    closeNoteModal();
    onSubmit(val);
  };
}
window.closeNoteModal = function () {
  const modal = document.getElementById("saNoteModal");
  if (modal) modal.classList.remove("open");
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
