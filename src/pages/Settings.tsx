import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Moon, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settings() {
  const { user, token, logout, login } = useAuth();
  const navigate = useNavigate();
  const [personality, setPersonality] = React.useState(user?.personality || 'Chill');

  const handlePersonalityChange = async () => {
    const personalities = ['Chill', 'Professional', 'Heartfelt', 'Funny'];
    const currentIndex = personalities.indexOf(personality);
    const nextIndex = (currentIndex + 1) % personalities.length;
    const nextPersonality = personalities[nextIndex];
    
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ personality: nextPersonality })
      });
      if (res.ok) {
        setPersonality(nextPersonality);
        if (user) login(token!, { ...user, personality: nextPersonality });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: <User size={20} />, label: 'Profile Information', value: user?.name, onClick: () => {} },
        { icon: <Shield size={20} />, label: 'Security & Password', value: '••••••••', onClick: () => {} },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: <Bell size={20} />, label: 'Notification Settings', value: 'Push & Email', onClick: () => {} },
        { icon: <Sparkles size={20} />, label: 'AI Personality', value: personality, onClick: handlePersonalityChange },
        { icon: <Moon size={20} />, label: 'Appearance', value: 'System', onClick: () => {} },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Profile Card */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl font-bold">
            {user?.name?.[0]}
          </div>
          <div>
            <h2 className="font-bold text-lg">{user?.name}</h2>
            <p className="text-sm text-zinc-500">{user?.email}</p>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{section.title}</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              {section.items.map((item, i) => (
                <button 
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                    i !== section.items.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''
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
          className="w-full flex items-center justify-center gap-2 p-5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-3xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
        >
          <LogOut size={20} />
          Sign Out
        </button>

        <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest">RelateOS v1.0.4</p>
      </div>
    </div>
  );
}
