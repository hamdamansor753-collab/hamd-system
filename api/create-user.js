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

// ⚠️ SECURITY FIX: this endpoint previously had NO authentication check at
// all — any anonymous request on the internet could create a user with
// role "admin" for any tenantId, which is a full account-takeover /
// tenant-isolation-bypass vulnerability. It now requires a valid Firebase
// ID token in the `Authorization: Bearer <token>` header, verifies the
// caller's custom claims, and only allows an `admin` or `super-admin` to
// create users — and only within their own tenant (unless they are
// `super-admin`).
async function verifyCallerAndAuthorize(req, requestedTenantId) {
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
    const err = new Error('Caller does not have permission to create users');
    err.statusCode = 403;
    throw err;
  }

  if (callerRole !== 'super-admin' && callerTenantId !== requestedTenantId) {
    const err = new Error('Cannot create a user for a different tenant');
    err.statusCode = 403;
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
    const { email, password, username, name, role, tenantId } = JSON.parse(req.body);

    if (!email || !password || !username || !role || !tenantId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    await verifyCallerAndAuthorize(req, tenantId);

    // A caller who is not super-admin can never grant a role higher than
    // "admin" within their own tenant — prevents privilege escalation via
    // this endpoint (e.g. a tenant admin trying to grant "super-admin").
    if (role === 'super-admin') {
      res.status(403).json({ error: 'Only an existing super-admin can create another super-admin (use the server-side script, not this API)' });
      return;
    }

    // 1. Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name || username,
    });

    // 2. Set Custom User Claims for Tenant ID and Role (very secure for firestore rules!)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      tenantId,
      role,
    });

    // 3. Save User Profile in Firestore users collection
    // Note: intentionally no `password` field is stored here — Firebase
    // Auth is the sole source of truth for credentials.
    const userProfile = {
      id: userRecord.uid,
      tenantId,
      username,
      name: name || username,
      email,
      role,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userRecord.uid).set(userProfile);

    res.status(201).json({ success: true, userId: userRecord.uid });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Internal Server Error' });
  }
};
