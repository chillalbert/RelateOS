import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Sparkles, X, Check, Calendar, ArrowDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { getDailyActionLabel, getPhaseAwareTaskLabel, getLocalDateString, getCycleTaskPrefix } from '../lib/utils';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function CycleTaskIntroModal() {
  const { user, firebaseUser } = useAuth();
  const { config } = useGamification();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const isCompletedOnboarding = user?.onboarding_completed === true || user?.has_completed_onboarding === true;
  const isTourFinished = user?.tourFinished === true;

  const today = getLocalDateString();
  const initialTaskCompleted = user?.initialTaskCompleted === true;
  const initialTaskCompletedDate = user?.initialTaskCompletedDate;
  const isCycleStarted = initialTaskCompleted && Boolean(initialTaskCompletedDate) && today > (initialTaskCompletedDate as string);

  // Determine current cycleStartDate
  const currentCycleStart = user?.streakProgress?.cycleStartDate || today;
  const introShown = user?.streakProgress?.introShownForCycleStart;

  useEffect(() => {
    if (!firebaseUser || !user || !isCompletedOnboarding || !isTourFinished || !isCycleStarted) {
      setIsOpen(false);
      return;
    }

    // Check if intro has NOT been shown for this cycle's start date
    if (introShown !== currentCycleStart) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [firebaseUser, user, currentCycleStart, introShown, isCompletedOnboarding, isTourFinished, isCycleStarted]);

  const handleDismiss = async () => {
    if (isDismissing || !firebaseUser) return;
    setIsDismissing(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(
        userRef,
        {
          streakProgress: {
            introShownForCycleStart: currentCycleStart,
            cycleStartDate: currentCycleStart
          }
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating introShownForCycleStart:', err);
    } finally {
      setIsDismissing(false);
      setIsOpen(false);
    }
  };

  if (!isOpen || !user || !isCompletedOnboarding || !isTourFinished || !isCycleStarted) return null;

  const taskLabel = getPhaseAwareTaskLabel(user, config?.dailyActionType || 'check_in');
  const taskPrefix = getCycleTaskPrefix(config?.cycleLengthDays);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-full max-w-sm rounded-3xl p-6 bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl relative overflow-hidden space-y-5 flex flex-col items-stretch"
          >
            {/* Background Decorative Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

            {/* Header / Badge */}
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles size={24} />
              </div>
              <button
                onClick={handleDismiss}
                disabled={isDismissing}
                className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Calendar size={12} />
                <span>New Cycle Started</span>
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-white leading-snug">
                {taskPrefix} <span className="text-emerald-400">{taskLabel}</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Completing this task daily advances your streak and earns +10 Aura points.
              </p>
            </div>

            {/* Feature Highlight Box */}
            <div className="p-3.5 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center gap-3 text-xs text-zinc-300 font-medium">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Zap size={18} />
              </div>
              <span>Keep your daily momentum active to earn rewards and unlock bonuses!</span>
            </div>

            {/* Action Button */}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check size={16} className="stroke-[3]" />
              <span>Got it, let's go!</span>
            </button>

            {/* Visual Arrow Pointer connecting popup to streak/calendar card below */}
            <div className="pt-1 flex flex-col items-center justify-center">
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400/90 pointer-events-none"
              >
                <span>Track progress on your daily streak card below</span>
                <ArrowDown size={14} className="text-emerald-400 stroke-[2.5]" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
