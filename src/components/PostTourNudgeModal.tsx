import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Sparkles, X, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function PostTourNudgeModal() {
  const { user, firebaseUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const isCompletedOnboarding = user?.onboarding_completed === true || user?.has_completed_onboarding === true;
  const isTourFinished = user?.tourFinished === true;
  const isTourCompletedNaturally = user?.tourCompletedNaturally === true;
  const postTourNudgeShown = user?.postTourNudgeShown === true;
  const initialTaskCompleted = user?.initialTaskCompleted === true;

  useEffect(() => {
    if (
      !firebaseUser ||
      !user ||
      !isCompletedOnboarding ||
      !isTourFinished ||
      !isTourCompletedNaturally ||
      postTourNudgeShown ||
      initialTaskCompleted
    ) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
  }, [
    firebaseUser,
    user,
    isCompletedOnboarding,
    isTourFinished,
    isTourCompletedNaturally,
    postTourNudgeShown,
    initialTaskCompleted
  ]);

  const handleDismiss = async () => {
    if (isDismissing || !firebaseUser) return;
    setIsDismissing(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, { postTourNudgeShown: true }, { merge: true });
    } catch (err) {
      console.error('Error updating postTourNudgeShown:', err);
    } finally {
      setIsDismissing(false);
      setIsOpen(false);
    }
  };

  const handleGoToAddContact = async () => {
    if (isDismissing || !firebaseUser) return;
    setIsDismissing(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, { postTourNudgeShown: true }, { merge: true });
    } catch (err) {
      console.error('Error updating postTourNudgeShown:', err);
    } finally {
      setIsDismissing(false);
      setIsOpen(false);
      window.location.href = '/add';
    }
  };

  if (!isOpen || !user || !isCompletedOnboarding || !isTourFinished || postTourNudgeShown || initialTaskCompleted) {
    return null;
  }

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
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

            {/* Header / Badge */}
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <UserPlus size={24} />
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
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles size={12} />
                <span>First Task</span>
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-white leading-snug">
                Ready for Your First Task?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your first task: add a contact and include their birthday. This unlocks your first hidden tab.
              </p>
            </div>

            {/* Feature Highlight Box */}
            <div className="p-3.5 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center gap-3 text-xs text-zinc-300 font-medium">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Lock size={18} />
              </div>
              <span>Adding a contact with a birthday unlocks your Stats & Relationship Analytics tab!</span>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGoToAddContact}
              disabled={isDismissing}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <UserPlus size={16} className="stroke-[2.5]" />
              <span>Add Contact Now</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
