import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthChange, RilaxyUser } from '../services/auth';
import { db } from '../services/firebase';
import { auth } from '../services/firebase';

interface AuthContextType {
  user: RilaxyUser | null;
  loading: boolean;
  userStatus: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, userStatus: null });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<RilaxyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      if (fbUser) {
        const approvalStatus = fbUser.approvalStatus || fbUser.status || 'approved';
        setUserStatus(approvalStatus);
        if (approvalStatus === 'banned') {
          setUser(null);
          await auth.signOut();
          return;
        }
        if (approvalStatus === 'pending') {
          setUser({ ...fbUser, status: 'pending' });
        } else {
          setUser(fbUser);
        }
      } else {
        setUser(null);
        setUserStatus(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
