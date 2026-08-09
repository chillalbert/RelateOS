import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment, onSnapshot, arrayUnion } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { GamificationConfig } from '../types';
import DailyCompletionPopup, { CompletionPopupData } from '../components/DailyCompletionPopup';
import StreakLossModal from '../components/StreakLossModal';
import CycleTaskIntroModal from '../components/CycleTaskIntroModal';
import FeatureUnlockedModal from '../components/FeatureUnlockedModal';
import PostTourNudgeModal from '../components/PostTourNudgeModal';

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

interface GamificationContextType {
  recordDailyAction: (actionType: 'check_in' | 'note_edit' | 'memory_added') => Promise<CompletionPopupData | null>;
  popupData: CompletionPopupData | null;
  clearPopupData: () => void;
  config: GamificationConfig | null;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, user, isLoading } = useAuth();
  const [popupData, setPopupData] = useState<CompletionPopupData | null>(null);
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [showStreakLossModal, setShowStreakLossModal] = useState(false);
  const [lostStreakCount, setLostStreakCount] = useState<number>(0);

  // Proactive streak-loss detection on app load / session start
  useEffect(() => {
    if (isLoading || !firebaseUser || !user) return;

    const checkStreakLoss = async () => {
      const streakProgress = user.streakProgress;
      if (!streakProgress) return;

      const lastCompletedDate = streakProgress.lastCompletedDate;
      const currentCount = streakProgress.currentCount || 0;
      const today = getLocalDateString();
      const yesterday = getLocalYesterdayString();

      // Detect genuine missed day: lastCompletedDate exists, is not today, is not yesterday,
      // active streak was > 0, and streak freeze was not available/applicable.
      if (
        lastCompletedDate &&
        lastCompletedDate !== today &&
        lastCompletedDate !== yesterday &&
        currentCount > 0 &&
        (!user.streakFreezeAvailable || user.streakFreezeAvailable <= 0)
      ) {
        const ackKey = `streak_loss_shown_${firebaseUser.uid}_${lastCompletedDate}`;
        if (localStorage.getItem(ackKey)) return;

        localStorage.setItem(ackKey, 'true');

        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          await updateDoc(userRef, {
            'streakProgress.currentCount': 0,
            'streakProgress.cycleStartDate': today,
            'streakProgress.lastCompletedDate': null,
            streak: 0
          });

          setLostStreakCount(currentCount);
          setShowStreakLossModal(true);
        } catch (err) {
          console.error('Error handling proactive streak loss:', err);
        }
      }
    };

    checkStreakLoss();
  }, [
    isLoading,
    firebaseUser?.uid,
    user?.streakProgress?.lastCompletedDate,
    user?.streakProgress?.currentCount,
    user?.streakFreezeAvailable
  ]);

  useEffect(() => {
    if (isLoading || !firebaseUser) return;

    const configRef = doc(db, 'config', 'gamification');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const rawConfig = snap.data() as Partial<GamificationConfig>;
        setConfig({
          dailyActionType: rawConfig.dailyActionType || 'check_in',
          cycleLengthDays: typeof rawConfig.cycleLengthDays === 'number' ? rawConfig.cycleLengthDays : 7,
          auraPerDay: typeof rawConfig.auraPerDay === 'number' ? rawConfig.auraPerDay : 10,
          unlockSequence: rawConfig.unlockSequence || [],
          currentUnlockIndex: typeof rawConfig.currentUnlockIndex === 'number' ? rawConfig.currentUnlockIndex : 0
        });
      } else {
        setConfig({
          dailyActionType: 'check_in',
          cycleLengthDays: 7,
          auraPerDay: 10,
          unlockSequence: [],
          currentUnlockIndex: 0
        });
      }
    }, (err) => {
      console.warn('Error fetching gamification config:', err);
    });
    return () => unsub();
  }, [isLoading, firebaseUser]);

  const clearPopupData = () => {
    setPopupData(null);
  };

  useEffect(() => {
    const processUnlock = async () => {
      if (!firebaseUser?.uid || !user?.pendingUnlockReady || !config) return;

      try {
        const unlockSeq = config.unlockSequence || [];
        const userProgress = typeof user.unlockProgressCount === 'number' ? user.unlockProgressCount : 0;
        const currentUnlock = unlockSeq[userProgress] || unlockSeq[0] || { id: 'leaderboard' };
        const featureToUnlock = currentUnlock.id || 'leaderboard';

        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, {
          unlockedFeatures: arrayUnion(featureToUnlock),
          unlockProgressCount: increment(1),
          pendingUnlockReady: false
        });
      } catch (err) {
        console.error('Error processing feature unlock:', err);
      }
    };

    processUnlock();
  }, [firebaseUser?.uid, user?.pendingUnlockReady, user?.unlockProgressCount, config]);

  const recordDailyAction = async (
    actionType: 'check_in' | 'note_edit' | 'memory_added'
  ): Promise<CompletionPopupData | null> => {
    if (!firebaseUser?.uid) return null;

    try {
      // 1. Live read config/gamification document from Firestore
      const configRef = doc(db, 'config', 'gamification');
      const configSnap = await getDoc(configRef);

      let config: GamificationConfig = {
        dailyActionType: 'check_in',
        cycleLengthDays: 7,
        auraPerDay: 10,
        unlockSequence: [],
        currentUnlockIndex: 0
      };

      if (configSnap.exists()) {
        const rawConfig = configSnap.data() as Partial<GamificationConfig>;
        config = {
          dailyActionType: rawConfig.dailyActionType || 'check_in',
          cycleLengthDays: typeof rawConfig.cycleLengthDays === 'number' ? rawConfig.cycleLengthDays : 7,
          auraPerDay: typeof rawConfig.auraPerDay === 'number' ? rawConfig.auraPerDay : 10,
          unlockSequence: rawConfig.unlockSequence || [],
          currentUnlockIndex: typeof rawConfig.currentUnlockIndex === 'number' ? rawConfig.currentUnlockIndex : 0
        };
      }

      // 2. Check if the triggered action matches config.dailyActionType
      if (actionType !== config.dailyActionType) {
        return null;
      }

      // 3. Fetch latest user document to verify streakProgress
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return null;

      const userData = userSnap.data();
      const today = getLocalDateString();
      const yesterday = getLocalYesterdayString();

      // Check initial task completion requirements
      const initialTaskCompleted = userData.initialTaskCompleted === true;
      const initialTaskCompletedDate = userData.initialTaskCompletedDate;

      if (!initialTaskCompleted) {
        return null;
      }

      if (!initialTaskCompletedDate || today <= initialTaskCompletedDate) {
        return null;
      }

      const streakProgress = userData.streakProgress || {
        currentCount: 0,
        lastCompletedDate: null,
        cycleStartDate: null
      };

      // 4. Check if today's date was already completed
      if (streakProgress.lastCompletedDate === today) {
        // Today's action was already recorded
        return null;
      }

      const previousCount = streakProgress.currentCount || 0;
      const hadActiveStreak = previousCount > 0;

      // 5. This is today's first completion
      let newCount = 1;
      let cycleStartDate = streakProgress.cycleStartDate || today;
      let usedStreakFreeze = false;
      let isMissedDayReset = false;

      if (streakProgress.lastCompletedDate === yesterday || !streakProgress.lastCompletedDate) {
        // Consecutive day or first completion ever
        newCount = streakProgress.lastCompletedDate ? (streakProgress.currentCount || 0) + 1 : 1;
      } else if (userData.streakFreezeAvailable && userData.streakFreezeAvailable > 0) {
        // Missed day, but Streak Freeze is available!
        usedStreakFreeze = true;
        newCount = (streakProgress.currentCount || 0) + 1;
        cycleStartDate = streakProgress.cycleStartDate || today;
      } else {
        // Missed a day and no Streak Freeze available
        newCount = 1;
        cycleStartDate = today;
        isMissedDayReset = true;
      }

      const auraEarned = config.auraPerDay || 10;
      const isCycleComplete = newCount >= config.cycleLengthDays;

      // 6. Write updates to users/{userId}
      const updatePayload: Record<string, any> = {
        'streakProgress.currentCount': newCount,
        'streakProgress.lastCompletedDate': today,
        'streakProgress.cycleStartDate': cycleStartDate,
        auraBalance: increment(auraEarned)
      };

      if (usedStreakFreeze) {
        updatePayload.streakFreezeAvailable = increment(-1);
      }

      if (isCycleComplete) {
        updatePayload.pendingUnlockReady = true;
      }

      await updateDoc(userRef, updatePayload);

      // 7. Trigger Popup
      const resultData: CompletionPopupData = {
        streakCount: newCount,
        auraEarned,
        cycleLengthDays: config.cycleLengthDays,
        isCycleComplete,
        cycleStartDate,
        lastCompletedDate: today,
        usedStreakFreeze,
        dailyActionType: config.dailyActionType
      };

      if (isMissedDayReset && hadActiveStreak) {
        setLostStreakCount(previousCount);
        setShowStreakLossModal(true);
      } else {
        setPopupData(resultData);
      }
      return resultData;
    } catch (err) {
      console.error('Error recording daily action:', err);
      return null;
    }
  };

  return (
    <GamificationContext.Provider value={{ recordDailyAction, popupData, clearPopupData, config }}>
      {children}
      <DailyCompletionPopup data={popupData} onClose={clearPopupData} />
      <StreakLossModal
        isOpen={showStreakLossModal}
        lostStreakCount={lostStreakCount}
        onClose={() => setShowStreakLossModal(false)}
      />
      <CycleTaskIntroModal />
      <FeatureUnlockedModal />
      <PostTourNudgeModal />
    </GamificationContext.Provider>
  );
};

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};
