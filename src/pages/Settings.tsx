import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Moon, LogOut, ChevronRight, Sparkles, X, Calendar, Check, Lock, Trash2, AlertTriangle, Globe, Palette, Clock, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import AuraHeaderBadge from '../components/AuraHeaderBadge';
import HelpTip from '../components/HelpTip';
import CalendarImportStep from '../components/CalendarImportStep';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, setDoc, collection, getDocs, deleteDoc, query, where, arrayRemove } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getDisplayName } from '../lib/utils';

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

const colorMap: Record<string, string> = {
 violet: '#8b5cf6',
 emerald: '#10b981',
 amber: '#f59e0b',
 sky: '#0ea5e9',
 rose: '#f43f5e',
 gold: '#eab308',
 cyan: '#06b6d4',
 fuchsia: '#d946ef'
};

export default function Settings() {
 const { user, firebaseUser, logout, refreshUser } = useAuth();
 const navigate = useNavigate();
 const [personality, setPersonality] = React.useState(user?.personality || 'Chill');
 const [appearance, setAppearance] = React.useState(user?.appearance || 'light');
 const [notifSettings, setNotifSettings] = React.useState(user?.notification_settings || { birthdays: true, tasks: true, groups: true });
 const [notificationTime, setNotificationTime] = React.useState(user?.notification_time || '09:00');

 // Profile Privacy Management Section
 const [handle, setHandle] = React.useState(user?.custom_handle || '');
 const [isPrivate, setIsPrivate] = React.useState(user?.is_private ?? false);
 const [leaderboardVisibility, setLeaderboardVisibility] = React.useState<'public' | 'private'>(user?.leaderboardVisibility || 'private');
 const [favSports, setFavSports] = React.useState(user?.fav_sports_teams || '');
 const [favArtists, setFavArtists] = React.useState(user?.fav_artists || '');
 const [weekendVibes, setWeekendVibes] = React.useState(user?.weekend_activities || '');
 const [editedBirthMonth, setEditedBirthMonth] = React.useState<number>(user?.birthday_month || 1);
 const [editedBirthDay, setEditedBirthDay] = React.useState<number>(user?.birthday_day || 1);
 
 const [anythingExtra, setAnythingExtra] = React.useState(user?.anything_extra || '');
 const [nameDisplayPref, setNameDisplayPref] = React.useState<'full' | 'first'>(user?.nameDisplayPreference || 'full');
 const [timeFormatPref, setTimeFormatPref] = React.useState<'12h' | '24h'>(user?.timeFormatPreference || '12h');
 const [aiAccent, setAiAccent] = React.useState<'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'gold' | 'cyan' | 'fuchsia'>(user?.aiAccentColor || 'violet');
 const [showColorPickerModal, setShowColorPickerModal] = React.useState(false);
 const [blockedUsers, setBlockedUsers] = React.useState<any[]>([]);
 const [loadingBlocked, setLoadingBlocked] = React.useState(false);
 
 const [saveLoading, setSaveLoading] = React.useState(false);
 const [saveSuccess, setSaveSuccess] = React.useState(false);
 const [handleError, setHandleError] = React.useState('');
 const [handleChecking, setHandleChecking] = React.useState(false);

 const handleSignOut = async () => {
   await logout();
   navigate('/login', { replace: true });
 };

 const handleNamePrefToggle = async () => {
 if (!firebaseUser) return;
 const nextPref = nameDisplayPref === 'full' ? 'first' : 'full';
 
 // Optimistic UI update
 setNameDisplayPref(nextPref);
 
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await setDoc(userRef, { nameDisplayPreference: nextPref }, { merge: true });
 await refreshUser();
 } catch (err) {
 console.error(err);
 // Revert if error
 setNameDisplayPref(nameDisplayPref);
 }
 };

 const handleAiAccentChange = async (color: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'gold' | 'cyan' | 'fuchsia') => {
 if (!firebaseUser) return;
 
 // Optimistic UI update
 setAiAccent(color);
 
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await setDoc(userRef, { aiAccentColor: color }, { merge: true });
 await refreshUser();
 } catch (err) {
 console.error(err);
 // Revert if error
 setAiAccent(user?.aiAccentColor || 'violet');
 }
 };

 React.useEffect(() => {
 if (user) {
 if (user.custom_handle && !handle) setHandle(user.custom_handle);
 if (user.is_private !== undefined) setIsPrivate(user.is_private);
 if (user.leaderboardVisibility !== undefined) setLeaderboardVisibility(user.leaderboardVisibility);
 if (user.fav_sports_teams && !favSports) setFavSports(user.fav_sports_teams);
 if (user.fav_artists && !favArtists) setFavArtists(user.fav_artists);
 if (user.weekend_activities && !weekendVibes) setWeekendVibes(user.weekend_activities);
 if (user.birthday_month !== undefined) setEditedBirthMonth(user.birthday_month);
 if (user.birthday_day !== undefined) setEditedBirthDay(user.birthday_day);
 if (user.anything_extra && !anythingExtra) setAnythingExtra(user.anything_extra);
 if (user.nameDisplayPreference !== undefined) setNameDisplayPref(user.nameDisplayPreference);
 if (user.timeFormatPreference !== undefined) setTimeFormatPref(user.timeFormatPreference);
 if (user.aiAccentColor !== undefined) setAiAccent(user.aiAccentColor);
 if (user.appearance !== undefined) setAppearance(user.appearance);
 }
 }, [user]);

 React.useEffect(() => {
 const fetchBlockedDetails = async () => {
 const uids = user?.blocked_uids || [];
 if (uids.length === 0) {
 setBlockedUsers([]);
 return;
 }
 setLoadingBlocked(true);
 try {
 const usersRef = collection(db, 'users');
 const list: any[] = [];
 const qList = uids.slice(0, 30);
 const q = query(usersRef, where('__name__', 'in', qList));
 const snap = await getDocs(q);
 snap.forEach(d => {
 list.push({ id: d.id, ...d.data() });
 });
 setBlockedUsers(list);
 } catch (err) {
 console.error('Error fetching blocked users:', err);
 } finally {
 setLoadingBlocked(false);
 }
 };

 fetchBlockedDetails();
 }, [user?.blocked_uids]);

 const handleUnblock = async (targetUid: string) => {
 if (!firebaseUser) return;
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await updateDoc(userRef, {
 blocked_uids: arrayRemove(targetUid)
 });
 await refreshUser();
 } catch (err) {
 console.error('Error unblocking user:', err);
 alert('Failed to unblock user.');
 }
 };

 const checkHandleUniquenessOnBlur = async (val: string) => {
 const cleanHandle = val.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
 if (!cleanHandle) {
 setHandleError('Handle cannot be empty');
 return;
 }
 if (cleanHandle === user?.custom_handle || cleanHandle === user?.handle) {
 setHandleError('');
 return;
 }
 setHandleChecking(true);
 setHandleError('');
 try {
 const usersRef = collection(db, 'users');
 const q1 = query(usersRef, where('custom_handle', '==', cleanHandle));
 const q2 = query(usersRef, where('handle', '==', cleanHandle));
 
 const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
 const otherUserWithHandle = snap1.docs.find(d => d.id !== user?.id) || snap2.docs.find(d => d.id !== user?.id);
 
 if (otherUserWithHandle) {
 setHandleError('Handle is already taken ');
 }
 } catch (err) {
 console.error(err);
 } finally {
 setHandleChecking(false);
 }
 };

 const handleSaveProfileCard = async () => {
 if (!firebaseUser) return;
 setSaveLoading(true);
 setSaveSuccess(false);
 
 try {
 const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
 if (handleError) return;
 
 const userRef = doc(db, 'users', firebaseUser.uid);
 await updateDoc(userRef, {
 custom_handle: cleanHandle,
 handle: cleanHandle,
 is_private: isPrivate,
 leaderboardVisibility: leaderboardVisibility,
 fav_sports_teams: favSports,
 fav_artists: favArtists,
 weekend_activities: weekendVibes,
 birthday_month: parseInt(String(editedBirthMonth), 10),
 birthday_day: parseInt(String(editedBirthDay), 10),
 anything_extra: anythingExtra.trim()
 });
 await refreshUser();
 setSaveSuccess(true);
 setTimeout(() => setSaveSuccess(false), 2500);
 } catch (err) {
 console.error(err);
 alert('Failed to save profile privacy settings.');
 } finally {
 setSaveLoading(false);
 }
 };
 
 const [showPasswordModal, setShowPasswordModal] = React.useState(false);
 const [showNotifModal, setShowNotifModal] = React.useState(false);
 const [showUsernameModal, setShowUsernameModal] = React.useState(false);
 const [username, setUsername] = React.useState(user?.name || '');

 const handleNotificationTimeChange = async (newTime: string) => {
 if (!firebaseUser) return;
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await setDoc(userRef, { notification_time: newTime }, { merge: true });
 setNotificationTime(newTime);
 await refreshUser();
 } catch (err) {
 console.error(err);
 }
 };

 const handleUsernameChange = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!firebaseUser) return;
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await setDoc(userRef, { name: username }, { merge: true });
 setShowUsernameModal(false);
 await refreshUser();
 alert('Username updated successfully!');
 } catch (err) {
 console.error(err);
 alert('Failed to update username.');
 }
 };

 const [passwordData, setPasswordData] = React.useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
 const [passwordError, setPasswordError] = React.useState('');
 const [passwordSuccess, setPasswordSuccess] = React.useState(false);

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
 const credential = EmailAuthProvider.credential(firebaseUser.email, passwordData.currentPassword);
 await reauthenticateWithCredential(auth.currentUser, credential);
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
 const [showCalendarImport, setShowCalendarImport] = React.useState(false);
 const [isResetting, setIsResetting] = React.useState(false);
 const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const isAdmin = user?.email === 'smayansri@gmail.com' || user?.isAdmin === true || user?.role === 'admin';

 const handleResetData = async () => {
 if (!isAdmin) return;
 setIsResetting(true);
 try {
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
 roomDeletes.push(deleteDoc(roomDoc.ref).catch(e => handleFirestoreError(e, OperationType.DELETE, roomDoc.ref.path)));
 }
 
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
 if (err instanceof Error && err.message.startsWith('{')) {
 throw err;
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
 { icon: <User size={20} />, label: 'Profile Information', value: getDisplayName(user), onClick: () => { setUsername(user?.name || ''); setShowUsernameModal(true); } },
 { icon: <Sparkles size={20} />, label: 'My Birthday', value: birthday || 'Not set', onClick: () => setShowBirthdayModal(true) },
 { icon: <Calendar size={20} />, label: 'Import Contacts', value: 'Google Sync', onClick: () => setShowCalendarImport(true) },
 { icon: <Shield size={20} />, label: 'Security & Password', value: '••••••••', onClick: () => setShowPasswordModal(true) },
 ]
 },
 {
 title: 'Preferences',
 items: [
 { 
 icon: <Bell size={20} />, 
 label: 'Notification Settings', 
 value: `${Object.values(notifSettings).filter(Boolean).length} Active (@ ${notificationTime})`, 
 help: "Choose when you want birthday reminder notifications (e.g. 7 days before, day of, or time of day).",
 onClick: () => setShowNotifModal(true) 
 },
 { 
 icon: <Sparkles size={20} />, 
 label: 'AI Personality', 
 value: personality, 
 help: "Sets the voice tone of generated birthday card messages and AI gift suggestions (e.g., Chill, Professional, Heartfelt, Funny).",
 onClick: handlePersonalityChange 
 },
 { 
 icon: <Moon size={20} />, 
 label: 'Appearance', 
 value: appearance.charAt(0).toUpperCase() + appearance.slice(1), 
 help: "Switch between Light and Dark visual modes.",
 onClick: handleAppearanceToggle 
 },
 { 
 icon: <User size={20} />, 
 label: 'Display First Name Only', 
 value: nameDisplayPref === 'first' ? 'On' : 'Off', 
 isToggle: true, 
 toggleState: nameDisplayPref === 'first', 
 help: "When enabled, your profile and activity show only your first name across shared party rooms and public cards for privacy.",
 onClick: handleNamePrefToggle 
 },
 { 
 icon: <Clock size={20} />, 
 label: 'Time Format Preference', 
 isTimeFormat: true,
 help: "Choose between 12-hour (2:30 PM) and 24-hour (14:30) display formats across all event countdowns and group schedules.",
 },
 { 
 icon: <Palette size={20} />, 
 label: 'AI Accent Color', 
 value: aiAccent.charAt(0).toUpperCase() + aiAccent.slice(1), 
 isColorPicker: true, 
 colorValue: aiAccent,
 help: "Customizes the visual accent color used for AI recommendations, highlight badges, and primary buttons.",
 onClick: () => setShowColorPickerModal(true) 
 },
 { 
 icon: <ShoppingBag size={20} className="text-amber-500" />, 
 label: 'Aura Shop', 
 value: `${user?.auraBalance || 0} Aura`,
 help: "Spend your earned Aura tokens on Streak Freezes, cosmetic badges, theme colors, and AI credits.",
 onClick: () => navigate('/shop') 
 }
 ]
 }
 ];

 return (
 <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
 <header className="p-6 pt-[calc(1.5rem+var(--sat))] bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 sticky top-0 z-10">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <button onClick={() => navigate(-1)} className="p-2 -ml-2">
 <ArrowLeft size={24} />
 </button>
 <h1 className="text-lg font-bold">Settings</h1>
 </div>
 <AuraHeaderBadge />
 </div>
 </header>

 <div className="p-6 space-y-8 max-w-2xl mx-auto">
 {/* Profile Card */}
 <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 rounded-3xl shadow-sm dark:shadow-lg flex items-center gap-4">
 {user?.profile_picture_url ? (
 <img 
 src={user.profile_picture_url} 
 alt={getDisplayName(user)} 
 className="w-16 h-16 rounded-2xl object-cover bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" 
 referrerPolicy="no-referrer"
 />
 ) : (
 <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-2xl font-black">
 {getDisplayName(user)?.[0]}
 </div>
 )}
 <div>
 <h2 className="font-black text-xl tracking-tight">{getDisplayName(user)}</h2>
 <p className="text-sm text-zinc-500 font-medium">{user?.email}</p>
 </div>
 </div>

 {sections.map((section) => (
 <div key={section.title} className="space-y-3">
 <h3 className="label-micro px-2">{section.title}</h3>
 <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 rounded-3xl shadow-sm dark:shadow-lg overflow-hidden">
 {section.items.map((item, i) => {
 if ('isTimeFormat' in item && item.isTimeFormat) {
 return (
 <div 
 key={item.label}
 className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-3 ${
 i !== section.items.length - 1 ? 'border-b border-[var(--line)]' : ''
 }`}
 >
 <div className="flex items-center gap-3">
 <div className="text-zinc-400">{item.icon}</div>
 <span className="text-sm font-medium">{item.label}</span>
 {item.help && <HelpTip title={item.label} content={item.help} />}
 </div>
 <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl shrink-0">
 <button
 type="button"
 onClick={async () => {
 if (timeFormatPref !== '12h') {
 setTimeFormatPref('12h');
 if (firebaseUser) {
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await setDoc(userRef, { timeFormatPreference: '12h' }, { merge: true });
 await refreshUser();
 } catch (err) {
 console.error(err);
 }
 }
 }
 }}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
 timeFormatPref === '12h'
 ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm'
 : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
 }`}
 >
 12-hour (2:30 PM)
 </button>
 <button
 type="button"
 onClick={async () => {
 if (timeFormatPref !== '24h') {
 setTimeFormatPref('24h');
 if (firebaseUser) {
 try {
 const userRef = doc(db, 'users', firebaseUser.uid);
 await setDoc(userRef, { timeFormatPreference: '24h' }, { merge: true });
 await refreshUser();
 } catch (err) {
 console.error(err);
 }
 }
 }
 }}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
 timeFormatPref === '24h'
 ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm'
 : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
 }`}
 >
 24-hour (14:30)
 </button>
 </div>
 </div>
 );
 }

 return (
 <div 
 key={item.label}
 role="button"
 tabIndex={0}
 onClick={item.onClick}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 item.onClick?.(e as any);
 }
 }}
 className={`w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
 i !== section.items.length - 1 ? 'border-b border-[var(--line)]' : ''
 }`}
 >
 <div className="flex items-center gap-3">
 <div className="text-zinc-400">{item.icon}</div>
 <span className="text-sm font-medium">{item.label}</span>
 {item.help && <HelpTip title={item.label} content={item.help} />}
 </div>
 <div className="flex items-center gap-2">
 {('isToggle' in item && item.isToggle) ? (
 <div className="flex items-center">
 <div 
 className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${
 item.toggleState ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
 }`}
 >
 <motion.div 
 layout
 transition={{ type: "spring", stiffness: 500, damping: 30 }}
 className="bg-white w-5 h-5 rounded-full shadow-md"
 style={{
 x: item.toggleState ? 20 : 0
 }}
 />
 </div>
 </div>
 ) : ('isColorPicker' in item && item.isColorPicker) ? (
 <div className="flex items-center gap-2">
 <span 
 className="w-3.5 h-3.5 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm" 
 style={{ backgroundColor: colorMap[item.colorValue as keyof typeof colorMap] }} 
 />
 <span className="text-xs text-zinc-400">{item.value}</span>
 <ChevronRight size={16} className="text-zinc-300" />
 </div>
 ) : (
 <>
 <span className="text-xs text-zinc-400">{item.value}</span>
 <ChevronRight size={16} className="text-zinc-300" />
 </>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}

 {/* Your Public Profile Card & Privacy Section */}
 <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
 <div className="flex items-center gap-2 px-2">
 <Shield size={18} className="text-emerald-500" />
 <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-900 dark:text-white">Your Public Profile Card & Privacy</h3>
 <HelpTip 
 title="Public Profile & Bio Link" 
 content="Your custom handle creates a shareable bio link (e.g. /u/yourhandle) so friends can view your wishlist and wish you a Happy Birthday." 
 />
 </div>
 
 <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 rounded-3xl shadow-sm dark:shadow-lg space-y-6">
 {/* Custom Handle Input */}
 <div className="space-y-2">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Custom Handle URL</label>
 <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 rounded-xl p-0.5 border border-zinc-100 dark:border-zinc-700 min-w-0 overflow-hidden">
 <span className="pl-3 text-zinc-400 text-xs font-semibold font-mono truncate min-w-0 shrink">https://relateosbday.netlify.app/u/</span>
 <input
 type="text"
 className="flex-1 min-w-[50px] p-2.5 pl-0.5 bg-transparent border-none text-xs font-bold text-zinc-950 dark:text-white outline-none focus:ring-0 shrink-0"
 placeholder="handle"
 value={handle}
 onChange={(e) => {
 const cleanVal = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
 setHandle(cleanVal);
 setHandleError('');
 }}
 onBlur={(e) => checkHandleUniquenessOnBlur(e.target.value)}
 />
 {handleChecking ? (
 <span className="text-[10px] text-zinc-400 pr-3 shrink-0 whitespace-nowrap">Checking...</span>
 ) : handle ? (
 <button
 type="button"
 onClick={() => {
 setHandle('');
 setHandleError('Handle cannot be empty');
 }}
 title="Clear handle"
 className="p-1.5 mr-1 text-zinc-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
 >
 <X size={14} />
 </button>
 ) : null}
 </div>
 {handleError && <p className="text-red-500 text-[10px] font-bold ml-1">{handleError}</p>}
 {!handleError && handle && (
 <p className="text-[10px] text-zinc-400 font-semibold ml-1 truncate min-w-0">
 Live Preview: <a href={`/u/${handle}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">{window.location.origin}/u/{handle}</a>
 </p>
 )}
 </div>

 {/* Privacy Toggle Cards */}
 <div className="space-y-2">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Privacy Preference</label>
 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => setIsPrivate(false)}
 className={`p-3.5 rounded-2xl border-2 text-left space-y-2 transition-all relative cursor-pointer ${
 !isPrivate 
 ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
 : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
 }`}
 >
 <Globe size={16} className={!isPrivate ? 'text-emerald-500' : 'text-zinc-500'} />
 <div>
 <h4 className="font-extrabold text-[11px] text-zinc-900 dark:text-white">Go Public </h4>
 <p className="text-[9px] text-zinc-400 font-medium leading-relaxed mt-0.5">Bio link active.</p>
 </div>
 </button>

 <button
 type="button"
 onClick={() => setIsPrivate(true)}
 className={`p-3.5 rounded-2xl border-2 text-left space-y-2 transition-all relative cursor-pointer ${
 isPrivate 
 ? 'border-zinc-900 dark:border-white bg-zinc-950/5 dark:bg-white/5' 
 : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
 }`}
 >
 <Lock size={16} className={isPrivate ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'} />
 <div>
 <h4 className="font-extrabold text-[11px] text-zinc-900 dark:text-white">Go Private </h4>
 <p className="text-[9px] text-zinc-400 font-medium leading-relaxed mt-0.5">Completely offline.</p>
 </div>
 </button>
 </div>
 </div>

 {/* Leaderboard Visibility Toggle Cards */}
 <div className="space-y-2 pt-3 border-t border-zinc-150 dark:border-zinc-800">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Leaderboard Visibility</label>
 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => setLeaderboardVisibility('public')}
 className={`p-3.5 rounded-2xl border-2 text-left space-y-2 transition-all relative cursor-pointer ${
 leaderboardVisibility === 'public' 
 ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
 : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
 }`}
 >
 <Globe size={16} className={leaderboardVisibility === 'public' ? 'text-emerald-500' : 'text-zinc-500'} />
 <div>
 <h4 className="font-extrabold text-[11px] text-zinc-900 dark:text-white">Public</h4>
 <p className="text-[9px] text-zinc-400 font-medium leading-relaxed mt-0.5">Visible globally.</p>
 </div>
 </button>

 <button
 type="button"
 onClick={() => setLeaderboardVisibility('private')}
 className={`p-3.5 rounded-2xl border-2 text-left space-y-2 transition-all relative cursor-pointer ${
 leaderboardVisibility === 'private' 
 ? 'border-zinc-900 dark:border-white bg-zinc-950/5 dark:bg-white/5' 
 : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
 }`}
 >
 <Lock size={16} className={leaderboardVisibility === 'private' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'} />
 <div>
 <h4 className="font-extrabold text-[11px] text-zinc-900 dark:text-white">Private</h4>
 <p className="text-[9px] text-zinc-400 font-medium leading-relaxed mt-0.5">Friends only.</p>
 </div>
 </button>
 </div>
 <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
 Public shows your score and name on the global leaderboard. Friends can always see your score regardless of this setting.
 </p>
 </div>

 {/* Editable Card Birthday Details Month and Day Dropdown Select inputs */}
 <div className="space-y-3 pt-4 border-t border-zinc-150 dark:border-zinc-800">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Card Birthday Details</label>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <label className="text-[9px] text-zinc-500 font-bold uppercase">Month</label>
 <select
 className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
 value={editedBirthMonth}
 onChange={(e) => setEditedBirthMonth(parseInt(e.target.value, 10))}
 >
 {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
 <option key={m} value={m}>
 {new Date(2020, m - 1, 1).toLocaleString('default', { month: 'long' })}
 </option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="text-[9px] text-zinc-500 font-bold uppercase">Day</label>
 <select
 className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
 value={editedBirthDay}
 onChange={(e) => setEditedBirthDay(parseInt(e.target.value, 10))}
 >
 {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
 <option key={d} value={d}>
 {d}
 </option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Social Vibes Fields */}
 <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
 <div className="space-y-1.5">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">Favorite Sports Teams</label>
 <input
 type="text"
 className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-none"
 placeholder="e.g. Lakers, Real Madrid"
 value={favSports}
 onChange={(e) => setFavSports(e.target.value)}
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">Favorite Artists / Albums</label>
 <input
 type="text"
 className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-none"
 placeholder="e.g. Drake, Billie Eilish"
 value={favArtists}
 onChange={(e) => setFavArtists(e.target.value)}
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">My Favorite thing to do on a weekend is...</label>
 <textarea
 rows={2}
 className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
 placeholder="e.g. record vinyl, hike with friends"
 value={weekendVibes}
 onChange={(e) => setWeekendVibes(e.target.value)}
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Anything Extra</label>
 <textarea
 rows={2}
 className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 text-xs font-semibold text-zinc-950 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
 placeholder="Random fun facts, clothing/shoe sizes, allergies, or coffee preferences..."
 value={anythingExtra}
 onChange={(e) => setAnythingExtra(e.target.value)}
 />
 </div>
 </div>

 {saveSuccess && (
 <p className="text-emerald-500 font-extrabold text-[11px] text-center uppercase tracking-wider animate-pulse pt-2">
 Profile card updated successfully! 
 </p>
 )}

 <button
 type="button"
 disabled={saveLoading || !!handleError || handleChecking}
 onClick={handleSaveProfileCard}
 className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
 >
 {saveLoading ? 'Saving...' : saveSuccess ? 'Profile Card Saved ' : 'Save Profile Card & Privacy'}
 </button>
 </div>
 </div>

 {/* Blocked Users section */}
 <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
 <div className="flex items-center gap-2 px-2">
 <X size={18} className="text-red-500" />
 <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-900 dark:text-white">Blocked Users</h3>
 </div>
 
 <div className="p-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 rounded-3xl shadow-sm dark:shadow-lg space-y-4">
 <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
 Users in your blocklist cannot view your public profile card, sync your birthday, or send you friend requests.
 </p>
 
 {loadingBlocked ? (
 <p className="text-xs text-zinc-400 font-bold animate-pulse uppercase tracking-wider">Loading blocklist...</p>
 ) : blockedUsers.length > 0 ? (
 <div className="space-y-3">
 {blockedUsers.map((bu) => (
 <div key={bu.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 gap-3">
 <div className="flex items-center gap-3">
 {bu.profile_picture_url ? (
 <img 
 src={bu.profile_picture_url} 
 alt={bu.name} 
 className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" 
 referrerPolicy="no-referrer"
 />
 ) : (
 <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center font-bold text-xs uppercase">
 {bu.name?.charAt(0) || '?'}
 </div>
 )}
 <div>
 <p className="text-xs font-black text-zinc-900 dark:text-white">{bu.name}</p>
 <p className="text-[10px] text-zinc-400 font-mono">@{bu.custom_handle || bu.handle || 'user'}</p>
 </div>
 </div>
 
 <button
 type="button"
 onClick={() => handleUnblock(bu.id)}
 className="px-3 py-1.5 bg-zinc-200 hover:bg-red-500 hover:text-white text-[10px] font-black text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-red-650 dark:hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1"
 >
 Unblock 
 </button>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider py-2">Your blocklist is empty </p>
 )}
 </div>
 </div>

 <button 
 onClick={handleSignOut}
 className="w-full flex items-center justify-center gap-2 p-5 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 text-zinc-900 dark:text-white rounded-3xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors shadow-sm dark:shadow-lg"
 >
 <LogOut size={20} />
 Sign Out
 </button>

 <a 
 href="https://sites.google.com/view/relate-os-privacy-policy/account-deletion?authuser=0"
 target="_blank"
 rel="noopener noreferrer"
 className="w-full flex items-center justify-center gap-2 p-5 border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-3xl font-bold text-sm transition-all text-center block"
 >
 Delete Account
 </a>

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

 {showCalendarImport && (
 <CalendarImportStep
 onComplete={() => setShowCalendarImport(false)}
 firebaseUserId={firebaseUser?.uid || ''}
 />
 )}

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
 className="relative bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-t border-t-white/5 rounded-[32px] p-8 w-full max-w-sm space-y-6 shadow-2xl dark:shadow-lg"
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
 className="relative w-full max-w-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-t border-t-white/5 rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl dark:shadow-lg"
 >
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-bold">Your Birthday</h2>
 <button onClick={() => setShowBirthdayModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
 <X size={20} />
 </button>
 </div>
 <div className="space-y-6">
 <p className="text-sm text-zinc-500">We use your birthday to show you a precise countdown and unlock special features on your big day!</p>
 <div className="space-y-1">
 <label className="text-xs font-bold uppercase text-zinc-400">Date of Birth</label>
 <input
 type="date"
 min="1900-01-01"
 max={new Date().toISOString().split('T')[0]}
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500"
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

 <AnimatePresence>
 {showUsernameModal && (
 <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setShowUsernameModal(false)}
 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
 />
 <motion.div 
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 className="relative w-full max-w-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-t border-t-white/5 rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl dark:shadow-lg"
 >
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-bold">Edit Username</h2>
 <button onClick={() => setShowUsernameModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
 <X size={20} />
 </button>
 </div>
 <form onSubmit={handleUsernameChange} className="space-y-6">
 <div className="space-y-1">
 <label className="text-xs font-bold uppercase text-zinc-400">Username / Display Name</label>
 <input
 type="text"
 required
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500 text-sm"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 />
 </div>
 <button 
 type="submit"
 className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20"
 >
 Save Username
 </button>
 </form>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

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
 className="relative w-full max-w-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-t border-t-white/5 rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl dark:shadow-lg"
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
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500"
 value={passwordData.currentPassword || ''}
 onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-bold uppercase text-zinc-400">New Password</label>
 <input
 type="password"
 required
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500"
 value={passwordData.newPassword || ''}
 onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-bold uppercase text-zinc-400">Confirm New Password</label>
 <input
 type="password"
 required
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500"
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
 className="relative w-full max-w-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-t border-t-white/5 rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl dark:shadow-lg"
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
 className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-700 transition-colors"
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

 <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
 <label className="text-xs font-bold uppercase text-zinc-400 block mb-1">
 When do you want to receive birthday morning alerts?
 </label>
 <input
 type="time"
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-sm font-semibold"
 value={notificationTime}
 onChange={(e) => handleNotificationTimeChange(e.target.value)}
 />
 </div>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 <AnimatePresence>
 {showColorPickerModal && (
 <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setShowColorPickerModal(false)}
 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
 />
 <motion.div 
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 className="relative w-full max-w-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-t border-t-white/5 rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl dark:shadow-lg"
 >
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-xl font-bold">AI Accent Color</h2>
 <button onClick={() => setShowColorPickerModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
 <X size={20} />
 </button>
 </div>
 
 <div className="space-y-4">
 <p className="text-xs text-zinc-500 mb-2">
 Choose a signature color theme applied to all AI-generated suggestions, note summaries, and coaching interfaces.
 </p>
 <div className="grid grid-cols-1 gap-2">
 {(['violet', 'emerald', 'amber', 'sky', 'rose', 'gold', 'cyan', 'fuchsia'] as const).map((color) => {
 const isPremium = color === 'gold' || color === 'cyan' || color === 'fuchsia';
 const isLocked = isPremium && !user?.premiumAccentUnlocked;
 const isSelected = aiAccent === color;
 return (
 <button
 key={color}
 onClick={() => {
 if (isLocked) {
 setShowColorPickerModal(false);
 navigate('/shop');
 return;
 }
 handleAiAccentChange(color);
 setShowColorPickerModal(false);
 }}
 className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
 isSelected 
 ? 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700' 
 : 'bg-white dark:bg-zinc-900 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800'
 }`}
 >
 <div className="flex items-center gap-3">
 <span 
 className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm"
 style={{ backgroundColor: colorMap[color] }}
 />
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold capitalize text-zinc-800 dark:text-zinc-200">
 {color}
 </span>
 {isPremium && (
 <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
 Premium
 </span>
 )}
 </div>
 </div>
 {isLocked ? (
 <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
 <Lock size={14} />
 <span>Shop</span>
 </div>
 ) : isSelected ? (
 <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
 <Check size={12} className="stroke-[3]" />
 </div>
 ) : null}
 </button>
 );
 })}
 </div>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </div>
 );
}
