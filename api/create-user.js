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
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
