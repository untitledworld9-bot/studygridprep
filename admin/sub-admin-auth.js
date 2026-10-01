/**
 * ============================================================
 *  Study Grid Prep — sub-admin-auth.js
 *  Handles login/session for sub-admin.html.
 *  Reuses admin.js's initAdminPanel()/module inits, but gates
 *  access on the subAdmins/{email} collection instead of the
 *  admin-only allowlist (which stays enforced by Firestore rules
 *  for actual writes — this just controls the UI shell).
 *
 *  admin.js must set window.SGP_SKIP_AUTOLAUNCH = true BEFORE
 *  loading, so its own onAuthStateChanged listener doesn't race
 *  with this one.
 * ============================================================
 */

import {
  auth, provider, db, doc, getDoc,
  signInWithPopup, onAuthStateChanged, signOut
} from "../firebase.js";
import { sgpLogActivity } from "../activity-log.js";

const $ = id => document.getElementById(id);

function showError(msg) {
  const el = $("authError");
  if (el) el.textContent = msg;
}

window.signInWithGoogleSubAdmin = async () => {
  const btn = document.querySelector(".auth-google-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
  showError("");

  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged below picks up the result
  } catch (err) {
    console.error("Sub-admin sign-in error:", err);
    showError("Sign-in failed: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Continue with Google"; }
  }
};

onAuthStateChanged(auth, async (user) => {
  const gate = $("authGate");
  const loading = $("authLoading");

  if (!user) {
    if (loading) loading.style.display = "none";
    if (gate) gate.style.display = "flex";
    return;
  }

  if (gate) gate.style.display = "none";
  if (loading) loading.style.display = "flex";

  try {
    const subAdminDoc = await getDoc(doc(db, "subAdmins", user.email));
    if (!subAdminDoc.exists()) {
      if (loading) loading.style.display = "none";
      if (gate) gate.style.display = "flex";
      showError("Your account isn't appointed as a Sub-Admin yet. Ask the site owner to appoint you, then try again.");
      await signOut(auth);
      return;
    }
  } catch (e) {
    console.error(e);
    if (loading) loading.style.display = "none";
    if (gate) gate.style.display = "flex";
    showError("Could not verify your access — please try again.");
    return;
  }

  if (loading) loading.style.display = "none";

  // Flag admin.js's row renderers (e.g. delete-user button) to hide
  // admin-only actions for this session.
  window.IS_SUB_ADMIN = true;
  sgpLogActivity("login", "Signed in to Sub-Admin panel");

  // Reuse admin.js's own panel launcher + module inits — same as the
  // main admin panel, just gated differently.
  if (typeof window.initAdminPanel === "function") window.initAdminPanel(user);
  if (typeof window.initContentStudio === "function") window.initContentStudio();
  if (typeof window.initMediaLibrary === "function") window.initMediaLibrary();
  if (typeof window.initTaxonomy === "function") window.initTaxonomy();

  const nameEl = $("adminNameSidebar");
  const emailEl = $("adminEmailSidebar");
  const avatarEl = $("adminAvatarSidebar");
  if (nameEl) nameEl.textContent = user.displayName || "Sub-Admin";
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent = (user.displayName || user.email || "?")[0].toUpperCase();

  // Let the overrides script know it's safe to start patching the DOM
  window.dispatchEvent(new CustomEvent("subadmin-ready"));
});

window.refreshSubAdminPanel = () => {
  location.reload();
};
