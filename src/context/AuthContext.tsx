import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  personality?: string;
  appearance?: 'light' | 'dark';
  streak?: number;
  notification_settings?: {
    birthdays: boolean;
    tasks: boolean;
    groups: boolean;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUser(docSnap.data() as UserProfile);
      } else {
        // Handle case where auth exists but profile doesn't
        setUser(null);
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        console.error("Firestore Permission Denied: Please check your Security Rules in the Firebase Console.");
      } else {
        console.error("Error fetching user profile:", error);
      }
      setUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        const docRef = doc(db, 'users', fUser.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          // Auto-create profile if missing (e.g. social login or failed signup step)
          const newProfile: UserProfile = {
            id: fUser.uid,
            email: fUser.email || '',
            name: fUser.displayName || 'User',
            appearance: 'light',
            streak: 0,
            notification_settings: {
              birthdays: true,
              tasks: true,
              groups: true
            }
          };
          await setDoc(docRef, newProfile);
          setUser(newProfile);
        } else {
          setUser(docSnap.data() as UserProfile);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserProfile(firebaseUser.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
