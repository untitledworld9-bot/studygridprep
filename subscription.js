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
  addDoc,
  collection,
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
    // ✅ Firebase UID always wins
    // If stored ID is different (previous user or generated id) — overwrite + clear old sub state
    const storedId = localStorage.getItem(LS_KEYS.USER_ID);
    if (storedId && storedId !== authedUid) {
      // Different user logged in — clear old subscription state so it doesn't bleed over
      localStorage.removeItem(LS_KEYS.IS_SUB);
      localStorage.removeItem(LS_KEYS.TRIAL_EXPIRY);
      localStorage.removeItem(LS_KEYS.FREE_USED);
    }
    localStorage.setItem(LS_KEYS.USER_ID, authedUid);
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
function _fireProActivationNotification(plan) {
  try {
    const label = plan === 'trial' ? '7-day trial' : '30-day plan';
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification('🎉 Pro Activated — Study Grid Prep', {
          body: `Your ${label} is now active! All mock tests are unlocked.`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: 'sgp_pro_activated',
          requireInteraction: true,
          data: { url: '/subscription.html' }
        });
      }).catch(() => {});
    }
  } catch(e) {}
}

export function watchSubscription(onUpdate) {
  const userId = getUserId();
  const ref = doc(db, USERS_COLL, userId);
  let _prevIsSubscribed = getLocalSubscriptionState().isSubscribed;
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const state = applyExpiryLocal({
      isSubscribed: !!data.isSubscribed,
      trialExpiry:  data.trialExpiry || null,
      freeMockUsed: !!data.freeMockUsed,
      trialUsed:    !!data.trialUsed,
      plan:         data.plan || null,
      payPending:   !!data.payPending
    });
    writeLocal(state);

    // Fire PWA notification when subscription just became active
    if (!_prevIsSubscribed && state.isSubscribed) {
      _fireProActivationNotification(data.plan || 'trial');
    }
    _prevIsSubscribed = state.isSubscribed;
    if (typeof onUpdate === 'function') onUpdate(state, { source: 'remote-live' });
  }, (err) => {
    console.warn('Subscription listener error:', err);
  });
}

// ------------------------------------------------------------
//  PWA NOTIFICATION — shown on Pro activation (focus.html pattern)
// ------------------------------------------------------------

function sendProActivationNotification() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Study Grid Prep Pro', {
        body: 'Pro Plan activated! All mock tests are now unlocked.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: false,
        tag: 'sgp_pro_activated',
        data: { url: '/subscription.html' }
      });
    }).catch(() => {});
  }
}

// ------------------------------------------------------------
//  BUSINESS LOGIC
// ------------------------------------------------------------

/**
 * Activates the ₹1 / 7-day trial for this user.
 * ONLY called internally after payment is verified in Firestore.
 * Never called directly from a URL param check.
 */
export async function activateTrial(days = 7) {
  const userId = getUserId();
  const trialExpiry = Date.now() + days * 24 * 60 * 60 * 1000;
  const state = { isSubscribed: true, trialExpiry };

  // 1. Write local immediately (instant UI)
  writeLocal({ ...getLocalSubscriptionState(), ...state });

  // 2. Write to Firestore (source of truth — awaited)
  await writeRemote(userId, {
    ...state,
    planName:    'trial_7day',
    activatedAt: Date.now()
  });

  // 3. Fire PWA notification
  sendProActivationNotification();

  return state;
}

/**
 * SECURE PAYMENT VERIFICATION
 *
 * Flow:
 *   1. Razorpay webhook (Cloud Function) writes to Firestore:
 *      users/{userId} → { paymentVerified: true, paymentId: "pay_xxx" }
 *
 *   2. This function polls Firestore (max 15s) waiting for that flag.
 *
 *   3. If found → calls activateTrial() → writes isSubscribed=true.
 *
 *   4. If not found in 15s → shows "Verifying..." and stops.
 *      User can refresh — initSubscriptionSync() will catch it.
 *
 * SECURITY: URL param ?payment=success is used only to TRIGGER
 * this verification check, NOT to activate directly.
 * A user manually opening the URL will just hit the poll,
 * find no paymentVerified flag in Firestore, and get nothing.
 */
export async function verifyAndActivate(onStatus) {
  const userId = getUserId();
  const notify = (msg, done = false, err = false) => {
    if (typeof onStatus === 'function') onStatus({ msg, done, err });
  };

  notify('Verifying payment…');

  // Check if already subscribed (e.g. webhook was fast, sync already ran)
  const local = getLocalSubscriptionState();
  if (local.isSubscribed) {
    notify('Pro is already active.', true);
    return { success: true, alreadyActive: true };
  }

  // Poll Firestore for paymentVerified flag (set by Cloud Function webhook)
  const MAX_ATTEMPTS = 10;   // 10 × 1.5s = 15 seconds max
  const INTERVAL_MS  = 1500;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const ref  = doc(db, USERS_COLL, userId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();

        // Already activated by a previous session or another device
        if (data.isSubscribed) {
          writeLocal({
            isSubscribed: true,
            trialExpiry:  data.trialExpiry || null,
            freeMockUsed: data.freeMockUsed || false
          });
          notify('Pro is active!', true);
          return { success: true };
        }

        // Webhook has written the verified flag
        if (data.paymentVerified === true) {
          notify('Payment confirmed — activating Pro…');
          await activateTrial(7);
          // Clear the pending flag so it doesn't re-trigger
          try {
            await writeRemote(userId, { paymentVerified: false });
          } catch (_) {}
          notify('Pro activated!', true);
          return { success: true };
        }
      }
    } catch (err) {
      console.warn('Poll attempt', attempt, 'failed:', err.message);
    }

    if (attempt < MAX_ATTEMPTS) {
      notify(`Verifying payment… (${attempt}/${MAX_ATTEMPTS})`);
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
  }

  // Timed out — webhook may be slow. User can refresh.
  notify(
    'Could not verify automatically. Refresh in a moment.',
    false,
    true
  );
  return { success: false, timedOut: true };
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

// ============================================================
//  MANUAL UPI PAYMENT SYSTEM (replaces Razorpay)
//  payments/{docId}  ← Firestore collection
// ============================================================

const PAYMENTS_COLL = 'payments';

/**
 * Submit a manual UPI payment request.
 * Stores txnId + screenshot (base64) in Firestore payments collection.
 * Also sets payPending=true on the user doc so UI shows "Under Review".
 *
 * @param {Object} opts
 *   userId   - string
 *   name     - string
 *   email    - string
 *   txnId    - string
 *   screenshot - base64 data-url string
 *   plan     - 'trial' | 'monthly'
 *   amount   - number (1 or 49)
 */
export async function submitPaymentRequest({ userId, name, email, txnId, screenshot, plan, amount }) {
  if (!userId || !txnId) throw new Error('userId and txnId are required');

  // 1. Write to payments collection
  const payRef = await addDoc(collection(db, PAYMENTS_COLL), {
    userId,
    name:      name  || '',
    email:     email || '',
    txnId:     txnId.trim(),
    screenshot: screenshot || '',
    amount,
    plan,
    status:    'pending',
    createdAt: Date.now()
  });

  // 2. Mark user doc as payment pending
  await writeRemote(userId, { payPending: true, payPendingPlan: plan });

  return payRef.id;
}

/**
 * Cancel a pending payment request from user side.
 * Clears payPending flag so user goes back to normal UI.
 */
export async function cancelPendingPayment(userId) {
  await writeRemote(userId, { payPending: false, payPendingPlan: null });
}

/**
 * Returns whether user has a pending payment (fast local check via Firestore).
 */
export async function getPaymentStatus(userId) {
  const remote = await readRemote(userId);
  return {
    payPending:     !!(remote?.payPending),
    payPendingPlan: remote?.payPendingPlan || null,
    trialUsed:      !!(remote?.trialUsed),
    isSubscribed:   !!(remote?.isSubscribed),
    trialExpiry:    remote?.trialExpiry || null
  };
}
