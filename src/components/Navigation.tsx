import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Plus, 
  BarChart3, 
  Settings,
  MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navigation() {
  const location = useLocation();
  const path = location.pathname;

  const isActive = (p: string) => {
    if (p === '/' && path === '/') return true;
    if (p !== '/' && path.startsWith(p)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-6 left-4 right-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-full p-2 flex justify-around items-center shadow-2xl z-50 max-w-2xl mx-auto">
      <Link 
        to="/" 
        className={cn("p-3 transition-colors", isActive('/') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
      >
        <Calendar size={24} />
      </Link>
      <Link 
        to="/people" 
        className={cn("p-3 transition-colors", isActive('/people') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
      >
        <Users size={24} />
      </Link>
      <Link 
        to="/add" 
        className="p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full -mt-12 shadow-xl hover:scale-105 transition-transform"
      >
        <Plus size={28} />
      </Link>
      <Link 
        to="/groups" 
        className={cn("p-3 transition-colors", isActive('/groups') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
      >
        <MessageSquare size={24} />
      </Link>
      <Link 
        to="/analytics" 
        className={cn("p-3 transition-colors", isActive('/analytics') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
      >
        <BarChart3 size={24} />
      </Link>
      <Link 
        to="/settings" 
        className={cn("p-3 transition-colors", isActive('/settings') ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white")}
      >
        <Settings size={24} />
      </Link>
    </nav>
  );
}
