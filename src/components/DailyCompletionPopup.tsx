import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Sparkles, Trophy, CheckCircle2, X, Calendar, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import StreakCalendarView from './StreakCalendarView';

export interface CompletionPopupData {
  streakCount: number;
  auraEarned: number;
  cycleLengthDays: number;
  isCycleComplete: boolean;
  cycleStartDate?: string | null;
  lastCompletedDate?: string | null;
  usedStreakFreeze?: boolean;
  dailyActionType?: string;
}

interface DailyCompletionPopupProps {
  data: CompletionPopupData | null;
  onClose: () => void;
}

export default function DailyCompletionPopup({ data, onClose }: DailyCompletionPopupProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (data && !showCalendar) {
      const timer = setTimeout(() => {
        onClose();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [data, showCalendar, onClose]);

  if (!data) return null;

  const { streakCount, auraEarned, cycleLengthDays, isCycleComplete, cycleStartDate, lastCompletedDate } = data;
  const progressPercent = Math.min(100, Math.round((streakCount / Math.max(1, cycleLengthDays)) * 100));

  const streakProgress = {
    currentCount: streakCount,
    lastCompletedDate: lastCompletedDate || null,
    cycleStartDate: cycleStartDate || null
  };

  return (
    <AnimatePresence>
      {data && (
        <div className="fixed inset-x-0 bottom-16 z-[120] flex justify-center px-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`pointer-events-auto w-full max-w-sm rounded-3xl p-5 shadow-2xl border backdrop-blur-xl relative overflow-hidden ${
              isCycleComplete
                ? 'bg-gradient-to-b from-zinc-900 to-amber-950/90 border-amber-500/40 text-amber-50'
                : 'bg-zinc-900/95 border-zinc-800 text-zinc-100'
            }`}
          >
            {/* Background Decorative Glow */}
            <div
              className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none ${
                isCycleComplete ? 'bg-amber-500/30' : 'bg-emerald-500/20'
              }`}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={16} />
            </button>

            {/* Header Content */}
            <div className="flex items-start gap-3.5 pr-6">
              <div
                className={`p-3 rounded-2xl flex-shrink-0 flex items-center justify-center ${
                  isCycleComplete
                    ? 'bg-amber-500 text-zinc-950 ring-4 ring-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {isCycleComplete ? <Trophy size={24} /> : <Zap size={24} />}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full font-bold bg-white/10 text-zinc-300">
                    Daily Goal Completed
                  </span>
                  {isCycleComplete && (
                    <Sparkles size={14} className="text-amber-400 animate-pulse" />
                  )}
                </div>
                <h3 className="font-bold text-base tracking-tight leading-snug">
                  {isCycleComplete ? 'Cycle Complete!' : `Day ${streakCount} Streak!`}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {isCycleComplete
                    ? `You reached ${streakCount} consecutive days. Unlocking soon...`
                    : `Keep up your momentum to unlock rewards.`}
                </p>
              </div>
            </div>

            {/* Streak Freeze Used Banner */}
            {data.usedStreakFreeze && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-sky-400" />
                <span>Streak Freeze used — your streak is safe!</span>
              </div>
            )}

            {/* Stats Badges */}
            <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Day {streakCount}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap size={14} />
                <span>+{auraEarned} Aura</span>
              </div>

              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center gap-1 text-xs font-mono text-zinc-300 hover:text-white font-bold px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-all cursor-pointer"
              >
                <Calendar size={13} className="text-emerald-400" />
                <span>Cycle</span>
                {showCalendar ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 space-y-1">
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    isCycleComplete ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
              </div>
            </div>

            {/* Cycle Progress Calendar Section */}
            <AnimatePresence>
              {showCalendar && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 pt-3.5 border-t border-white/10 overflow-hidden"
                >
                  <StreakCalendarView
                    streakProgress={streakProgress}
                    cycleLengthDays={cycleLengthDays}
                    compact={true}
                    showTitle={true}
                    dailyActionType={data.dailyActionType}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
