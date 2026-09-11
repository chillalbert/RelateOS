import React from 'react';
import { Lock, Flame, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';

interface FeatureLockedProps {
  title?: string;
  subtitle?: string;
}

export default function FeatureLocked({ title = '?????', subtitle = 'Locked Feature' }: FeatureLockedProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useGamification();

  const currentCount = user?.streakProgress?.currentCount || 0;
  const cycleLengthDays = config?.cycleLengthDays || 7;
  const progressPercent = Math.min(100, Math.round((currentCount / Math.max(1, cycleLengthDays)) * 100));

  const unlockSequence = config?.unlockSequence || [];
  const userProgressIndex = typeof user?.unlockProgressCount === 'number' ? user.unlockProgressCount : 0;
  
  // Identify what feature the user is currently unlocking next (guarded against out-of-bounds)
  const currentNextUnlock = userProgressIndex < unlockSequence.length ? unlockSequence[userProgressIndex] : undefined;

  return (
    <div className="min-h-screen bg-[#FDF3EC] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-28 pt-[calc(1.5rem+var(--sat))] px-4 font-sans">
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
              <Sparkles size={14} />
            </div>
          </div>

          <div className="space-y-3 max-w-sm mx-auto">
            {currentNextUnlock ? (
              <>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  Unlock the next feature by completing your daily cycle!
                </h2>
                {currentNextUnlock.description && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 text-left space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles size={12} /> Next Unlock Teaser
                    </span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-200 font-medium leading-relaxed italic">
                      "{currentNextUnlock.description}"
                    </p>
                  </div>
                )}
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  Keep up your daily task momentum to finish your current cycle and reveal what's behind this tab.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  You've unlocked everything!
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  You've unlocked all features in the current unlock sequence. Keep maintaining your daily cycles to build your streak and earn Aura!
                </p>
              </>
            )}
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
                    {currentNextUnlock
                      ? "Finish your cycle to unlock the next mystery feature"
                      : "All sequence features unlocked! Keep your streak alive"}
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

