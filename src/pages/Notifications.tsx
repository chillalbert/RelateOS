import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bell, Trash2, CheckCircle, Calendar, Users, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import { formatDate } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

export default function Notifications() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchNotifications();
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
      <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-lg font-bold">Notifications</h1>
          </div>
          {notifications.length > 0 && (
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

      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="text-center py-12 text-zinc-500">Loading notifications...</div>
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
                      ? 'bg-white/50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-75' 
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-sm'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    notif.is_read ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-zinc-50 dark:bg-zinc-800'
                  }`}>
                    {getIcon(notif.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className={`text-sm font-bold truncate ${notif.is_read ? 'text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-[10px] text-zinc-400 whitespace-nowrap font-medium">
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
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-400">
              <Bell size={32} />
            </div>
            <p className="text-zinc-500 text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-zinc-400">We'll let you know when something important happens.</p>
          </div>
        )}
      </div>
      <Navigation />
    </div>
  );
}
