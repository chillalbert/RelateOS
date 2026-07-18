import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../lib/utils';
import { db } from '../lib/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  getDocs, 
  setDoc, 
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  addDoc,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  ArrowLeft, 
  Clock, 
  Send, 
  CheckCircle, 
  Users, 
  Trophy, 
  Sparkles, 
  ShieldAlert, 
  Eye, 
  MessageSquare, 
  Flame,
  HelpCircle,
  TrendingUp,
  Coins
} from 'lucide-react';
import { callCoachModel } from '../services/geminiService';
import { computeGameState } from './SparkHome';
import confetti from 'canvas-confetti';

export default function SparkGameRoom() {
  const { groupId } = useParams<{ groupId: string }>();
  const { firebaseUser, user } = useAuth();

  const [group, setGroup] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameConfig, setGameConfig] = useState<any | null>(null);
  const [todayRound, setTodayRound] = useState<any | null>(null);
  const [userAnswers, setUserAnswers] = useState<any | null>(null);
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [allGuesses, setAllGuesses] = useState<any[]>([]);
  const [membersProfiles, setMembersProfiles] = useState<Record<string, any>>({});
  const [userAura, setUserAura] = useState<any>(null);

  // Answering state
  const [easyAnswer, setEasyAnswer] = useState('');
  const [mediumAnswer, setMediumAnswer] = useState('');
  const [deepAnswer, setDeepAnswer] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Guessing state
  const [activeGuessingQuestion, setActiveGuessingQuestion] = useState<'easy' | 'medium' | 'deep'>('easy');
  const [selectedGuessUserId, setSelectedGuessUserId] = useState<string>('');
  const [guessLoading, setGuessLoading] = useState(false);
  const [wrongAnswersCount, setWrongAnswersCount] = useState(0);
  const [tempGuesses, setTempGuesses] = useState<Record<string, string>>({});
  const [guessSubmitLoading, setGuessSubmitLoading] = useState(false);

  // Aura Store State
  const [showAuraStore, setShowAuraStore] = useState(false);
  const [selectedStoreFriendId, setSelectedStoreFriendId] = useState('');
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Rematch pool state properties
  const [rematchContribution, setRematchContribution] = useState<number>(5);
  const [rematchPool, setRematchPool] = useState<any>({ total_contributions: 0, pledges: {} });
  const [rematchLoading, setRematchLoading] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);

  const todayString = new Date().toISOString().split('T')[0];
  const activeRoundId = group?.current_round_id || todayString;

  // Reset local answer states when active round or questions change
  useEffect(() => {
    setEasyAnswer('');
    setMediumAnswer('');
    setDeepAnswer('');
  }, [activeRoundId, todayRound?.id, JSON.stringify(todayRound?.questions)]);

  const isCurrentUserSubject = firebaseUser && todayRound && todayRound.subject_id === firebaseUser.uid;
  const realSubjectName = todayRound?.subject_id ? (membersProfiles[todayRound.subject_id]?.name || '') : '';
  const fakeSubjectName = todayRound?.fake_subject_id ? (membersProfiles[todayRound.fake_subject_id]?.name || '') : '';
  const anonymousAnswsForGuess = allAnswers.filter(a => a.id !== firebaseUser?.uid);

  const displayQuestionText = (text: string) => {
    if (!text) return '';
    if (isCurrentUserSubject && realSubjectName && fakeSubjectName) {
      // Escape special regex characters in name
      const escapedRealName = realSubjectName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedRealName, 'gi');
      return text.replace(regex, fakeSubjectName);
    }
    return text;
  };

  // 1. Listen to Group details & member profiles
  useEffect(() => {
    if (!groupId || !firebaseUser) return;

    const groupRef = doc(db, 'spark_groups', groupId);
    const unsubscribeGroup = onSnapshot(groupRef, async (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const data = snap.data();
      setGroup({ id: snap.id, ...data });

      // Load all group member profiles dynamically
      if (data.members && data.members.length > 0) {
        const profiles: Record<string, any> = {};
        for (const mId of data.members) {
          const uDoc = await getDoc(doc(db, 'users', mId));
          if (uDoc.exists()) {
            profiles[mId] = uDoc.data();
          } else {
            profiles[mId] = { name: 'Player' };
          }
        }
        setMembersProfiles(profiles);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
      setLoading(false);
    });

    return () => {
      unsubscribeGroup();
    };
  }, [groupId, firebaseUser]);

  // Listen to current user's group specific Aura
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;

    const auraRef = doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid);
    const unsubscribeAura = onSnapshot(auraRef, (snap) => {
      if (snap.exists()) {
        setUserAura(snap.data());
      } else {
        setUserAura({ total_aura: 0, spent_aura: 0 });
      }
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribeAura();
  }, [groupId, firebaseUser, group]);

  // 2. Real-time Listen and compute Phase Config ticks
  useEffect(() => {
    if (!group) return;

    const interval = setInterval(() => {
      const state = computeGameState(group.trigger_time);
      setGameConfig(state);
    }, 1000);

    const initial = computeGameState(group.trigger_time);
    setGameConfig(initial);

    return () => clearInterval(interval);
  }, [group]);

  // 3. Keep Round structure dynamically synced for today & load answers/guesses
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid) || !gameConfig) return;

    const roundRef = doc(db, `spark_groups/${groupId}/rounds`, activeRoundId);
    const unsubscribeRound = onSnapshot(roundRef, async (snap) => {
      if (snap.exists()) {
        setTodayRound({ id: snap.id, ...snap.data() });
      } else {
        // Only trigger QA generation if we have hit or passed trigger hour, and we are the first visiting
        if (gameConfig.phase !== 'Waiting for trigger') {
          await triggerDailyQA(roundRef);
        }
      }
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribeRound();
  }, [groupId, firebaseUser, group, gameConfig, activeRoundId]);

  // 4. Load current user's submitted answers & all answers (if unmasked/revealed)
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;

    const answersCol = collection(db, `spark_groups/${groupId}/rounds/${activeRoundId}/answers`);
    const unsubscribeAnswers = onSnapshot(answersCol, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllAnswers(list);

      const mine = snap.docs.find(d => d.id === firebaseUser.uid);
      if (mine && mine.exists()) {
        setUserAnswers(mine.data());
      } else {
        setUserAnswers(null);
      }

      // Check if everyone finishes answering (Dynamic Phase Transition)
      if (list.length > 0 && group?.members && list.length === group.members.length) {
        const roundRef = doc(db, `spark_groups/${groupId}/rounds`, activeRoundId);
        getDoc(roundRef).then((roundSnap) => {
          if (roundSnap.exists()) {
            const rData = roundSnap.data();
            if (rData && rData.phase === 'answering') {
              updateDoc(roundRef, { phase: 'guessing' })
                .then(() => console.log("[SparkEngine] Auto-advanced to guessing phase (everyone answered)"))
                .catch(err => console.error("Error auto-advancing phase:", err));
            }
          }
        }).catch(err => console.error("Error checking round phase for auto-advance:", err));
      }
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    // Load active guesses
    const guessesCol = collection(db, `spark_groups/${groupId}/rounds/${activeRoundId}/guesses`);
    const unsubscribeGuesses = onSnapshot(guessesCol, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllGuesses(list);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => {
      unsubscribeAnswers();
      unsubscribeGuesses();
    };
  }, [groupId, firebaseUser, group, gameConfig, activeRoundId]);

  // Dedicated Rematch Pool listener with strict permission guard
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;

    const rematchPoolRef = doc(db, 'spark_groups', groupId, 'rematch_pool', 'state');
    const unsubscribeRematch = onSnapshot(rematchPoolRef, (snap) => {
      if (snap.exists()) {
        setRematchPool(snap.data());
      } else {
        setRematchPool({ total_contributions: 0, pledges: {} });
      }
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribeRematch();
  }, [groupId, firebaseUser, group]);

  // Purge any stored answers and guesses from previous rounds of the day - disabled to avoid permission errors
  const purgeRoundSubcollections = async () => {
    // Stop trying to delete document entities inside the 'answers' subcollection when a rematch triggers.
    return;
  };

  // Isolated Crowdfunded Rematch Pool pledge handler
  const handleContributeAura = async (amount: number) => {
    if (!groupId || !firebaseUser || !userAura) return;
    if (amount <= 0) {
      setRematchError("Contribution must be greater than 0");
      return;
    }
    const currentTotalAura = userAura.total_total_aura || userAura.total_aura || 0;
    if (amount > currentTotalAura) {
      setRematchError(`You only have ${currentTotalAura} Aura to pledge`);
      return;
    }

    setRematchLoading(true);
    setRematchError(null);

    const poolRef = doc(db, 'spark_groups', groupId, 'rematch_pool', 'state');

    try {
      await runTransaction(db, async (transaction) => {
        const poolSnap = await transaction.get(poolRef);
        let currentPool = { total_contributions: 0, pledges: {} as Record<string, number> };
        if (poolSnap.exists()) {
          const data = poolSnap.data() as any;
          currentPool.total_contributions = data.total_contributions || 0;
          currentPool.pledges = data.pledges || {};
        }

        const remainingNeeded = Math.max(0, 20 - currentPool.total_contributions);
        if (remainingNeeded <= 0) {
          throw new Error("Rematch already fully funded!");
        }

        // Limit pledge to exactly what is needed to reach the 20 Aura cap
        const acceptedAmount = Math.min(amount, remainingNeeded);

        // Get user's own current aura inside the transaction
        const userAuraRef = doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid);
        const userAuraSnap = await transaction.get(userAuraRef);
        let userTotal = 0;
        if (userAuraSnap.exists()) {
          userTotal = userAuraSnap.data()?.total_aura || 0;
        }

        if (userTotal < acceptedAmount) {
          throw new Error(`Your group balance has changed: you only have ${userTotal} Aura.`);
        }

        // Deduct only what is strictly required from the user's wallet
        const updatedTotal = Math.max(0, userTotal - acceptedAmount);
        transaction.set(userAuraRef, { total_aura: updatedTotal }, { merge: true });

        // Add user's contribution
        const prevPledge = currentPool.pledges[firebaseUser.uid] || 0;
        const newPledge = prevPledge + acceptedAmount;
        currentPool.pledges[firebaseUser.uid] = newPledge;
        currentPool.total_contributions += acceptedAmount;

        // If the total_contributions hits or exceeds 20 Aura, trigger the dynamic reset right here!
        if (currentPool.total_contributions >= 20) {
          // b) Reset the pool document metrics back to 0 (no need to deduct from other members now since we deduct on-pledge)
          transaction.set(poolRef, {
            total_contributions: 0,
            pledges: {}
          });

          // c) Update current_round_id pointer field on the parent group document
          const groupRef = doc(db, 'spark_groups', groupId);
          const nextRoundId = `${todayString}_rematch_${Date.now()}`;
          transaction.set(groupRef, { current_round_id: nextRoundId }, { merge: true });

          return { triggerNewRound: true, nextRoundId };
        } else {
          transaction.set(poolRef, currentPool);
          return { triggerNewRound: false };
        }
      }).then(async (result) => {
        if (result?.triggerNewRound && result.nextRoundId) {
          // c) Auto-trigger our background Gemini service to spin up a brand-new active round under the rounds subcollection
          const roundRef = doc(db, `spark_groups/${groupId}/rounds`, result.nextRoundId);
          await triggerDailyQA(roundRef);
          confetti({ particleCount: 150, spread: 80 });
        }
        setRematchError(null);
      });
    } catch (err: any) {
      console.error("Error committing contribution transaction:", err);
      setRematchError(err.message || "Transaction failed, please try again.");
    } finally {
      setRematchLoading(false);
    }
  };

  // Trigger Daily Question Generation and Random Subject pick via Gemini AI
  const triggerDailyQA = async (roundDocRef: any) => {
    if (!group || group.members.length === 0) return;

    try {
      // Purge old subcollections of the day first before setting up brand new round
      await purgeRoundSubcollections();

      // Pick random subject
      const members = group.members;
      const rIdx = Math.floor(Math.random() * members.length);
      const chosenSubjectId = members[rIdx];

      // Pick fake subject (another random user) helper
      const fakeMembers = members.filter((m: string) => m !== chosenSubjectId);
      const chosenFakeId = fakeMembers.length > 0 
        ? fakeMembers[Math.floor(Math.random() * fakeMembers.length)] 
        : chosenSubjectId;

      // Fetch Subject's real name from Firestore
      let subjectName = "our secret friend";
      try {
        const subjectDoc = await getDoc(doc(db, 'users', chosenSubjectId));
        if (subjectDoc.exists()) {
          const subData = subjectDoc.data();
          if (subData?.name) {
            subjectName = subData.name.trim();
          }
        }
      } catch (err) {
        console.error("[SparkEngine] Error fetching subject profile name:", err);
      }

      console.log(`[SparkEngine] Generating daily QA with Gemini call specifically about: ${subjectName}...`);
      const used = group.used_questions || [];

      // Prompt structured for callCoachModel helper inside gemini service
      const contents = [
        {
          parts: [{
            text: `You are the Game Master of "Spark Says", a daily social deduction game for close friends. 
Today's designated secret player is named "${subjectName}".

Generate 3 highly specific, creative trivia or personality questions ABOUT ${subjectName}. The questions must be written so that other group members have to guess facts, habits, or hypothetical reactions of ${subjectName}.
The 3 questions are: One "Easy" (light-hearted trivia or habit icebreaker), one "Medium" (choices, hypothetical scenarios, preferences), and one "Deep" (emotional, personal goals, philosophical reactions, vulnerability).

Make sure the questions use the name "${subjectName}" explicitly within the question text (e.g. "What is ${subjectName}'s absolute go-to midnight snack?" or "If ${subjectName} suddenly won the lottery, what is the very first thing they would purchase?").
Do not generate generic or cliché questions. Do not suggest questions that already exist in this used list: [${used.join(', ')}].

Return EXACTLY a raw JSON object string with these precise keys (no markdown formatting, no leading backticks):
{
  "easy": "Question text here referring to ${subjectName}...",
  "medium": "Question text here referring to ${subjectName}...",
  "deep": "Question text here referring to ${subjectName}..."
}`
          }]
        }
      ];

      const resText = await callCoachModel(contents, { responseMimeType: "application/json" });
      
      // Sanitization
      let cleanedText = (resText || '').trim();
      // Remove any markdown code fence block if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.substring(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();

      // Clean up any other characters or non-JSON wrapper lines
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
      }

      let qObj;
      try {
        qObj = JSON.parse(cleanedText);
        if (!qObj.easy || !qObj.medium || !qObj.deep) {
          throw new Error("Missing required question keys in parsed JSON object");
        }
      } catch (parseError) {
        console.warn("[SparkEngine] Sanitized JSON parse failed, utilizing fallback questions:", parseError, "Raw string was:", resText);
        qObj = {
          easy: `What is ${subjectName}'s favorite weekend breakfast?`,
          medium: `If ${subjectName} could change one career choice, what would it be?`,
          deep: `What is a major life dream of ${subjectName} that you admire?`
        };
      }

      await setDoc(roundDocRef, {
        subject_id: chosenSubjectId,
        fake_subject_id: chosenFakeId,
        date: todayString,
        phase: 'answering',
        questions: [
          { id: 'easy', text: qObj.easy, difficulty: 'Easy' },
          { id: 'medium', text: qObj.medium, difficulty: 'Medium' },
          { id: 'deep', text: qObj.deep, difficulty: 'Deep' }
        ],
        answers_locked_at: null,
        created_at: new Date().toISOString()
      });

      // Append items to group used_questions block
      const groupDocRef = doc(db, 'spark_groups', groupId!);
      await updateDoc(groupDocRef, {
        used_questions: arrayUnion(qObj.easy, qObj.medium, qObj.deep)
      });

      console.log("[SparkEngine] Successfully created game room questions with random chosen Subject");

    } catch (e) {
      console.error("[SparkEngine] Error triggering QA:", e);
    }
  };

  // Submit Answers (Phase 2 Action)
  const handleAnswerSubmit = async () => {
    if (!groupId || !firebaseUser || submitLoading) return;
    if (!easyAnswer.trim() || !mediumAnswer.trim() || !deepAnswer.trim()) return;

    setSubmitLoading(true);

    try {
      // Calculate 15 mins quick bonus
      const now = new Date();
      const [hours, minutes] = group.trigger_time.split(':').map(Number);
      const triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0);

      const diffMs = now.getTime() - triggerDate.getTime();
      const isBonus = diffMs >= 0 && diffMs <= 15 * 60 * 1000;

      await setDoc(doc(db, `spark_groups/${groupId}/rounds/${activeRoundId}/answers`, firebaseUser.uid), {
        easy: easyAnswer.trim(),
        medium: mediumAnswer.trim(),
        deep: deepAnswer.trim(),
        user_id: firebaseUser.uid,
        sender_id: firebaseUser.uid,
        submitted_at: new Date().toISOString(),
        quick_bonus: isBonus
      });

      // Bonus points added instantly to user's Aura!
      if (isBonus) {
        await updateDoc(doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid), {
          total_aura: increment(1)
        });
      }

      confetti({ particleCount: 60, spread: 40 });
    } catch (e) {
      console.error("Error submitting answers:", e);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Submit Guess (Phase 4 Action)
  // Let user guess who written a specific target answer
  const handleGuessSubmit = async (selectedAnswer: any, questionId: 'easy' | 'medium' | 'deep') => {
    if (!groupId || !firebaseUser || !selectedGuessUserId || guessLoading) return;

    setGuessLoading(true);
    const correctUserId = selectedAnswer.user_id;
    const isCorrect = selectedGuessUserId === correctUserId;

    try {
      // Save Guess Log
      await setDoc(doc(db, `spark_groups/${groupId}/rounds/${activeRoundId}/guesses`, `${firebaseUser.uid}_guess_${questionId}`), {
        question_id: questionId,
        user_id: firebaseUser.uid,
        target_answer_text: selectedAnswer[questionId],
        guessed_user_id: selectedGuessUserId,
        correct_user_id: correctUserId,
        is_correct: isCorrect,
        created_at: new Date().toISOString()
      });

      // Points Reward Matrix
      if (isCorrect) {
        // Correct deduction earns +2 Aura!
        await updateDoc(doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid), {
          total_aura: increment(2)
        });

        // Subject Reward check: if guessed user is indeed the Subject, award extra standing
        if (correctUserId === todayRound?.subject_id) {
          await updateDoc(doc(db, `spark_groups/${groupId}/aura`, todayRound.subject_id), {
            total_aura: increment(2)
          });
        }

        confetti({ particleCount: 30, colors: ['#10b981', '#34d399'] });
      } else {
        // Failed guess of yours awards +2 Aura to the anonymous author (smart deception!)
        await updateDoc(doc(db, `spark_groups/${groupId}/aura`, correctUserId), {
          total_aura: increment(2)
        });
        setWrongAnswersCount(prev => prev + 1);
      }

      setSelectedGuessUserId('');
    } catch (e) {
      console.error("Error submitting game guess:", e);
    } finally {
      setGuessLoading(false);
    }
  };

  // Submit All Guesses (Phase 4 Subject Action)
  const handleSubmitAllGuesses = async () => {
    if (!groupId || !firebaseUser || !todayRound || guessSubmitLoading) return;

    setGuessSubmitLoading(true);

    try {
      // Start with +1 Aura participation bonus for being the Subject (you showed up!)
      let subjectAuraIncrement = 1;

      // We will loop through the answer entries we guessed for
      for (const ans of anonymousAnswsForGuess) {
        const correctUserId = ans.id; // Since the document ID is the author's userId (firebaseUser.uid)
        const guessedUserId = tempGuesses[ans.id]; // What the Subject guessed

        if (!guessedUserId) continue; // safety guard

        const isCorrect = guessedUserId === correctUserId;

        // 1. Save guess document to Firestore
        const guessDocId = `${firebaseUser.uid}_guess_${ans.id}`;
        await setDoc(doc(db, `spark_groups/${groupId}/rounds/${activeRoundId}/guesses`, guessDocId), {
          user_id: firebaseUser.uid,
          target_answer_text: ans.easy,
          guessed_user_id: guessedUserId,
          correct_user_id: correctUserId,
          is_correct: isCorrect,
          created_at: new Date().toISOString()
        });

        // 2. Score check:
        if (isCorrect) {
          // +2 Aura to Subject for a correct guess
          subjectAuraIncrement += 2;
        } else {
          // +2 to the answerer for a wrong guess (author gets points for deceptions)
          await updateDoc(doc(db, `spark_groups/${groupId}/aura`, correctUserId), {
            total_aura: increment(2)
          });
        }
      }

      // Update Subject's Aura (if any correct guesses were made)
      if (subjectAuraIncrement > 0) {
        await updateDoc(doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid), {
          total_aura: increment(subjectAuraIncrement)
        });
      }

      // 3. Transition the round phase to 'complete' in Firestore
      const roundRef = doc(db, `spark_groups/${groupId}/rounds`, activeRoundId);
      await updateDoc(roundRef, {
        phase: 'complete',
        answers_locked_at: new Date().toISOString()
      });

      // Play a magnificent visual trigger for completion!
      confetti({ particleCount: 120, spread: 80 });

    } catch (e) {
      console.error("[SparkEngine] Error submitting all guesses:", e);
    } finally {
      setGuessSubmitLoading(false);
    }
  };

  // Spend Aura Points Inside the Store
  const handleSpendAura = async (cost: number, benefit: string) => {
    if (!groupId || !firebaseUser || !userAura) return;
    if (userAura.total_aura < cost) {
      setStoreError("Insufficient Aura points in your standing!");
      return;
    }

    setStoreError(null);
    setStoreMessage(null);

    try {
      const auraDocRef = doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid);
      
      // Deduct points
      await updateDoc(auraDocRef, {
        total_aura: increment(-cost),
        spent_aura: increment(cost),
        history: arrayUnion({
          points: -cost,
          reason: `Spent inside details: ${benefit}`,
          created_at: new Date().toISOString()
        })
      });

      // Perform real social side effects!
      if (benefit.includes("Connection Streak Boost") && selectedStoreFriendId) {
        // Let's create an in-app surprise log inside social activities
        await addDoc(collection(db, 'social_activity'), {
          activity_type: 'streak_boost',
          grabber_uid: firebaseUser.uid,
          host_uid: selectedStoreFriendId,
          points_added: 5,
          created_at: new Date().toISOString()
        });

        confetti({ particleCount: 80, spread: 60 });
        setStoreMessage(`Successfully boosted your connection connection score with ${membersProfiles[selectedStoreFriendId]?.name || 'your friend'} by adding +5 streak support!`);
      } else {
        setStoreMessage(`Successfully purchased details: "${benefit}"! Your standing is registered dynamically.`);
      }

      setSelectedStoreFriendId('');
    } catch (e) {
      console.error("Error spending points:", e);
      setStoreError("Failed to purchase. Please try again.");
    }
  };

  if (loading || !gameConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const currentPhase = todayRound?.phase === 'complete' 
    ? 'Complete' 
    : (todayRound?.phase === 'guessing' ? 'Guessing phase' : gameConfig.phase);

  return (
    <div id="spark-gameroom-page" className="pb-24 pt-[calc(1.5rem+var(--sat))] bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-2xl mx-auto px-4 space-y-6">

        {/* Back Row */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/spark" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Spark game suite</h1>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{group?.name}</p>
            </div>
          </div>

          <button
            id="toggle-aura-store"
            onClick={() => {
              setStoreMessage(null);
              setStoreError(null);
              setShowAuraStore(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/40 dark:bg-black/45 backdrop-blur-md text-amber-600 dark:text-amber-400 hover:bg-white/60 dark:hover:bg-black/60 border border-zinc-200/50 dark:border-zinc-800 rounded-full text-xs font-extrabold cursor-pointer transition-all hover:scale-105 shadow-sm"
          >
            <span>⚡ {userAura?.total_aura || 0} Aura</span>
          </button>
        </header>

        {/* Dynamic Countdown Header */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-200">
                {gameConfig.text}
              </h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Active Round: {activeRoundId}</p>
            </div>
          </div>

          {currentPhase !== 'Complete' && (gameConfig.minutesLeft > 0 || (gameConfig.secondsLeft !== undefined && gameConfig.secondsLeft > 0)) && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 rounded-xl text-xs font-black font-mono tracking-tight text-zinc-500">
              <Clock size={12} className="text-zinc-450" />
              <span>
                {gameConfig.secondsLeft !== undefined && gameConfig.secondsLeft < 60 
                  ? `${gameConfig.secondsLeft}s left` 
                  : `${gameConfig.minutesLeft}m left`
                }
              </span>
            </div>
          )}
        </div>

        {/* STAGES CONTENT PANELS */}
        <AnimatePresence mode="wait">

          {/* PHASE 1: WAITING FOR TRIGGER */}
          {currentPhase === 'Waiting for trigger' && (
            <motion.div
              key="waiting-panel"
              className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-6 shadow-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-16 h-16 bg-zinc-55 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-330 relative">
                <Clock size={36} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-black">Silent Anticipation...</h2>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Spark triggers at <span className="font-bold dark:text-white p-1 bg-zinc-800 rounded-lg">{formatTime(group?.trigger_time, user?.timeFormatPreference || '12h')}</span>. 
                  All group members get AI questions and answers lock in anonymously!
                </p>
              </div>

              <div id="countdown-banner-widget" className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 font-mono font-bold text-sm tracking-widest inline-block text-zinc-500 border border-zinc-100">
                DAILY RELEASE COUNTDOWN: {gameConfig.secondsLeft !== undefined && gameConfig.secondsLeft < 60 
                  ? `${gameConfig.secondsLeft} SECS` 
                  : `${gameConfig.minutesLeft} MINS`
                }
              </div>
            </motion.div>
          )}

          {/* PHASE 2: ANSWERING ROOM */}
          {currentPhase === 'Answering now' && (
            <motion.div
              key="answering-panel"
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="p-5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-3xl shadow-lg space-y-1.5">
                <span className="inline-block text-[9px] uppercase font-black px-2 py-0.5 bg-white/20 rounded-md">Phase 1 ACTIVE</span>
                <h3 className="font-extrabold text-base">Anonymity is your safe weapon!</h3>
                <p className="text-xs text-teal-50">Answer the 3 AI questions below. Your responses are stored in private secure subdocuments.</p>
              </div>

              {/* Check if user already answered */}
              {userAnswers ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 rounded-3xl space-y-4">
                  <div className="w-12 h-14 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-md">Answers Locked In! 🤐</h3>
                    <p className="text-xs text-zinc-400">
                      Your answers are secure. Guessing phase starts in {gameConfig.secondsLeft !== undefined && gameConfig.secondsLeft < 60 
                        ? `${gameConfig.secondsLeft} seconds` 
                        : `${gameConfig.minutesLeft} minutes`
                      }.
                    </p>
                  </div>

                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 text-left space-y-3.5 text-xs">
                    <div>
                      <span className="font-bold text-zinc-400">Easy Answer:</span>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">"{userAnswers.easy}"</p>
                    </div>
                    <div>
                      <span className="font-bold text-zinc-400">Medium Answer:</span>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">"{userAnswers.medium}"</p>
                    </div>
                    <div>
                      <span className="font-bold text-zinc-400">Deep Answer:</span>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">"{userAnswers.deep}"</p>
                    </div>
                  </div>
                </div>
              ) : todayRound ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6 shadow-sm">
                  <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400">The 3 Daily Prompts</h3>
                  
                  <div className="space-y-4 text-xs font-semibold">
                    {/* Easy Question */}
                    <div className="space-y-2">
                      <span className="inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md font-bold">Question 1: Easy</span>
                      <p className="text-zinc-850 dark:text-zinc-150 leading-relaxed font-bold">{displayQuestionText(todayRound.questions?.[0]?.text)}</p>
                      <textarea
                        rows={2}
                        placeholder="Write something punchy..."
                        value={easyAnswer}
                        onChange={(e) => setEasyAnswer(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Medium Question */}
                    <div className="space-y-2">
                      <span className="inline-block px-2 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-md font-bold">Question 2: Medium</span>
                      <p className="text-zinc-850 dark:text-zinc-150 leading-relaxed font-bold">{displayQuestionText(todayRound.questions?.[1]?.text)}</p>
                      <textarea
                        rows={2}
                        placeholder="Share your custom preference/opinion..."
                        value={mediumAnswer}
                        onChange={(e) => setMediumAnswer(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Deep Question */}
                    <div className="space-y-2">
                      <span className="inline-block px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-md font-bold">Question 3: Deep</span>
                      <p className="text-zinc-850 dark:text-zinc-150 leading-relaxed font-bold">{displayQuestionText(todayRound.questions?.[2]?.text)}</p>
                      <textarea
                        rows={2}
                        placeholder="Be slightly vulnerable or funny..."
                        value={deepAnswer}
                        onChange={(e) => setDeepAnswer(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
                    <button
                      id="submit-game-answers"
                      onClick={handleAnswerSubmit}
                      disabled={submitLoading || !easyAnswer.trim() || !mediumAnswer.trim() || !deepAnswer.trim()}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-2xl font-extrabold shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
                    >
                      {submitLoading ? "Securing in Firestore..." : "Lock in Answers Anonymously 🔒"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-150">
                  <p className="text-zinc-400 font-bold text-xs animate-pulse">Initializing today's Spark prompts...</p>
                </div>
              )}
            </motion.div>
          )}
          {/* PHASE 3 & 4 UNIFIED: REVEAL CLUES & GUESSING DEDUCTION */}
          {(currentPhase === 'Reveal in progress' || currentPhase === 'Guessing phase') && (
            <motion.div
              key="gameplay-deduction-panel"
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isCurrentUserSubject ? (
                /* GUESSING MODE FOR THE CHOSEN SUBJECT */
                <div className="space-y-6">
                  <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-3xl shadow-sm space-y-1.5">
                    <span className="inline-block text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-md">Subject Deduction Suite</span>
                    <h3 className="font-extrabold text-base">You are today's Secret Subject! ⚡</h3>
                    <p className="text-xs text-amber-50 leading-relaxed font-semibold">
                      Your goal is to guess which group teammate wrote each answer collection below. Keep your guesses local. Standings and actual authors will simultaneously unlock to the lobby once you tap submit!
                    </p>
                  </div>

                  <div className="space-y-6">
                    {anonymousAnswsForGuess.map((ans, idx) => {
                      const selectedGuessMId = tempGuesses[ans.id];
                      return (
                        <div 
                          key={ans.id || idx}
                          className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 shadow-sm"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-zinc-150 dark:border-zinc-800">
                            <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Mystery Answer Set #{idx + 1}</span>
                            <span className="text-xs font-mono font-bold text-amber-500 bg-amber-550/10 px-2 py-0.5 rounded-lg">Unassigned Guess</span>
                          </div>

                          {/* 3 Answers Stack */}
                          <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                            <div>
                              <span className="text-[9px] uppercase font-black text-emerald-500 tracking-wider">🟢 Easy Answer:</span>
                              <p className="text-xs font-semibold italic text-zinc-850 dark:text-zinc-150 mt-0.5">"{ans.easy}"</p>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-black text-indigo-500 tracking-wider">🔵 Medium Answer:</span>
                              <p className="text-xs font-semibold italic text-zinc-850 dark:text-zinc-150 mt-0.5">"{ans.medium}"</p>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-black text-rose-500 tracking-wider">🟣 Deep Answer:</span>
                              <p className="text-xs font-semibold italic text-zinc-850 dark:text-zinc-150 mt-0.5">"{ans.deep}"</p>
                            </div>
                          </div>

                          {/* Candidate Avatar Row */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Select predicted author:</label>
                            
                            <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/40">
                              {group?.members?.filter((mId: string) => mId !== firebaseUser!.uid).map((mId: string) => {
                                const profile = membersProfiles[mId] || {};
                                const isSelected = selectedGuessMId === mId;
                                return (
                                  <button
                                    key={mId}
                                    type="button"
                                    onClick={() => setTempGuesses(prev => ({ ...prev, [ans.id]: mId }))}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                      isSelected
                                        ? 'bg-amber-500 border-amber-600 text-white shadow-md shadow-amber-550/20'
                                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-850 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                  >
                                    {profile.profile_picture_url ? (
                                      <img 
                                        src={profile.profile_picture_url} 
                                        alt={profile.name}
                                        referrerPolicy="no-referrer"
                                        className="w-5 h-5 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-[9px]">
                                        {profile.name?.substring(0, 2).toUpperCase() || 'P'}
                                      </div>
                                    )}
                                    <span>{profile.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {anonymousAnswsForGuess.length === 0 && (
                      <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 rounded-3xl">
                        <p className="text-zinc-400 font-bold text-xs">Waiting for other players to submit answers in this game hub...</p>
                      </div>
                    )}
                  </div>

                  {/* Submit All Guesses Block */}
                  {anonymousAnswsForGuess.length > 0 && (
                    <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center shadow-lg space-y-4">
                      <div>
                        <h4 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-150">Ready to lock in your verdict?</h4>
                        <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                          Assigned guesses: {Object.keys(tempGuesses).length} / {anonymousAnswsForGuess.length}
                        </p>
                      </div>
                      
                      <button
                        onClick={handleSubmitAllGuesses}
                        disabled={guessSubmitLoading || Object.keys(tempGuesses).length !== anonymousAnswsForGuess.length}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-2xl font-black shadow-lg shadow-emerald-510/10 cursor-pointer transition-all animate-none"
                      >
                        {guessSubmitLoading ? "Calculating standing points..." : "Submit All Guesses & Reveal ⚡"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* NON-SUBJECT: WAITING & CLUE ANALYZER */
                <div className="space-y-6">
                  {/* Anticipation Status */}
                  <div className="p-6 bg-gradient-to-tr from-indigo-500 to-indigo-600 border border-indigo-400/20 text-white rounded-3xl shadow-sm space-y-2 text-center">
                    <span className="inline-block text-[9px] uppercase font-black bg-white/20 px-2 py-0.5 rounded-md">Lobby Live Sync</span>
                    <h3 className="font-extrabold text-base">The Deduction Masterplay is Active! 🔍</h3>
                    <p className="text-xs text-indigo-50 leading-relaxed font-semibold max-w-md mx-auto">
                      Today's Subject, <span className="underline font-bold text-yellow-300">{membersProfiles[todayRound?.subject_id]?.name || 'Lobby Star'}</span>, is currently analyzing everyone's answers and submitting their verdict. Answers are unmasking simultaneously once they lock in!
                    </p>
                  </div>

                  {/* Read Displays */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">Answers to prompt 1 (Easy)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {allAnswers.map((ans, i) => (
                          <div key={i} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm text-xs italic font-medium leading-relaxed">
                            "{ans.easy}"
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">Answers to prompt 2 (Medium)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {allAnswers.map((ans, i) => (
                          <div key={i} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm text-xs italic font-medium leading-relaxed">
                            "{ans.medium}"
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">Answers to prompt 3 (Deep)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {allAnswers.map((ans, i) => (
                          <div key={i} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm text-xs italic font-semibold leading-relaxed text-indigo-600 dark:text-indigo-400">
                            "{ans.deep}"
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* PHASE 5: COMPLETE REVELATION SUMMARY */}
          {currentPhase === 'Complete' && (
            <motion.div
              key="complete-panel"
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="p-6 bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-600 text-white rounded-3xl shadow-xl text-center space-y-3">
                <span className="inline-block text-[9px] uppercase font-black px-2.5 py-0.5 bg-white/25 rounded-md tracking-wider">Today's Standings</span>
                
                <h2 className="text-2xl font-black text-white drop-shadow-sm flex justify-center items-center gap-2">
                  <Trophy size={24} />
                  <span>Deduction Unmasked!</span>
                </h2>
                
                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 max-w-sm mx-auto leading-relaxed">
                  <span className="text-[10px] uppercase font-black text-amber-100 tracking-widest block">Daily Chosen Subject</span>
                  <p className="text-lg font-black mt-0.5">{membersProfiles[todayRound?.subject_id]?.name || 'Lobby Star'}</p>
                </div>
              </div>

              {/* TRIGGER REMATCH MODULE */}
              <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-md space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                    <Zap size={18} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-black tracking-tight">Crowdfund Rematch Round ⚡</h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">Play another round of Spark Says today! A rematch costs 20 Aura total contributed by members of this group.</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-zinc-500">Rematch Pool Status:</span>
                    <span className="font-mono font-black text-emerald-500">
                      {rematchPool?.total_contributions || 0} / 20 Aura
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-805 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (((rematchPool?.total_contributions || 0) / 20) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Pledgors */}
                {rematchPool?.pledges && Object.keys(rematchPool.pledges).length > 0 && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-805 text-left">
                    <span className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Current Pledges:</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {Object.entries(rematchPool.pledges).map(([userId, pledgeVal]: any) => {
                        const profile = membersProfiles[userId] || {};
                        return (
                          <div key={userId} className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-150 dark:border-zinc-800 text-[10px] font-bold">
                            <span className="text-zinc-650 dark:text-zinc-350">{profile.name || 'Friend'}</span>
                            <span className="text-emerald-500 font-mono">+{pledgeVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {rematchError && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-500 text-center text-xs font-bold">
                    {rematchError}
                  </div>
                )}

                {/* Micro-form Action Input */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input 
                      type="number"
                      min={1}
                      max={userAura?.total_aura || 1}
                      value={rematchContribution}
                      onChange={(e) => setRematchContribution(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full pl-3 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none rounded-xl text-xs font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-zinc-400 tracking-wider">AURA</span>
                  </div>
                  <button
                    onClick={() => handleContributeAura(rematchContribution)}
                    disabled={rematchLoading || (userAura?.total_aura || 0) <= 0}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                  >
                    {rematchLoading ? "Pledging..." : "Pledge Aura ⚡"}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 text-center font-semibold text-zinc-450 dark:text-zinc-400">Your Group Balance: {userAura?.total_aura || 0} Aura</p>
              </div>

              {/* Complete List of Friend Answers Unmasked */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wide text-zinc-400 pl-1">Friend card secrets unmasked</h3>
                
                {allAnswers.map((ans, idx) => {
                  const profile = membersProfiles[ans.user_id] || {};
                  const isSubject = ans.user_id === todayRound?.subject_id;

                  return (
                    <div 
                      key={idx}
                      className={`p-5 bg-white dark:bg-zinc-900 border rounded-3xl space-y-4 shadow-sm transition-all ${
                        isSubject ? 'border-amber-500/30 ring-2 ring-amber-500/5' : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      {/* Friend Info */}
                      <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
                        <div className="flex items-center gap-2.5">
                          {profile.profile_picture_url ? (
                            <img 
                              src={profile.profile_picture_url} 
                              alt={profile.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-105 flex items-center justify-center font-bold text-xs uppercase">
                              {profile.name?.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-black text-sm">{profile.name}</span>
                            {isSubject && (
                              <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full">Subject</span>
                            )}
                          </div>
                        </div>

                        {ans.quick_bonus && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-[2px] rounded-lg">
                            <Flame size={10} />
                            <span>Speed Bonus</span>
                          </span>
                        )}
                      </div>

                      {/* Answers Blocks */}
                      <div className="space-y-3.5 text-xs">
                        <div>
                          <span className="font-black text-zinc-400 capitalize block">Question 1 (Easy):</span>
                          <p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 italic">"{ans.easy}"</p>
                        </div>
                        <div>
                          <span className="font-black text-zinc-400 capitalize block">Question 2 (Medium):</span>
                          <p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 italic">"{ans.medium}"</p>
                        </div>
                        <div>
                          <span className="font-black text-zinc-400 capitalize block">Question 3 (Deep):</span>
                          <p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 italic">"{ans.deep}"</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>

      {/* AURA CORNER / STORE DRAWER */}
      <AnimatePresence>
        {showAuraStore && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuraStore(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Slide up Drawer content */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-t-[32px] border-t border-zinc-200 dark:border-zinc-800 p-6 space-y-6 z-10 bottom-0 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-extrabold flex items-center gap-1.5">
                    <Coins className="text-amber-500 fill-amber-500 animate-pulse" size={20} />
                    <span>Aura Standing Store</span>
                  </h3>
                  <p className="text-xs text-zinc-450 dark:text-zinc-400">Exchange Aura points to trigger elite social modifiers inside your hub!</p>
                </div>
                <button 
                  onClick={() => setShowAuraStore(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Status messages notifications */}
              {storeMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 text-center text-xs font-bold border border-emerald-100 dark:border-emerald-800 rounded-xl">
                  ✨ {storeMessage}
                </div>
              )}
              {storeError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 text-center text-xs font-bold border border-rose-100 dark:border-rose-800 rounded-xl">
                  ⚠️ {storeError}
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex-row text-xs font-bold border">
                <span>Your standing:</span>
                <span className="text-base font-black text-amber-500">{userAura?.total_aura || 0} Points</span>
              </div>

              {/* Store items catalog grid */}
              <div className="grid grid-cols-2 gap-4 pb-6">
                {[
                  {
                    id: 'decoy_scanner',
                    title: 'Decoy Scanner 📡',
                    desc: 'Drops one incorrect candidate choice from the guess matrix.',
                    cost: 40,
                    color: 'from-blue-500/10 to-indigo-500/10 border-indigo-200 dark:border-indigo-950',
                  },
                  {
                    id: 'smoke_bomb',
                    title: 'Anonymous Smoke Bomb 💨',
                    desc: 'Grants one completely anonymous text broadcast inside the locker room chat.',
                    cost: 25,
                    color: 'from-purple-500/10 to-pink-500/10 border-purple-200 dark:border-purple-950',
                  },
                  {
                    id: 'incognito_toggle',
                    title: 'Incognito Toggle 🎭',
                    desc: 'Mask your presence on active group visibility rosters.',
                    cost: 60,
                    color: 'from-amber-500/10 to-orange-500/10 border-amber-200 dark:border-amber-950',
                  },
                  {
                    id: 'leaderboard_crown',
                    title: 'Leaderboard Crown 👑',
                    desc: 'Unlocks an animated golden gradient profile border frame across listings.',
                    cost: 100,
                    color: 'from-emerald-500/10 to-teal-500/10 border-emerald-200 dark:border-emerald-950',
                  }
                ].map((item) => {
                  const balance = userAura?.total_aura || 0;
                  const canAfford = balance >= item.cost;
                  
                  return (
                    <div 
                      key={item.id}
                      className={`flex flex-col justify-between p-4 bg-gradient-to-br ${item.color} border rounded-3xl transition-all duration-300 relative overflow-hidden group ${
                        !canAfford ? 'opacity-40' : 'hover:scale-[1.02] shadow-md'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-extrabold text-xs text-zinc-900 dark:text-zinc-50 leading-tight">
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-medium">
                          {item.desc}
                        </p>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                          <span>Cost:</span>
                          <span>{item.cost} Aura</span>
                        </div>

                        <button
                          onClick={() => {
                            if (!canAfford) return;
                            console.log(`[Aura Bazaar] User purchased: ${item.title} (${item.id}) for ${item.cost} points`);
                            handleSpendAura(item.cost, item.title);
                          }}
                          disabled={!canAfford}
                          className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                            canAfford 
                              ? 'bg-zinc-950 text-white hover:bg-amber-500 cursor-pointer shadow-md' 
                              : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? "Purchase" : "Insufficient Aura"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
