import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase client SDK must only be initialized in the browser.
// During Next.js server-side rendering (build-time prerender or SSR),
// getAuth() / getFirestore() etc. fail because they rely on browser globals.
// The exported values are only ever *used* inside useEffect / queryFn callbacks
// which don't run on the server, so the undefined-during-SSR stubs are safe.
const isBrowser = typeof window !== 'undefined';
const _app = isBrowser
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : undefined;

export const auth = (_app ? getAuth(_app) : undefined) as ReturnType<typeof getAuth>;
export const db = (_app ? getFirestore(_app) : undefined) as ReturnType<typeof getFirestore>;
export const storage = (_app ? getStorage(_app) : undefined) as ReturnType<typeof getStorage>;

export const googleProvider = isBrowser ? new GoogleAuthProvider() : undefined as unknown as GoogleAuthProvider;
if (isBrowser && googleProvider) {
  googleProvider.setCustomParameters({ hd: 'revrobotics.com' });
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!auth) throw new Error('Not authenticated');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
