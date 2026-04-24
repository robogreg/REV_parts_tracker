'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { RevUser, UserRole } from '@/lib/types';
import { useAppStore } from '@/lib/store';

interface AuthContextValue {
  user: RevUser | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOutUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function buildRevUser(firebaseUser: User): Promise<RevUser | null> {
  const email = firebaseUser.email ?? '';
  if (!email.endsWith('@revrobotics.com')) {
    await signOut(auth);
    return null;
  }

  const idToken = await firebaseUser.getIdToken();

  // Fetch (and upsert) this user's role from Firestore via the server
  let role: UserRole = 'user';
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      role = data.role as UserRole;
    }
  } catch {
    // Network failure — default to 'user' (they'll just see checkout)
  }

  return {
    uid: firebaseUser.uid,
    email,
    name: firebaseUser.displayName ?? email,
    photoUrl: firebaseUser.photoURL ?? undefined,
    role,
    isAdmin: role === 'manager' || role === 'superadmin',
    idToken,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RevUser | null>(null);
  const [loading, setLoading] = useState(true);
  const setStoreUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const revUser = await buildRevUser(firebaseUser);
        setUser(revUser);
        setStoreUser(revUser);
      } else {
        setUser(null);
        setStoreUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [setStoreUser]);

  async function signOutUser() {
    await signOut(auth);
    setUser(null);
    setStoreUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}
