import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  Users, 
  Clock, 
  Play, 
  HelpCircle, 
  Trophy, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import Navigation from '../components/Navigation';

// Dynamically compute the active game state of a group
export function computeGameState(triggerTime: string) {
  if (!triggerTime) return { phase: 'Waiting for trigger', text: 'Waiting for trigger', minutesLeft: 0 };

  const now = new Date();
  const [hours, minutes] = triggerTime.split(':').map(Number);
  
  const triggerDate = new Date();
  triggerDate.setHours(hours, minutes, 0, 0);

  const diffMs = now.getTime() - triggerDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 0) {
    // Before trigger time today
    const tomorrow = new Date(triggerDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const msUntil = triggerDate.getTime() - now.getTime();
    const minsUntil = Math.floor(msUntil / 60000);
    return { 
      phase: 'Waiting for trigger', 
      text: 'Triggering Today', 
      minutesLeft: minsUntil 
    };
  } else if (diffMins >= 0 && diffMins < 60) {
    // Answering phase: 1 hour from trigger
    return { 
      phase: 'Answering now', 
      text: 'Phase 1: Answering Room', 
      minutesLeft: 60 - diffMins 
    };
  } else if (diffMins >= 60 && diffMins < 75) {
    // Reveal phase: 15 mins following Answering
    return { 
      phase: 'Reveal in progress', 
      text: 'Phase 2: Reveal & Sync', 
      minutesLeft: 75 - diffMins 
    };
  } else if (diffMins >= 75 && diffMins < 105) {
    // Guessing phase: 30 mins
    return { 
      phase: 'Guessing phase', 
      text: 'Phase 3: Guessing Clues', 
      minutesLeft: 105 - diffMins 
    };
  } else {
    // Complete
    return { 
      phase: 'Complete', 
      text: 'Game Complete', 
      minutesLeft: 0 
    };
  }
}

export default function SparkHome() {
  const { firebaseUser } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;

    const q = query(
      collection(db, 'spark_groups'),
      where('members', 'array-contains', firebaseUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const list: any[] = [];
      for (const d of snap.docs) {
        const groupData = d.data();
        const stateInfo = computeGameState(groupData.trigger_time);
        
        list.push({
          id: d.id,
          ...groupData,
          stateInfo
        });
      }
      setGroups(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading games:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  return (
    <div id="spark-home-page" className="pb-36 pt-[calc(1.5rem+var(--sat))] px-4 bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Zap className="text-emerald-500 fill-emerald-500 animate-pulse animate-duration-1000" size={28} />
              <span>Spark Says Game Room</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">The daily anonymous social deduction guess engine</p>
          </div>
        </header>

        {/* Dynamic Instructional Banner */}
        <div className="p-6 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-3xl border border-emerald-500/20 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <HelpCircle size={20} />
            <h3 className="font-extrabold text-base">How to play Spark Says ⚡</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-zinc-650 dark:text-zinc-300 leading-relaxed">
            <div className="space-y-1 p-2 bg-white/50 dark:bg-zinc-900/30 rounded-xl">
              <span className="font-extrabold text-emerald-500">1. Answering</span>
              <p>When the hub trigger time hits, you get 3 custom AI questions. Answer completely anonymously.</p>
            </div>
            <div className="space-y-1 p-2 bg-white/50 dark:bg-zinc-900/30 rounded-xl">
              <span className="font-extrabold text-emerald-500">2. Match Up</span>
              <p>The answers are revealed without names. Read them closely and try to deduce the secrets!</p>
            </div>
            <div className="space-y-1 p-2 bg-white/50 dark:bg-zinc-900/30 rounded-xl">
              <span className="font-extrabold text-emerald-500">3. Deduce/Win</span>
              <p>Try to guess who wrote each answer or identify the daily Subject to win valuable Aura points!</p>
            </div>
          </div>
        </div>

        {/* Active games selection list */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-extrabold text-lg flex items-center gap-2">
              <Zap size={18} className="text-emerald-500" />
              <span>Active Game Hubs ({groups.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : groups.length > 0 ? (
            <div id="spark-groups-grid" className="grid grid-cols-1 gap-4">
              {groups.map((group, index) => {
                const phase = group.stateInfo.phase;
                let phaseBadgeBg = '';
                let phaseBadgeText = '';

                switch (phase) {
                  case 'Waiting for trigger':
                    phaseBadgeBg = 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
                    phaseBadgeText = 'Waiting for trigger';
                    break;
                  case 'Answering now':
                    phaseBadgeBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                    phaseBadgeText = 'Answering hour 🤐';
                    break;
                  case 'Reveal in progress':
                    phaseBadgeBg = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';
                    phaseBadgeText = 'Revealed clues 👀';
                    break;
                  case 'Guessing phase':
                    phaseBadgeBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
                    phaseBadgeText = 'Deduction active ⚡';
                    break;
                  default:
                    phaseBadgeBg = 'bg-zinc-250 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-450';
                    phaseBadgeText = 'Complete';
                }

                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative"
                  >
                    <Link
                      to={`/spark/${group.id}`}
                      className="block p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group/card"
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-lg group-hover/card:text-emerald-500 transition-colors">
                            {group.name}
                          </h4>
                          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
                            <Clock size={13} />
                            <span>Daily schedule: {group.trigger_time}</span>
                          </span>
                        </div>
                        <div>
                          <span className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${phaseBadgeBg}`}>
                            {phaseBadgeText}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            {group.members?.slice(0, 3).map((m: string, i: number) => (
                              <div key={i} className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900" />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-zinc-400">{group.members?.length || 1} playing</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-emerald-500 font-extrabold text-sm">
                          <span>Enter Hub</span>
                          <Play size={14} className="fill-emerald-500" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                <Zap size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-md">No Game Hubs Active</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  You must join or create a Circle Hub inside the **Groups** directory to unlock daily Spark Says game logs.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  to="/groups"
                  className="px-6 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-extrabold rounded-2xl shadow-sm text-xs hover:scale-105 transition-all inline-block"
                >
                  Go to Circles Hub
                </Link>
              </div>
            </div>
          )}
        </section>

      </div>

      <Navigation />
    </div>
  );
}
