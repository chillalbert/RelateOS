import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Unlock, ArrowRight, X, BarChart3, Trophy, Lock, Archive, Bot } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { db } from '../lib/firebase';

const FEATURE_DEFAULTS: Record<string, { name: string; description: string; route: string; IconComponent: React.ComponentType<{ size?: number; className?: string }> }> = {
  analytics: {
    name: "Relationship Analytics & Stats",
    description: "You've unlocked Relationship Analytics! Visualize connection depth, response frequency, and interaction trends with interactive charts.",
    route: "/analytics",
    IconComponent: BarChart3
  },
  deep_analytics: {
    name: "Relationship Analytics & Stats",
    description: "You've unlocked Relationship Analytics! Visualize connection depth, response frequency, and interaction trends with interactive charts.",
    route: "/analytics",
    IconComponent: BarChart3
  },
  leaderboard: {
    name: "Leaderboard & Consistency Rankings",
    description: "Track your consistency stats, earn ranks, and compare milestone streaks across your circles.",
    route: "/leaderboard",
    IconComponent: Trophy
  },
  rooms: {
    name: "Secret Planning Rooms",
    description: "Collaborate with friends to organize surprise events and brainstorm gift ideas in shared vaults.",
    route: "/rooms",
    IconComponent: Lock
  },
  party: {
    name: "Secret Planning Rooms",
    description: "Collaborate with friends to organize surprise events and brainstorm gift ideas in shared vaults.",
    route: "/rooms",
    IconComponent: Lock
  },
  vaults: {
    name: "Memory Vaults",
    description: "Preserve cherished milestones, photos, and shared memories safely within digital vaults.",
    route: "/vaults",
    IconComponent: Archive
  },
  memory_vaults: {
    name: "Memory Vaults",
    description: "Preserve cherished milestones, photos, and shared memories safely within digital vaults.",
    route: "/vaults",
    IconComponent: Archive
  },
  coach: {
    name: "AI Relationship Coach",
    description: "Receive tailored gift suggestions and personalized communication guidance from your AI mentor.",
    route: "/coach",
    IconComponent: Bot
  },
  ai_coach: {
    name: "AI Relationship Coach",
    description: "Receive tailored gift suggestions and personalized communication guidance from your AI mentor.",
    route: "/coach",
    IconComponent: Bot
  }
};

const ROUTE_MAP: Record<string, string> = {
  analytics: '/analytics',
  deep_analytics: '/analytics',
  leaderboard: '/leaderboard',
  rooms: '/rooms',
  party: '/rooms',
  vaults: '/vaults',
  memory_vaults: '/vaults',
  coach: '/coach',
  ai_coach: '/coach',
};

export default function FeatureUnlockedModal() {
  const { user, firebaseUser } = useAuth();
  const { config } = useGamification();
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  const isCompletedOnboarding = user?.onboarding_completed === true || user?.has_completed_onboarding === true;
  const isTourFinished = user?.tourFinished === true || user?.hasSeenTour === true;

  const unlockedFeatures = user?.unlockedFeatures || [];
  const explainersShown = user?.unlockExplainersShown || [];

  // Find the first feature in unlockedFeatures that hasn't had an explainer shown yet
  const pendingFeatureId = unlockedFeatures.find(id => !explainersShown.includes(id));

  useEffect(() => {
    if (!firebaseUser || !user || !isCompletedOnboarding || !isTourFinished) {
      setActiveFeatureId(null);
      return;
    }

    if (pendingFeatureId) {
      setActiveFeatureId(pendingFeatureId);
    } else {
      setActiveFeatureId(null);
    }
  }, [firebaseUser, user, isCompletedOnboarding, isTourFinished, pendingFeatureId]);

  if (!activeFeatureId || !firebaseUser || !user || !isCompletedOnboarding || !isTourFinished) {
    return null;
  }

  // Find feature metadata from config.unlockSequence or fallback
  let featureName = '';
  let featureDescription = '';
  let featureRoute = ROUTE_MAP[activeFeatureId] || '/';
  let IconComponent = FEATURE_DEFAULTS[activeFeatureId]?.IconComponent || Unlock;

  const matchedConfig = config?.unlockSequence?.find(
    item => item.id === activeFeatureId || (item.name && item.name.toLowerCase().includes(activeFeatureId.toLowerCase()))
  );

  if (matchedConfig) {
    featureName = matchedConfig.name || FEATURE_DEFAULTS[activeFeatureId]?.name || activeFeatureId;
    featureDescription = matchedConfig.description || FEATURE_DEFAULTS[activeFeatureId]?.description || 'A new feature has been unlocked for your workspace.';
  } else {
    const fallback = FEATURE_DEFAULTS[activeFeatureId];
    featureName = fallback?.name || 'New Feature Unlocked';
    featureDescription = fallback?.description || 'A new tab has been unlocked for your workspace. Check it out now!';
  }

  const handleDismiss = async (navigateToRoute?: string) => {
    if (isDismissing || !firebaseUser || !activeFeatureId) return;
    setIsDismissing(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, {
        unlockExplainersShown: arrayUnion(activeFeatureId)
      });
    } catch (err) {
      console.error('Error recording unlockExplainerShown:', err);
    } finally {
      setIsDismissing(false);
      setActiveFeatureId(null);
      if (navigateToRoute) {
        window.location.href = navigateToRoute;
      }
    }
  };

  return (
    <AnimatePresence>
      {activeFeatureId && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                <IconComponent size={24} />
              </div>
              <button
                onClick={() => handleDismiss()}
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
                <Sparkles size={12} />
                <span>Tab Unlocked</span>
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-white leading-snug">
                {featureName}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {featureDescription}
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleDismiss(featureRoute)}
              disabled={isDismissing}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Go check it out now</span>
              <ArrowRight size={16} className="stroke-[2.5]" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
