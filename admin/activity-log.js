/**
 * ============================================================
 *  Study Grid Prep — activity-log.js
 *  Tiny shared helper for logging sub-admin activity (logins +
 *  actions). Imported by sub-admin-auth.js, content-studio.js,
 *  media-library.js, and sub-admin-overrides.js.
 * ============================================================
 */

import { db, auth, collection, addDoc, serverTimestamp } from "../firebase.js";

export async function sgpLogActivity(action, details = "") {
  // Only log for sub-admins — the main admin's own actions aren't tracked
  // here (they don't need to review themselves).
  if (!window.IS_SUB_ADMIN) return;
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "activityLogs"), {
      email: user.email,
      name: user.displayName || user.email,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("Activity log failed (non-blocking):", e.message);
  }
}

// Also expose on window so plain (non-module) scripts can call it
window.sgpLogActivity = sgpLogActivity;
