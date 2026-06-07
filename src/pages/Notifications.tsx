import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Bell, Trash2, CheckCircle, Calendar, Users, 
  Star, Lock, Share2, HelpCircle, Eye, ShieldAlert, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import { formatDate } from '../lib/utils';
import { db } from '../lib/firebase';
import { 
  collection, query, where, getDocs, doc, updateDoc, deleteDoc, 
  orderBy, addDoc, serverTimestamp, arrayUnion 
} from 'firebase/firestore';

export default function Notifications() {
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();

  // Tabs
  const [activeTab, setActiveTab] = React.useState<'notifications' | 'activities'>('notifications');

  // Notifications states
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Social activities states
  const [activities, setActivities] = React.useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = React.useState(true);
  const [actionStatus, setActionStatus] = React.useState<{[key: string]: string}>({});

  const fetchNotifications = async () => {
    if (!firebaseUser) return;
    try {
      const notifRef = collection(db, 'notifications');
      const q = query(notifRef, where('user_id', '==', firebaseUser.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    if (!firebaseUser) return;
    try {
      const actRef = collection(db, 'social_activity');
      const q = query(actRef, where('host_uid', '==', firebaseUser.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort by timestamp
      data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setActivities(data);
    } catch (err) {
      console.error('Error fetching social activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  React.useEffect(() => {
    if (firebaseUser) {
      fetchNotifications();
      fetchActivities();
    }
  }, [firebaseUser]);

  const markAsRead = async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { is_read: true });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await deleteDoc(notifRef);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Button A Actions: Request Birthday Back
  const handleRequestBirthdayBack = async (act: any) => {
    if (!firebaseUser) return;
    const targetUid = act.grabber_uid;
    const targetName = act.grabber_name;
    
    setActionStatus(prev => ({ ...prev, [targetUid]: 'Requesting...' }));
    try {
      const frRef = collection(db, 'friend_requests');
      
      // Look up existing friend request
      const q1 = query(frRef, where('sender_uid', '==', firebaseUser.uid), where('receiver_uid', '==', targetUid));
      const q2 = query(frRef, where('sender_uid', '==', targetUid), where('receiver_uid', '==', firebaseUser.uid));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      if (!snap1.empty || !snap2.empty) {
        setActionStatus(prev => ({ ...prev, [targetUid]: 'Already exists!' }));
        setTimeout(() => {
          setActionStatus(prev => {
            const copy = { ...prev };
            delete copy[targetUid];
            return copy;
          });
        }, 2500);
        return;
      }

      await addDoc(frRef, {
        sender_uid: firebaseUser.uid,
        receiver_uid: targetUid,
        sender_name: user?.name || 'A Friend',
        status: 'pending',
        timestamp: serverTimestamp()
      });

      // Optional notifications push ping
      try {
        await fetch('/.netlify/functions/send-push-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host_uid: targetUid,
            title: '🤝 Friend Invitation',
            message: `${user?.name || 'Someone'} requested your birthday back!`
          })
        });
      } catch (e) {
        console.warn('Sync notification failed:', e);
      }

      setActionStatus(prev => ({ ...prev, [targetUid]: 'Sent! 🤝' }));
    } catch (err) {
      console.error(err);
      setActionStatus(prev => ({ ...prev, [targetUid]: 'Error' }));
    }
  };

  // Button B Actions: Block User 🛑
  const handleBlockUser = async (act: any) => {
    if (!firebaseUser) return;
    const targetUid = act.grabber_uid;
    
    setActionStatus(prev => ({ ...prev, [targetUid + '_block']: 'Blocking...' }));
    try {
      // 1. Append target user's UID to current user's 'blocked_uids' array
      const currentUserRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(currentUserRef, {
        blocked_uids: arrayUnion(targetUid)
      });

      // 2. Query friend requests and update 'accepted' to 'blocked'
      const frRef = collection(db, 'friend_requests');
      const q1 = query(frRef, where('sender_uid', '==', firebaseUser.uid), where('receiver_uid', '==', targetUid));
      const q2 = query(frRef, where('sender_uid', '==', targetUid), where('receiver_uid', '==', firebaseUser.uid));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const updatePromises = [...snap1.docs, ...snap2.docs].map(d => 
        updateDoc(doc(db, 'friend_requests', d.id), { status: 'blocked' })
      );
      await Promise.all(updatePromises);

      // 3. Query other user's private 'people' list for current user matching as host and delete instantly
      const peopleRef = collection(db, 'people');
      const pq = query(peopleRef, where('user_id', '==', targetUid), where('host_uid', '==', firebaseUser.uid));
      const psnap = await getDocs(pq);
      const deletePromises = psnap.docs.map(d => deleteDoc(doc(db, 'people', d.id)));
      await Promise.all(deletePromises);

      setActionStatus(prev => ({ ...prev, [targetUid + '_block']: 'Blocked 🛑' }));

      // Clean stream feed filter
      setTimeout(() => {
        setActivities(prev => prev.filter(item => item.grabber_uid !== targetUid));
      }, 1500);

    } catch (err) {
      console.error('Error blocking user:', err);
      setActionStatus(prev => ({ ...prev, [targetUid + '_block']: 'Error' }));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'birthday': return <Calendar className="text-amber-500" size={20} />;
      case 'group': return <Users className="text-emerald-500" size={20} />;
      case 'task': return <CheckCircle className="text-blue-500" size={20} />;
      default: return <Bell className="text-zinc-400" size={20} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 pt-[calc(1.5rem+var(--sat))] bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-700 dark:text-zinc-300">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Workspace Center</h1>
          </div>
          {activeTab === 'notifications' && notifications.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  for (const n of notifications.filter(n => !n.is_read)) {
                    await markAsRead(n.id);
                  }
                }}
                className="text-[10px] font-black text-emerald-500 uppercase tracking-wider hover:underline"
              >
                Mark all read
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Elegant Pill tab selector */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl max-w-sm mx-auto shadow-sm">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-white dark:bg-zinc-700 text-emerald-555 dark:text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            System Logs ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-white dark:bg-zinc-700 text-emerald-555 dark:text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Sync Stream ({activities.length})
          </button>
        </div>

        {/* Tab contents */}
        <AnimatePresence mode="wait">
          {activeTab === 'notifications' ? (
            <motion.div
              key="tab-notifs"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="text-center py-12 text-zinc-400 font-bold text-xs tracking-tight uppercase">Loading Logs...</div>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {notifications.map((notif) => (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 rounded-3xl border transition-all flex gap-4 ${
                          notif.is_read 
                            ? 'bg-white/50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-70' 
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-sm'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          notif.is_read ? 'bg-zinc-100 dark:bg-zinc-805' : 'bg-zinc-50 dark:bg-zinc-800'
                        }`}>
                          {getIcon(notif.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className={`text-sm font-black truncate ${notif.is_read ? 'text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                              {notif.title}
                            </h3>
                            <span className="text-[9px] text-zinc-400 whitespace-nowrap font-bold uppercase tracking-wider">
                              {new Date(notif.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                            {notif.message}
                          </p>
                          
                          <div className="flex items-center gap-3 mt-3">
                            {notif.link && (
                              <Link 
                                to={notif.link}
                                onClick={() => markAsRead(notif.id)}
                                className="text-[10px] font-black text-emerald-500 uppercase tracking-wider hover:underline"
                              >
                                View Details
                              </Link>
                            )}
                            {!notif.is_read && (
                              <button 
                                onClick={() => markAsRead(notif.id)}
                                className="text-[10px] font-black text-zinc-400 uppercase tracking-wider hover:text-zinc-900 dark:hover:text-white"
                              >
                                Mark Read
                              </button>
                            )}
                            <button 
                              onClick={() => deleteNotification(notif.id)}
                              className="text-[10px] font-black text-red-400 uppercase tracking-wider hover:text-red-600 ml-auto"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-24 space-y-4">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-zinc-400">
                    <Bell size={32} />
                  </div>
                  <p className="text-zinc-500 text-sm font-bold">No notifications yet</p>
                  <p className="text-xs text-zinc-400">We'll alert you here when friends lock details.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="tab-activity"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {activitiesLoading ? (
                <div className="text-center py-12 text-zinc-400 font-bold text-xs tracking-tight uppercase">Loading Stream...</div>
              ) : activities.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {activities.map((act) => {
                      const isActionBusy = actionStatus[act.grabber_uid];
                      const isBlockBusy = actionStatus[act.grabber_uid + '_block'];

                      return (
                        <motion.div
                          key={act.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-5 rounded-3xl border border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm uppercase shrink-0">
                              {act.grabber_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                                {act.grabber_name}
                              </h4>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                <Share2 size={10} /> Sync'd your birthday card
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0 md:self-center">
                            {/* Button A: Request Birthday Back */}
                            <button
                              onClick={() => handleRequestBirthdayBack(act)}
                              disabled={!!isActionBusy || !!isBlockBusy}
                              className="px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isActionBusy || 'Request Birthday Back 🤝'}
                            </button>

                            {/* Button B: Block User */}
                            <button
                              onClick={() => handleBlockUser(act)}
                              disabled={!!isBlockBusy}
                              className="px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-wider text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/10 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isBlockBusy || 'Block User 🛑'}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-24 space-y-4">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                    <Eye size={32} />
                  </div>
                  <p className="text-zinc-500 text-sm font-bold">No synchronization history yet</p>
                  <p className="text-xs text-zinc-400">When friends visit your URL and grab your info, they will appear here.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Navigation />
    </div>
  );
}
