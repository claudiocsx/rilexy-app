import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', fbUser.uid));
          setIsAdmin(adminDoc.exists());
          setUser(fbUser);
        } catch {
          setIsAdmin(false);
          setUser(null);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    console.log('[AuthContext] login called', { email });
    setAuthError(null);
    try {
      console.log('[AuthContext] calling signInWithEmailAndPassword...');
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('[AuthContext] signIn success', { uid: result.user.uid });
      const adminDoc = await getDoc(doc(db, 'admins', result.user.uid));
      console.log('[AuthContext] admin doc exists:', adminDoc.exists());
      if (!adminDoc.exists()) {
        await signOut(auth);
        setAuthError('Acesso negado. Você não é administrador.');
        return false;
      }
      setIsAdmin(true);
      console.log('[AuthContext] login complete, is admin');
      return true;
    } catch (e) {
      console.error('[AuthContext] login error:', e.code, e.message);
      setAuthError(e.message);
      return false;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, authError, login, logout, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
