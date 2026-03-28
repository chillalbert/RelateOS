import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Moon, LogOut, ChevronRight, Sparkles, X, Check, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Settings() {
  const { user, firebaseUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [personality, setPersonality] = React.useState(user?.personality || 'Chill');
  const [appearance, setAppearance] = React.useState(user?.appearance || 'light');
  const [notifSettings, setNotifSettings] = React.useState(user?.notification_settings || { birthdays: true, tasks: true, groups: true });
  
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [showNotifModal, setShowNotifModal] = React.useState(false);
  const [passwordData, setPasswordData] = React.useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = React.useState('');
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  React.useEffect(() => {
    if (appearance === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appearance]);

  const handlePersonalityChange = async () => {
    if (!firebaseUser) return;
    const personalities = ['Chill', 'Professional', 'Heartfelt', 'Funny'];
    const currentIndex = personalities.indexOf(personality);
    const nextIndex = (currentIndex + 1) % personalities.length;
    const nextPersonality = personalities[nextIndex];
    
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, { personality: nextPersonality }, { merge: true });
      setPersonality(nextPersonality);
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAppearanceToggle = async () => {
    if (!firebaseUser) return;
    const nextAppearance = appearance === 'light' ? 'dark' : 'light';
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, { appearance: nextAppearance }, { merge: true });
      setAppearance(nextAppearance);
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifToggle = async (key: keyof typeof notifSettings) => {
    if (!firebaseUser) return;
    const nextSettings = { ...notifSettings, [key]: !notifSettings[key] };
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, { notification_settings: nextSettings }, { merge: true });
      setNotifSettings(nextSettings);
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !firebaseUser?.email) return;
    
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(firebaseUser.email, passwordData.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, passwordData.newPassword);
      
      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setPasswordError(err.message || 'Failed to change password');
    }
  };

  const [birthday, setBirthday] = React.useState(user?.birthday || '');

  const handleBirthdayChange = async (newBirthday: string) => {
    if (!firebaseUser) return;
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, { birthday: newBirthday }, { merge: true });
      setBirthday(newBirthday);
      await refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const [showBirthdayModal, setShowBirthdayModal] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const isAdmin = user?.email === 'smayansri@gmail.com';

  const handleResetData = async () => {
    if (!isAdmin) return;
    setIsResetting(true);
    try {
      // Delete all rooms and their subcollections
      const roomsRef = collection(db, 'rooms');
      let roomsSnap;
      try {
        roomsSnap = await getDocs(roomsRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'rooms');
        return;
      }

      const roomDeletes: Promise<void>[] = [];
      
      for (const roomDoc of roomsSnap.docs) {
        // Delete subcollections
        const subcollections = ['ideas', 'contributions', 'surprises'];
        for (const sub of subcollections) {
          const subRef = collection(db, 'rooms', roomDoc.id, sub);
          let subSnap;
          try {
            subSnap = await getDocs(subRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, `rooms/${roomDoc.id}/${sub}`);
            continue;
          }
          subSnap.docs.forEach(d => {
            roomDeletes.push(deleteDoc(d.ref).catch(e => handleFirestoreError(e, OperationType.DELETE, d.ref.path)));
          });
        }
        // Delete the room itself
        roomDeletes.push(deleteDoc(roomDoc.ref).catch(e => handleFirestoreError(e, OperationType.DELETE, roomDoc.ref.path)));
      }
      
      // Delete all memories, tasks, and gifts in all people
      const peopleRef = collection(db, 'people');
      let peopleSnap;
      try {
        peopleSnap = await getDocs(peopleRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'people');
        return;
      }

      const peopleSubDeletes: Promise<void>[] = [];
      
      for (const personDoc of peopleSnap.docs) {
        const subcollections = ['memories', 'tasks', 'gifts'];
        for (const sub of subcollections) {
          const subRef = collection(db, 'people', personDoc.id, sub);
          let subSnap;
          try {
            subSnap = await getDocs(subRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, `people/${personDoc.id}/${sub}`);
            continue;
          }
          subSnap.docs.forEach(m => {
            peopleSubDeletes.push(deleteDoc(m.ref).catch(e => handleFirestoreError(e, OperationType.DELETE, m.ref.path)));
          });
        }
      }

      await Promise.all([...roomDeletes, ...peopleSubDeletes]);
      alert('All rooms, vault items, and shared birthday messages have been deleted.');
      setShowResetConfirm(false);
    } catch (err) {
      console.error("Reset error:", err);
      // If it's a JSON error, the ErrorBoundary will catch it if we re-throw it
      // but here we might want to alert if it's not caught by boundary
      if (err instanceof Error && err.message.startsWith('{')) {
        throw err; // Let ErrorBoundary handle it
      }
      alert('Failed to reset data.');
    } finally {
      setIsResetting(false);
    }
  };

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: <User size={20} />, label: 'Profile Information', value: user?.name, onClick: () => {} },
        { icon: <Sparkles size={20} />, label: 'My Birthday', value: birthday || 'Not set', onClick: () => setShowBirthdayModal(true) },
        { icon: <Shield size={20} />, label: 'Security & Password', value: '••••••••', onClick: () => setShowPasswordModal(true) },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: <Bell size={20} />, label: 'Notification Settings', value: Object.values(notifSettings).filter(Boolean).length + ' Active', onClick: () => setShowNotifModal(true) },
        { icon: <Sparkles size={20} />, label: 'AI Personality', value: personality, onClick: handlePersonalityChange },
        { icon: <Moon size={20} />, label: 'Appearance', value: appearance.charAt(0).toUpperCase() + appearance.slice(1), onClick: handleAppearanceToggle },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 pt-[calc(1.5rem+var(--sat))] bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Profile Card */}
        <div className="p-6 card-premium flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-2xl font-black">
            {user?.name?.[0]}
          </div>
          <div>
            <h2 className="font-black text-xl tracking-tight">{user?.name}</h2>
            <p className="text-sm text-zinc-500 font-medium">{user?.email}</p>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h3 className="label-micro px-2">{section.title}</h3>
            <div className="card-premium overflow-hidden">
              {section.items.map((item, i) => (
                <button 
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                    i !== section.items.length - 1 ? 'border-b border-[var(--line)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-zinc-400">{item.icon}</div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{item.value}</span>
                    <ChevronRight size={16} className="text-zinc-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-3xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <LogOut size={20} />
          Sign Out
        </button>

        {isAdmin && (
          <section className="space-y-4 pt-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-red-500 ml-1">Danger Zone</h2>
            <div className="card-premium overflow-hidden border-red-100 dark:border-red-900/30">
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="w-full p-5 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                    <Trash2 size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-red-600">Reset App Data</p>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold">Delete all rooms & messages</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-zinc-300 group-hover:text-red-500 transition-colors" />
              </button>
            </div>
          </section>
        )}

        <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest">RelateOS v1.0.4</p>
      </div>

      <Navigation />

      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white dark:bg-zinc-900 rounded-[32px] p-8 w-full max-w-sm space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">Are you sure?</h3>
                <p className="text-sm text-zinc-500">This will permanently delete all Birthday Rooms and all shared birthday messages. This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResetData}
                  disabled={isResetting}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Yes, Reset All'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBirthdayModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBirthdayModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Your Birthday</h2>
                <button onClick={() => setShowBirthdayModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <p className="text-sm text-zinc-500">We use your birthday to show you a precise countdown and unlock special vaults on your big day!</p>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                    value={birthday}
                    onChange={(e) => handleBirthdayChange(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setShowBirthdayModal(false)}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-sm"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Change Password</h2>
                <button onClick={() => setShowPasswordModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X size={20} />
                </button>
              </div>

              {passwordSuccess ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <Check size={32} />
                  </div>
                  <p className="font-bold text-emerald-500">Password updated successfully!</p>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">Current Password</label>
                    <input
                      type="password"
                      required
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={passwordData.currentPassword || ''}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">New Password</label>
                    <input
                      type="password"
                      required
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={passwordData.newPassword || ''}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={passwordData.confirmPassword || ''}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    />
                  </div>
                  {passwordError && <p className="text-xs font-bold text-red-500">{passwordError}</p>}
                  <button 
                    type="submit"
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20"
                  >
                    Update Password
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Notification Settings</h2>
                <button onClick={() => setShowNotifModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { id: 'birthdays', label: 'Birthdays', desc: 'Get notified when someone has a birthday' },
                  { id: 'tasks', label: 'Tasks', desc: 'Reminders for upcoming relationship tasks' },
                  { id: 'groups', label: 'Groups', desc: 'Updates from your collaborative planning groups' }
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => handleNotifToggle(item.id as any)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-bold text-sm">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${notifSettings[item.id as keyof typeof notifSettings] ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifSettings[item.id as keyof typeof notifSettings] ? 'left-7' : 'left-1'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
