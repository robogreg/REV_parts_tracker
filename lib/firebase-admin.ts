import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let _db: Firestore | null = null;

function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    // In Cloud Run, use Application Default Credentials
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return adminApp;
}

export const adminAuth = () => getAuth(getAdminApp());

// Return a singleton Firestore instance.
// settings() can only be called once before any Firestore operations —
// caching the instance here prevents "settings can no longer be changed" errors.
export function adminDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}
