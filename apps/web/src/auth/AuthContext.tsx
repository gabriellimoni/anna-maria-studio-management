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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const signOut = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{ firebaseUser, loading, getIdToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
