const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_stripe_key_12345');

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : null;

    if (privateKey && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'hamd-pos',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log("Firebase Admin initialized for webhook");
    } else {
      admin.initializeApp({
        projectId: 'hamd-pos',
      });
      console.log("Firebase Admin fallback for webhook");
    }
  } catch (err) {
    console.error("Firebase Admin initialization error:", err);
  }
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    
    // In local development or testing without webhook secret, bypass signature check
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn("STRIPE_WEBHOOK_SECRET is not set, parsing payload directly (dev mode)");
      event = JSON.parse(rawBody.toString());
    } else {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }

    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
      const session = event.data.object;
      const tenantId = session.metadata.tenantId;

      if (tenantId) {
        // Upgrade tenant to Pro
        await db.collection('tenants').doc(tenantId).update({
          plan: 'pro',
          updatedAt: new Date().toISOString()
        });
        console.log(`Tenant ${tenantId} upgraded to Pro via webhook`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = [];
    req.on('data', (chunk) => body.push(chunk));
    req.on('end', () => resolve(Buffer.concat(body)));
    req.on('error', (err) => reject(err));
  });
}
