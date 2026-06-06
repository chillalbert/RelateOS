import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  birthday?: string;
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
  signInWithGoogle: () => Promise<string | null>;
  getCalendarToken: () => Promise<string | null>;
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

  // signInWithGoogle — used ONLY for actual Firebase authentication login
  // This signs the user INTO the app with Google as their auth provider
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        localStorage.setItem('gcal_token', token);
      }
      return token;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  // getCalendarToken — used ONLY for Google Calendar/Contacts OAuth token
  // This does NOT sign the user into Firebase — it only gets an access token
  // for hitting the Google Calendar and People APIs
  const getCalendarToken = async (): Promise<string | null> => {
    try {
      const calendarProvider = new GoogleAuthProvider();
      calendarProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      calendarProvider.addScope('https://www.googleapis.com/auth/contacts.readonly');
      
      // Use signInWithPopup but immediately re-sign in with the existing
      // Firebase user to prevent session switching
      const currentUser = auth.currentUser;
      
      const result = await signInWithPopup(auth, calendarProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      
      if (token) {
        localStorage.setItem('gcal_token', token);
      }

      // If there was a previously signed in non-Google user, the session
      // may have switched. We restore the original user data from Firestore
      // using the new uid in case it changed.
      if (result.user) {
        const docRef = doc(db, 'users', result.user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUser(docSnap.data() as UserProfile);
        }
        setFirebaseUser(result.user);
      }

      return token;
    } catch (error: any) {
      // If user cancels the popup, just return null silently
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.error("Error getting calendar token:", error);
      return null;
    }
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserProfile(firebaseUser.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, logout, isLoading, refreshUser, signInWithGoogle, getCalendarToken }}>
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
