/**
 * auth-helper.js — Study Grid Prep
 *
 * Central auth utility. Import karo kisi bhi page se:
 *   import { getUID, getUserName, doLogout, clearUserCache } from "./auth-helper.js";
 *
 * Ye file:
 *  1. UID getter  — hamesha Firebase UID return karta hai (localStorage se)
 *  2. Logout      — saari user-specific localStorage keys clear karta hai
 *  3. Login check — auth guard helper
 *  4. Cross-account contamination fix — login pe pehle clear
 */

// ── All user-specific localStorage keys (EK JAGAH — easy to update) ──
const USER_KEYS = [
  "userName",
  "userEmail",
  "userUID",
  "uwUid",            // script.js uses this
  "customUserName",
  "returningUser",
  "seenWelcome",
  "appRated",
  "goal",
  "uw_xp",
  "uw_streak",
  "uw_last_streak",
  "uw_todo_daily_bonus",
  "uw_offline_queue",
  "uw_recent_rooms",
  "uw_accessed_rooms",
  "dailyXP",
  "dailyXPDate",
  // Subscription keys (subscription.js) — MUST clear on logout
  "sgp_userId",       // local fallback userId — reset on new login
  "isSubscribed",
  "trialExpiry",
  "freeMockUsed",
  "sgp_lastNotifiedActivation", // notification dedup marker — per-user, not per-device
  // Test/mock related
  "lastTestResult",
  "selectedTestId",
  "selectedExam",
  "selectedYear",
  "selectedShift",
  "selectedSubjects",
  "selectedMarking",
  "analysisData",
];

// ── Session-only keys (cleared on logout but not on login) ──
const SESSION_KEYS = [
  "uw_seen_announcements",
  "uw_seen_promotions",
  "uw_seen_videopromos",
  "uw_maintenance_active",
];

/**
 * Saari user data localStorage se clear karo.
 * Logout pe call karo.
 */
function clearUserCache() {
  USER_KEYS.forEach(k => localStorage.removeItem(k));
  SESSION_KEYS.forEach(k => { try { sessionStorage.removeItem(k); } catch(e) {} });

  // Dynamic keys jaise streak_shown_X, break_X etc. — prefix se clear
  const dynamicPrefixes = ["streak_shown_", "break_", "entrance_", "congrats_", "dailyXP_"];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && dynamicPrefixes.some(p => k.startsWith(p))) {
      localStorage.removeItem(k);
    }
  }
}

/**
 * Get current user's Firebase UID from localStorage.
 * Returns null if not logged in.
 */
function getUID() {
  return localStorage.getItem("userUID") || localStorage.getItem("uwUid") || null;
}

/**
 * Get display name.
 */
function getUserName() {
  return localStorage.getItem("customUserName") || localStorage.getItem("userName") || "";
}

/**
 * Get email.
 */
function getUserEmail() {
  return localStorage.getItem("userEmail") || "";
}

/**
 * Auth guard — agar login nahi hai toh login page pe bhej do.
 * Call at top of every protected page.
 */
function requireLogin(redirectTo = "login.html") {
  if (!localStorage.getItem("userName")) {
    document.documentElement.style.display = "none";
    window.location.replace(redirectTo);
    return false;
  }
  return true;
}

/**
 * Logout — Firebase signOut + localStorage clear + redirect.
 * @param {object} auth — Firebase auth instance
 * @param {string} redirectTo — page to redirect after logout
 */
async function doLogout(auth, redirectTo = "login.html") {
  try {
    // Firebase se bhi logout karo
    const { signOut } = await import("./firebase.js");
    await signOut(auth).catch(() => {});
  } catch(e) {}
  clearUserCache();
  window.location.replace(redirectTo);
}

export { getUID, getUserName, getUserEmail, requireLogin, doLogout, clearUserCache };
