import { createContext, useContext, useEffect, useState } from 'react';
import React from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthContext: Setting up onAuthStateChanged listener");
    
    // Ensure persistence is set before we trust the first auth state
    const initAuth = async () => {
      try {
        console.log("AuthContext: Initializing auth state...");
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log("AuthContext: User state changed:", user ? `${user.email} (${user.uid})` : "null");
          setUser(user);
          setLoading(false);
        });
        return unsubscribe;
      } catch (error) {
        console.error("AuthContext: Initialization error:", error);
        setLoading(false);
      }
    };

    const unsubscribePromise = initAuth();
    
    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
