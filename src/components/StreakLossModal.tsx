import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

interface StreakLossModalProps {
  isOpen: boolean;
  lostStreakCount: number;
  onClose: () => void;
}

export default function StreakLossModal({ isOpen, lostStreakCount, onClose }: StreakLossModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border bg-zinc-900/95 border-zinc-800 text-zinc-100 relative overflow-hidden"
          >
            {/* Background Accent Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={16} />
            </button>

            {/* Icon Header */}
            <div className="flex items-start gap-3.5 pr-6">
              <div className="p-3 rounded-2xl flex-shrink-0 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle size={24} />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full font-bold bg-white/10 text-zinc-300">
                  Streak Reset
                </span>
                <h3 className="font-bold text-base tracking-tight leading-snug">
                  Streak Missed
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {lostStreakCount > 0
                    ? `Your ${lostStreakCount}-day check-in streak ended because a day was missed.`
                    : 'A daily check-in was missed.'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 leading-relaxed flex items-center gap-2.5">
              <RotateCcw size={16} className="text-zinc-400 shrink-0" />
              <span>A new cycle has started today. Log your daily task to begin building your momentum again.</span>
            </div>

            {/* Action button */}
            <div className="mt-5">
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-zinc-100 hover:bg-white text-zinc-900 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
