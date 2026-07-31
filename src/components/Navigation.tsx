import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home,
  Calendar, 
  Plus, 
  BarChart3, 
  Shield,
  Brain,
  Gift,
  Trophy,
  Settings
} from 'lucide-react';
import { cn, isFeatureLocked } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function Navigation() {
  const location = useLocation();
  const path = location.pathname;

  const { firebaseUser, user } = useAuth();
  const { config } = useGamification();
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    if (!firebaseUser) {
      setUnreadCount(0);
      return;
    }

    const notifRef = collection(db, 'notifications');
    const q = query(
      notifRef,
      where('user_id', '==', firebaseUser.uid),
      where('is_read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (err) => {
      console.warn("Error listening to unread notifications:", err);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const [pendingCount, setPendingCount] = React.useState(typeof window !== 'undefined' ? (window as any).__pendingCount || 0 : 0);

  React.useEffect(() => {
    const handleUpdate = (e: any) => {
      setPendingCount(e.detail || 0);
    };
    window.addEventListener('pending_requests_count', handleUpdate);
    
    // Quick validation in case of state updates
    if (typeof window !== 'undefined' && (window as any).__pendingCount !== undefined) {
      setPendingCount((window as any).__pendingCount);
    }

    return () => {
      window.removeEventListener('pending_requests_count', handleUpdate);
    };
  }, []);

  const isActive = (p: string) => {
    if (p === '/' && path === '/') return true;
    if (p !== '/' && path.startsWith(p)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-3 left-1 right-1 sm:left-2 sm:right-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-full px-1 sm:px-2 py-1.5 flex justify-around items-center shadow-2xl z-50 max-w-2xl mx-auto mb-[var(--sab)] text-xs">
      {/* Left side */}
      <Link 
        to="/" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Home Dashboard"
      >
        <Home size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">Home</span>
      </Link>
      <Link 
        to="/calendar" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/calendar') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Birthday Calendar"
      >
        <Calendar size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">Calendar</span>
      </Link>
      <Link 
        to="/rooms" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/rooms') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Party Planning Rooms"
      >
        <Gift size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">
          {isFeatureLocked('rooms', user?.unlockedFeatures, config?.unlockSequence) ? '???' : 'Party'}
        </span>
      </Link>
      <Link 
        to="/leaderboard" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/leaderboard') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Leaderboard & Ranks"
      >
        <Trophy size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">
          {isFeatureLocked('leaderboard', user?.unlockedFeatures, config?.unlockSequence) ? '???' : 'Leaderboard'}
        </span>
      </Link>

      {/* Center + Action Button */}
      <Link 
        to="/add" 
        className="flex flex-col items-center justify-center p-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full -mt-6 shadow-xl hover:scale-105 transition-transform flex-shrink-0 mx-0.5"
        title="Add Friend or Import"
      >
        <Plus size={18} />
      </Link>

      {/* Right side */}
      <Link 
        to="/vaults" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/vaults') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Memory Vaults"
      >
        <Shield size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">
          {isFeatureLocked('vaults', user?.unlockedFeatures, config?.unlockSequence) ? '???' : 'Vaults'}
        </span>
      </Link>
      <Link 
        to="/analytics" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/analytics') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Friendship Analytics"
      >
        <BarChart3 size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">
          {isFeatureLocked('analytics', user?.unlockedFeatures, config?.unlockSequence) ? '???' : 'Stats'}
        </span>
      </Link>
      <Link 
        to="/coach" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/coach') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="AI Relationship Coach"
      >
        <Brain size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">
          {isFeatureLocked('coach', user?.unlockedFeatures, config?.unlockSequence) ? '???' : 'Coach'}
        </span>
      </Link>
      <Link 
        to="/settings" 
        className={cn("flex flex-col items-center p-1 px-0.5 sm:px-1 transition-colors min-w-0 flex-1 text-center", isActive('/settings') ? "text-emerald-500 font-bold" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Settings"
      >
        <Settings size={17} />
        <span className="text-[8px] sm:text-[9px] mt-0.5 tracking-tighter truncate max-w-full">Settings</span>
      </Link>
    </nav>
  );
}
