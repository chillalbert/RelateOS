import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Shield, Moon, LogOut, ChevronRight, Sparkles, X, Check, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const { user, token, logout, login } = useAuth();
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

  const handleAppearanceToggle = async () => {
    const nextAppearance = appearance === 'light' ? 'dark' : 'light';
    try {
      const res = await fetch('/api/user/appearance', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appearance: nextAppearance })
      });
      if (res.ok) {
        setAppearance(nextAppearance);
        if (user) login(token!, { ...user, appearance: nextAppearance });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifToggle = async (key: keyof typeof notifSettings) => {
    const nextSettings = { ...notifSettings, [key]: !notifSettings[key] };
    try {
      const res = await fetch('/api/user/notification-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notification_settings: nextSettings })
      });
      if (res.ok) {
        setNotifSettings(nextSettings);
        if (user) login(token!, { ...user, notification_settings: nextSettings });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(false);
          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        }, 2000);
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError('An error occurred');
    }
  };

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: <User size={20} />, label: 'Profile Information', value: user?.name, onClick: () => {} },
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
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">New Password</label>
                    <input
                      type="password"
                      required
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={passwordData.confirmPassword}
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
