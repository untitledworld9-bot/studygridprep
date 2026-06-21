/**
 * ============================================================
 *  Study Grid Prep — subscription.js  (v1.0)
 *
 *  Hybrid localStorage + Firestore subscription system.
 *
 *  - localStorage = instant UI (read first, zero delay)
 *  - Firestore     = source of truth (always wins on conflict)
 *  - Same userId (Firebase Auth UID when logged in) keeps
 *    subscription state in sync across every device.
 *
 *  Firestore doc:  users/{userId}
 *  {
 *    isSubscribed: boolean,
 *    trialExpiry:  number (ms epoch) | null,
 *    freeMockUsed: boolean,
 *    updatedAt:    serverTimestamp
 *  }
 * ============================================================
 */

import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from './firebase.js';

const LS_KEYS = {
  USER_ID:       'sgp_userId',
  IS_SUB:        'isSubscribed',
  TRIAL_EXPIRY:  'trialExpiry',
  FREE_USED:     'freeMockUsed'
};

const USERS_COLL = 'users';

// ------------------------------------------------------------
//  USER ID — stable per device, overridden by Firebase UID
// ------------------------------------------------------------

function generateId() {
  return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
}

/**
 * Returns the stable userId to use for subscription lookups.
 * Prefers the logged-in Firebase Auth UID (synced across devices).
 * Falls back to a locally-generated id stored in localStorage.
 */
export function getUserId() {
  const authedUid = auth?.currentUser?.uid;
  if (authedUid) {
    // Logged-in identity always wins — overwrite local fallback id
    // so any cached local id doesn't get used by mistake elsewhere.
    if (localStorage.getItem(LS_KEYS.USER_ID) !== authedUid) {
      localStorage.setItem(LS_KEYS.USER_ID, authedUid);
    }
    return authedUid;
  }
  let id = localStorage.getItem(LS_KEYS.USER_ID);
  if (!id) {
    id = generateId();
    localStorage.setItem(LS_KEYS.USER_ID, id);
  }
  return id;
}

// ------------------------------------------------------------
//  FAST LOCAL READ — for instant UI, no network wait
// ------------------------------------------------------------

export function getLocalSubscriptionState() {
  const isSubscribed = localStorage.getItem(LS_KEYS.IS_SUB) === 'true';
  const trialExpiry  = parseInt(localStorage.getItem(LS_KEYS.TRIAL_EXPIRY) || '0', 10) || null;
  const freeMockUsed = localStorage.getItem(LS_KEYS.FREE_USED) === 'true';
  return applyExpiryLocal({ isSubscribed, trialExpiry, freeMockUsed });
}

function writeLocal(state) {
  localStorage.setItem(LS_KEYS.IS_SUB,       state.isSubscribed ? 'true' : 'false');
  localStorage.setItem(LS_KEYS.TRIAL_EXPIRY, state.trialExpiry ? String(state.trialExpiry) : '');
  localStorage.setItem(LS_KEYS.FREE_USED,    state.freeMockUsed ? 'true' : 'false');
}

// Auto-expire trial locally (instant, no network needed)
function applyExpiryLocal(state) {
  if (state.isSubscribed && state.trialExpiry && Date.now() > state.trialExpiry) {
    state.isSubscribed = false;
    writeLocal(state);
  }
  return state;
}

// ------------------------------------------------------------
//  FIRESTORE — source of truth
// ------------------------------------------------------------

async function readRemote(userId) {
  const ref  = doc(db, USERS_COLL, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    isSubscribed: !!data.isSubscribed,
    trialExpiry:  data.trialExpiry || null,
    freeMockUsed: !!data.freeMockUsed
  };
}

async function writeRemote(userId, partialState) {
  const ref = doc(db, USERS_COLL, userId);
  await setDoc(ref, {
    ...partialState,
    updatedAt: Date.now()
  }, { merge: true });
}

// Apply expiry remotely too, so Firestore never lingers as "subscribed"
async function applyExpiryRemote(userId, state) {
  if (state.isSubscribed && state.trialExpiry && Date.now() > state.trialExpiry) {
    state.isSubscribed = false;
    try { await writeRemote(userId, { isSubscribed: false }); } catch (_) {}
  }
  return state;
}

// ------------------------------------------------------------
//  SYNC — background reconcile, Firebase always wins
// ------------------------------------------------------------

let syncInFlight = null;

/**
 * Fast local read first (for instant UI), then background-syncs
 * with Firestore and calls onUpdate(state) again if anything changed.
 * Safe to call multiple times; in-flight syncs are reused.
 */
export function initSubscriptionSync(onUpdate) {
  const local = getLocalSubscriptionState();
  if (typeof onUpdate === 'function') onUpdate(local, { source: 'local' });

  if (!syncInFlight) {
    syncInFlight = (async () => {
      try {
        const userId  = getUserId();
        const remote  = await readRemote(userId);

        if (remote) {
          const reconciled = await applyExpiryRemote(userId, remote);
          writeLocal(reconciled);
          if (typeof onUpdate === 'function') onUpdate(reconciled, { source: 'remote' });
          return reconciled;
        } else {
          // No remote doc yet (first-time user) — seed it from local/defaults
          const seeded = {
            isSubscribed: local.isSubscribed,
            trialExpiry:  local.trialExpiry,
            freeMockUsed: local.freeMockUsed
          };
          await writeRemote(userId, seeded);
          return seeded;
        }
      } catch (err) {
        console.warn('Subscription sync failed (using local state):', err);
        return local;
      } finally {
        syncInFlight = null;
      }
    })();
  }
  return syncInFlight;
}

/**
 * Live-listen to Firestore for this user's subscription doc so that
 * activation on another device reflects here without a refresh.
 * Returns the unsubscribe function.
 */
export function watchSubscription(onUpdate) {
  const userId = getUserId();
  const ref = doc(db, USERS_COLL, userId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const state = applyExpiryLocal({
      isSubscribed: !!data.isSubscribed,
      trialExpiry:  data.trialExpiry || null,
      freeMockUsed: !!data.freeMockUsed
    });
    writeLocal(state);
    if (typeof onUpdate === 'function') onUpdate(state, { source: 'remote-live' });
  }, (err) => {
    console.warn('Subscription listener error:', err);
  });
}

// ------------------------------------------------------------
//  BUSINESS LOGIC
// ------------------------------------------------------------

/**
 * Activates the ₹1 / 7-day trial (or any paid plan) for this user.
 * Writes BOTH localStorage and Firestore, Firestore is awaited so
 * callers can confirm before redirecting the user onward.
 */
export async function activateTrial(days = 7) {
  const userId = getUserId();
  const trialExpiry = Date.now() + days * 24 * 60 * 60 * 1000;
  const state = { isSubscribed: true, trialExpiry };

  writeLocal({ ...getLocalSubscriptionState(), ...state });
  await writeRemote(userId, state);
  return state;
}

/**
 * Marks the one free mock test as used. Writes both stores.
 */
export async function markFreeMockUsed() {
  const userId = getUserId();
  writeLocal({ ...getLocalSubscriptionState(), freeMockUsed: true });
  try { await writeRemote(userId, { freeMockUsed: true }); } catch (_) {}
}

/**
 * Decides whether the user can open a given test right now.
 * Local-first check, falls back to a fresh Firestore read only if
 * local says "blocked" — so legitimate subscribers on a fresh device
 * aren't wrongly blocked before their first sync completes.
 *
 * @param {boolean} testIsFree - the test's own isFree flag from admin
 * @returns {Promise<{allowed:boolean, reason:'subscribed'|'free-test'|'free-mock'|'blocked'}>}
 */
export async function canAccessTest(testIsFree) {
  if (testIsFree) return { allowed: true, reason: 'free-test' };

  let state = getLocalSubscriptionState();
  if (state.isSubscribed) return { allowed: true, reason: 'subscribed' };

  // Local says not subscribed — verify against Firestore before blocking,
  // in case this device hasn't synced a just-activated subscription yet.
  try {
    const userId = getUserId();
    const remote = await readRemote(userId);
    if (remote) {
      state = await applyExpiryRemote(userId, remote);
      writeLocal(state);
      if (state.isSubscribed) return { allowed: true, reason: 'subscribed' };
    }
  } catch (_) { /* fall through to free-mock logic on network failure */ }

  if (!state.freeMockUsed) return { allowed: true, reason: 'free-mock' };

  return { allowed: false, reason: 'blocked' };
}

// ------------------------------------------------------------
//  RAZORPAY HANDOFF
// ------------------------------------------------------------

/**
 * Redirects to a Razorpay payment link, tagging the userId so the
 * success page (or webhook-driven backend) can call activateTrial()
 * for the right user. Replace RAZORPAY_PAYMENT_LINK_HERE with the
 * real payment link before going live.
 */
export function startTrialCheckout(paymentLink) {
  const userId = getUserId();
  const link = paymentLink || 'RAZORPAY_PAYMENT_LINK_HERE';
  const url = link + (link.includes('?') ? '&' : '?') + 'userId=' + encodeURIComponent(userId);
  window.location.href = url;
}
