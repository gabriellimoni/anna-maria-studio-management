import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { createContext, ReactNode, useEffect, useState } from 'react';
import { auth } from './firebase';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  getIdToken: () => Promise<string>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  loading: true,
  getIdToken: async () => '',
  signOut: async () => {},
});

interface E2EAuth {
  uid: string;
  email: string;
  displayName?: string;
  token: string;
}

function readE2EAuth(): E2EAuth | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __E2E_AUTH__?: E2EAuth };
  return w.__E2E_AUTH__ ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const e2e = readE2EAuth();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(
    e2e
      ? ({
          uid: e2e.uid,
          email: e2e.email,
          displayName: e2e.displayName ?? null,
          getIdToken: async () => e2e.token,
        } as unknown as FirebaseUser)
      : null,
  );
  const [loading, setLoading] = useState(!e2e);

  useEffect(() => {
    if (readE2EAuth()) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });
    return unsub;
  }, []);

  const getIdToken = async () => {
    if (!firebaseUser) return '';
    return firebaseUser.getIdToken();
  };

  const signOut = async () => {
    if (readE2EAuth()) {
      const w = window as unknown as { __E2E_AUTH__?: E2EAuth };
      w.__E2E_AUTH__ = undefined;
      setFirebaseUser(null);
      return;
    }
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, loading, getIdToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
