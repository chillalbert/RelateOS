import React from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Shield, Lock, ChevronRight, Gift, Clock, Calendar } from 'lucide-react';
import Navigation from '../components/Navigation';
import { cn } from '../lib/utils';

export default function Vaults() {
  const { firebaseUser, user } = useAuth();
  const [vaults, setVaults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchVaults = async () => {
    if (!firebaseUser || !user?.email) {
      setLoading(false);
      return;
    }

    try {
      const groupsRef = collection(db, 'rooms');
      const qVaults = query(
        groupsRef,
        where('recipient_email', '==', user.email.toLowerCase())
      );
      
      const snapshot = await getDocs(qVaults);
      const vaultsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Sort by birthday
      setVaults(vaultsData.sort((a, b) => {
        const dateA = new Date(a.person_birthday || '');
        const dateB = new Date(b.person_birthday || '');
        return dateA.getTime() - dateB.getTime();
      }));
    } catch (err) {
      console.error("Error fetching vaults:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchVaults();
  }, [firebaseUser, user?.email]);

  const isUnlocked = (birthday: string) => {
    if (!birthday) return false;
    const today = new Date();
    const bday = new Date(birthday);
    
    // Check if today matches MM-DD
    return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
  };

  const getStatus = (birthday: string) => {
    if (!birthday) return 'Unknown';
    if (isUnlocked(birthday)) return 'Unlocked';
    
    const today = new Date();
    const bday = new Date(birthday);
    bday.setFullYear(today.getFullYear());
    
    if (bday < today) {
      bday.setFullYear(today.getFullYear() + 1);
    }
    
    const diff = bday.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    return `Unlocks in ${days} days`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
      <header className="p-8 pt-[calc(2rem+var(--sat))] bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20">
              <Shield size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">My Vaults</h1>
          </div>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Secret vaults created for you by your friends. They remain locked until your birthday to keep the surprises secret!
          </p>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vaults.length > 0 ? (
          <div className="grid gap-6">
            {vaults.map((vault, i) => {
              const unlocked = isUnlocked(vault.person_birthday);
              const status = getStatus(vault.person_birthday);

              return (
                <motion.div
                  key={vault.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {unlocked ? (
                    <Link 
                      to={`/groups/${vault.id}`}
                      className="block p-8 bg-zinc-900 text-white rounded-[40px] border border-zinc-800 shadow-2xl relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Shield size={120} />
                      </div>
                      <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40">
                            <Shield size={24} />
                          </div>
                          <div className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                            Ready to Open
                          </div>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-tight">Happy Birthday!</h3>
                          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-1">Your secret vault is officially unlocked</p>
                        </div>
                        <div className="pt-4 flex items-center gap-2 text-emerald-500 font-bold text-sm">
                          Open Vault <ChevronRight size={16} />
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="p-8 bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5 text-zinc-900 dark:text-white">
                        <Lock size={120} />
                      </div>
                      <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center">
                            <Lock size={24} />
                          </div>
                          <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full text-[10px] font-bold uppercase tracking-widest">
                            Locked
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Secret Vault</h3>
                          <p className="text-zinc-500 text-sm font-medium">From your friends & family</p>
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                            <Clock size={16} className="text-amber-500" />
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">{status}</span>
                          </div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                            <Calendar size={16} className="text-emerald-500" />
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                              {new Date(vault.person_birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="pt-4">
                          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: '40%' }}
                              className="h-full bg-emerald-500"
                            />
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-3 text-center">
                            Collecting surprises...
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 space-y-6">
            <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-[2.5rem] flex items-center justify-center mx-auto text-zinc-300">
              <Shield size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black">No vaults yet</h3>
              <p className="text-zinc-500 text-sm max-w-[280px] mx-auto leading-relaxed">
                When your friends create a secret birthday room for you, the vault will appear here!
              </p>
            </div>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
