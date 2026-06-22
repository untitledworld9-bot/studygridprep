/**
 * ============================================================
 *  Study Grid Prep — Razorpay Webhook (Firebase Cloud Function)
 *
 *  Deploy: firebase deploy --only functions
 *
 *  Razorpay Dashboard → Settings → Webhooks → Add Webhook:
 *    URL:    https://<region>-<projectId>.cloudfunctions.net/razorpayWebhook
 *    Secret: (generate any random string, paste in .env below)
 *    Events: payment.captured   ← tick only this one
 * ============================================================
 */

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
const crypto     = require('crypto');

admin.initializeApp();
const db = admin.firestore();

/* ── Your Razorpay webhook secret ────────────────────────────
   1. Go to razorpay.com → Settings → Webhooks
   2. Set a webhook secret (any random string, e.g. "sgp_rzp_2024")
   3. Paste the SAME secret in Firebase env:
      firebase functions:config:set razorpay.webhook_secret="sgp_rzp_2024"
   ─────────────────────────────────────────────────────────── */
const WEBHOOK_SECRET = functions.config().razorpay?.webhook_secret || '';

exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {

  /* ── 1. Only allow POST ──────────────────────────────────── */
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  /* ── 2. Verify Razorpay signature ───────────────────────────
     Razorpay sends X-Razorpay-Signature header.
     We verify it using HMAC-SHA256 of the raw body.
     If signature doesn't match → reject (someone forged the request).
     ─────────────────────────────────────────────────────────── */
  const receivedSig = req.headers['x-razorpay-signature'];
  const rawBody     = req.rawBody; // Firebase provides this automatically

  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET not configured.');
    return res.status(500).send('Server misconfiguration');
  }

  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (receivedSig !== expectedSig) {
    console.warn('Invalid Razorpay signature — rejecting webhook.');
    return res.status(400).send('Invalid signature');
  }

  /* ── 3. Parse event ─────────────────────────────────────── */
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  /* ── 4. Only handle payment.captured ───────────────────── */
  if (event.event !== 'payment.captured') {
    return res.status(200).send('Event ignored');
  }

  /* ── 5. Extract payment info ────────────────────────────── */
  const payment   = event.payload?.payment?.entity;
  const paymentId = payment?.id;
  const amount    = payment?.amount; // in paise

  if (!payment || !paymentId) {
    return res.status(400).send('Missing payment entity');
  }

  /* ── 6. Extract userId from payment notes ───────────────────
     In subscription.js → startTrialCheckout(), we append:
       ?userId=<userId>
     Razorpay stores query params as "notes" on the payment.
     ─────────────────────────────────────────────────────────── */
  const userId = payment.notes?.userId || null;

  if (!userId) {
    console.error('No userId in payment notes — cannot link to user.', paymentId);
    // Still return 200 so Razorpay doesn't retry forever
    return res.status(200).send('No userId — logged but not processed');
  }

  /* ── 7. Write verified flag to Firestore ─────────────────── */
  try {
    const trialExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await db.collection('users').doc(userId).set({
      paymentVerified: true,
      isSubscribed:    true,
      trialExpiry:     trialExpiry,
      planName:        'trial_7day',
      activatedAt:     Date.now(),
      lastPaymentId:   paymentId,
      lastPaymentAmt:  amount,
      updatedAt:       Date.now()
    }, { merge: true });

    console.log(`✅ Payment verified for user ${userId}, payment ${paymentId}`);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('Firestore write failed:', err);
    return res.status(500).send('Database error');
  }
});
