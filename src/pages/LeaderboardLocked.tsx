import React from 'react';
import { Lock, Flame, ArrowLeft, Trophy, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';

interface LeaderboardLockedProps {
  title?: string;
  subtitle?: string;
}

export default function LeaderboardLocked({ title = '?????', subtitle = 'Locked Feature' }: LeaderboardLockedProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useGamification();

  const currentCount = user?.streakProgress?.currentCount || 0;
  const cycleLengthDays = config?.cycleLengthDays || 7;
  const progressPercent = Math.min(100, Math.round((currentCount / Math.max(1, cycleLengthDays)) * 100));

  const unlockSequence = config?.unlockSequence || [];
  const userProgressIndex = typeof user?.unlockProgressCount === 'number' ? user.unlockProgressCount : 0;
  
  // Identify what feature the user is currently unlocking next
  const currentNextUnlock = unlockSequence[userProgressIndex] || unlockSequence[0] || { id: 'leaderboard', name: 'Leaderboard & Rankings' };
  const isLeaderboardNext = currentNextUnlock.id === 'leaderboard';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-28 pt-[calc(1.5rem+var(--sat))] px-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{title}</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-amber-500">
            <Lock size={20} />
          </div>
        </header>

        {/* Locked Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-6 shadow-sm">
          {/* Subtle decorative glow effect */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Lock Badge */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-inner">
              <Lock size={36} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-amber-500 text-zinc-950 font-black shadow-md">
              <Trophy size={14} />
            </div>
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              Unlock the next feature by completing your daily cycle!
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
              Keep up your daily task momentum to finish your current cycle and reveal what's behind this tab.
            </p>
          </div>

          {/* Streak requirement & Progress Indicator card */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800/80 space-y-3 text-left max-w-sm mx-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                  <Flame size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Cycle Unlock Progress
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Finish your cycle to unlock the next mystery feature
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-amber-500 shrink-0">
                {currentCount} / {cycleLengthDays} Days
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="h-2.5 w-full bg-zinc-200 dark:bg-zinc-700/80 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>{progressPercent}% completed</span>
                <span>{Math.max(0, cycleLengthDays - currentCount)} days remaining</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Navigation />
    </div>
  );
}

