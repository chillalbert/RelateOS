import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home,
  Calendar, 
  Users, 
  Plus, 
  BarChart3, 
  Shield,
  MessageSquare,
  Brain,
  Bell,
  Zap,
  Gift
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navigation() {
  const location = useLocation();
  const path = location.pathname;

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
    <nav className="fixed bottom-6 left-2 right-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-full p-2 flex justify-around items-center shadow-2xl z-50 max-w-2xl mx-auto mb-[var(--sab)] text-xs md:text-sm">
      <Link 
        to="/" 
        className={cn("p-2 transition-colors", isActive('/') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Home"
      >
        <Home size={22} />
      </Link>
      <Link 
        to="/calendar" 
        className={cn("p-2 transition-colors", isActive('/calendar') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Calendar"
      >
        <Calendar size={22} />
      </Link>
      <Link 
        to="/groups" 
        className={cn("p-2 transition-colors", isActive('/groups') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Circles"
      >
        <Users size={22} />
      </Link>
      <Link 
        to="/rooms" 
        className={cn("p-2 transition-colors", isActive('/rooms') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Secret Planning Rooms"
      >
        <Gift size={22} />
      </Link>
      <Link 
        to="/add" 
        className="p-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full -mt-8 shadow-xl hover:scale-105 transition-transform"
        title="Add"
      >
        <Plus size={24} />
      </Link>
      <Link 
        to="/spark" 
        className={cn("p-2 transition-colors", isActive('/spark') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Spark"
      >
        <Zap size={22} />
      </Link>
      <Link 
        to="/vaults" 
        className={cn("p-2 transition-colors", isActive('/vaults') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Vaults"
      >
        <Shield size={22} />
      </Link>
      <Link 
        to="/analytics" 
        className={cn("p-2 transition-colors", isActive('/analytics') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="Analytics"
      >
        <BarChart3 size={22} />
      </Link>
      <Link 
        to="/coach" 
        className={cn("p-2 transition-colors", isActive('/coach') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
        title="AI Coach"
      >
        <Brain size={22} />
      </Link>
    </nav>
  );
}
