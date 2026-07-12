const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
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
      console.log("Firebase Admin initialized via cert variables");
    } else {
      admin.initializeApp({
        projectId: 'hamd-pos',
      });
      console.log("Firebase Admin initialized via project ID fallback");
    }
  } catch (err) {
    console.error("Firebase Admin initialization error:", err);
  }
}

const db = admin.firestore();

// ⚠️ SECURITY FIX: this endpoint previously had NO authentication check —
// any anonymous request could delete any user by guessing/knowing a
// userId. It now requires a valid Firebase ID token, verifies the caller
// is an admin/super-admin, and only allows deleting users within the
// caller's own tenant (unless the caller is super-admin). It also refuses
// to let a caller delete their own account through this endpoint (avoids
// accidental total-lockout of a tenant).
async function verifyCallerAndAuthorize(req, targetUserDoc) {
  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    const err = new Error('Missing Authorization Bearer token');
    err.statusCode = 401;
    throw err;
  }

  const decoded = await admin.auth().verifyIdToken(match[1]);
  const callerRole = decoded.role;
  const callerTenantId = decoded.tenantId;

  if (callerRole !== 'admin' && callerRole !== 'super-admin') {
    const err = new Error('Caller does not have permission to delete users');
    err.statusCode = 403;
    throw err;
  }

  if (callerRole !== 'super-admin' && targetUserDoc && callerTenantId !== targetUserDoc.tenantId) {
    const err = new Error('Cannot delete a user from a different tenant');
    err.statusCode = 403;
    throw err;
  }

  if (decoded.uid === (targetUserDoc && targetUserDoc.id)) {
    const err = new Error('Cannot delete your own account through this endpoint');
    err.statusCode = 400;
    throw err;
  }

  return decoded;
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId } = JSON.parse(req.body);

    if (!userId) {
      res.status(400).json({ error: 'Missing userId' });
      return;
    }

    const targetDocSnap = await db.collection('users').doc(userId).get();
    const targetUserDoc = targetDocSnap.exists ? targetDocSnap.data() : null;

    await verifyCallerAndAuthorize(req, targetUserDoc);

    // 1. Delete user from Firebase Authentication
    try {
      await admin.auth().deleteUser(userId);
    } catch (authErr) {
      console.warn("User might not exist in Auth, deleting from Firestore anyway:", authErr.message);
    }

    // 2. Delete from Firestore users collection
    await db.collection('users').doc(userId).delete();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Internal Server Error' });
  }
};
