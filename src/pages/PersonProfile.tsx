import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Gift, 
  MessageSquare, 
  History, 
  Plus, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Smile,
  Zap,
  MoreVertical,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  BellRing,
  Trash2,
  Heart,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoadingScreen from '../components/LoadingScreen';
import { formatDate, getDaysUntil, getRelationshipScore, cn, getTurningAge } from '../lib/utils';
import { generateBirthdayMessage, generateRecoveryPlan } from '../services/geminiService';
import { db } from '../lib/firebase';
import confetti from 'canvas-confetti';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';

export default function PersonProfile() {
  const { id } = useParams();
  const { firebaseUser, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [person, setPerson] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedYear, setExpandedYear] = React.useState<number | null>(new Date().getFullYear());
  const [aiMessage, setAiMessage] = React.useState<any>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [recoveryPlan, setRecoveryPlan] = React.useState<any>(null);
  const [isRecovering, setIsRecovering] = React.useState(false);
  const [showMemoryForm, setShowMemoryForm] = React.useState(false);
  const [newMemory, setNewMemory] = React.useState({ type: 'gift', content: '' });
  const [showReminderSettings, setShowReminderSettings] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editData, setEditData] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'gifts' | 'timeline'>('overview');
  const [showGiftForm, setShowGiftForm] = React.useState(false);
  const [newGift, setNewGift] = React.useState({ name: '', status: 'idea', price: '', notes: '' });

  const addGift = async () => {
    if (!id) return;
    try {
      const giftsRef = collection(db, 'people', id, 'gifts');
      const docRef = await addDoc(giftsRef, {
        ...newGift,
        price: newGift.price ? parseFloat(newGift.price) : null,
        created_at: serverTimestamp()
      });
      setPerson((prev: any) => ({
        ...prev,
        gifts: [...(prev.gifts || []), { id: docRef.id, ...newGift, price: newGift.price ? parseFloat(newGift.price) : null }]
      }));
      setNewGift({ name: '', status: 'idea', price: '', notes: '' });
      setShowGiftForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const personRef = doc(db, 'people', id);
      await setDoc(personRef, editData, { merge: true });
      setPerson({ ...person, ...editData });
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    if (!id) return;
    try {
      const taskRef = doc(db, 'people', id, 'tasks', taskId);
      await setDoc(taskRef, { completed: !completed }, { merge: true });
      setPerson((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: (prev.tasks || []).map((t: any) => t.id === taskId ? { ...t, completed: !completed } : t)
        };
      });
    } catch (err) {
      console.error(err);
    }
  };

  const addTask = async (title: string, dueDate?: string) => {
    if (!id) return;
    try {
      const tasksRef = collection(db, 'people', id, 'tasks');
      const docRef = await addDoc(tasksRef, {
        title,
        completed: false,
        due_date: dueDate || null,
        created_at: serverTimestamp()
      });
      setPerson((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: [...(prev.tasks || []), { id: docRef.id, title, completed: false, due_date: dueDate }]
        };
      });
      return docRef.id;
    } catch (err) {
      console.error(err);
    }
  };

  const addMemory = async () => {
    if (!id) return;
    try {
      const memoriesRef = collection(db, 'people', id, 'memories');
      const docRef = await addDoc(memoriesRef, {
        year: new Date().getFullYear(),
        type: newMemory.type,
        content: newMemory.content,
        created_at: serverTimestamp()
      });
      setPerson((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          memories: [...(prev.memories || []), { id: docRef.id, year: new Date().getFullYear(), type: newMemory.type, content: newMemory.content }]
        };
      });
      setNewMemory({ type: 'gift', content: '' });
      setShowMemoryForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this memory?')) return;
    try {
      const memoryRef = doc(db, 'people', id, 'memories', memoryId);
      await setDoc(memoryRef, { deleted: true }, { merge: true }); // Soft delete or actual delete
      // For simplicity, let's just remove it from state
      setPerson((prev: any) => ({
        ...prev,
        memories: prev.memories.filter((m: any) => m.id !== memoryId)
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const updateReminders = async (settings: any) => {
    if (!id) return;
    try {
      const personRef = doc(db, 'people', id);
      await setDoc(personRef, { reminder_settings: settings }, { merge: true });
      setPerson({ ...person, reminder_settings: settings });
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    const fetchPerson = async () => {
      if (!id || !firebaseUser) return;
      try {
        const personRef = doc(db, 'people', id);
        const personSnap = await getDoc(personRef);
        if (!personSnap.exists()) {
          setLoading(false);
          return;
        }
        const data = { id: personSnap.id, ...personSnap.data() } as any;

        // Fetch tasks
        const tasksRef = collection(db, 'people', id, 'tasks');
        const tasksSnap = await getDocs(tasksRef);
        const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch memories
        const memoriesRef = collection(db, 'people', id, 'memories');
        const memoriesSnap = await getDocs(memoriesRef);
        const memories = memoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch gifts
        const giftsRef = collection(db, 'people', id, 'gifts');
        const giftsSnap = await getDocs(giftsRef);
        const gifts = giftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const fullData = { ...data, tasks, memories, gifts };
        setPerson(fullData);

        // Ensure "Card Message" task exists with correct due date
        const today = new Date();
        const bday = new Date(data.birthday);
        let nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        if (nextBday < today) {
          nextBday.setFullYear(today.getFullYear() + 1);
        }
        const dueDate = new Date(nextBday);
        dueDate.setDate(dueDate.getDate() - 3);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const cardTask = tasks.find((t: any) => t.title === 'Card Message') as any;
        if (!cardTask) {
          await addTask('Card Message', dueDateStr);
        } else if (cardTask.due_date !== dueDateStr) {
          const taskRef = doc(db, 'people', id, 'tasks', cardTask.id);
          await setDoc(taskRef, { due_date: dueDateStr }, { merge: true });
          setPerson((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              tasks: (prev.tasks || []).map((t: any) => t.id === cardTask.id ? { ...t, due_date: dueDateStr } : t)
            };
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPerson();
  }, [id, firebaseUser]);

  const handleGenerateMessage = async () => {
    setIsGenerating(true);
    
    const message = await generateBirthdayMessage({
      name: person.name,
      age: person.birthday ? new Date().getFullYear() - new Date(person.birthday).getFullYear() : 'Unknown',
      relationship: person.category,
      interests: person.interests || 'No specific interests mentioned',
      notes: person.notes || 'No specific notes mentioned'
    });
    setAiMessage(message);
    setIsGenerating(false);
  };

  const handleWishBirthday = async () => {
    if (!id || !firebaseUser || !user) return;
    try {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });

      const userRef = doc(db, 'users', firebaseUser.uid);
      const newStreak = (user.streak || 0) + 1;
      await updateDoc(userRef, { streak: newStreak });
      
      // Log it as a memory
      const memoriesRef = collection(db, 'people', id, 'memories');
      await addDoc(memoriesRef, {
        year: new Date().getFullYear(),
        type: 'milestone',
        content: `Wished a Happy Birthday! Streak increased to ${newStreak}.`,
        created_at: serverTimestamp()
      });

      // Mark card task as done if it exists
      const cardTask = person.tasks?.find((t: any) => t.title === 'Card Message');
      if (cardTask && !cardTask.completed) {
        await toggleTask(cardTask.id, false);
      }

      await refreshUser();
      alert(`Happy Birthday wished! Your relationship streak is now ${newStreak} 🔥`);
    } catch (err) {
      console.error(err);
    }
  };

  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <LoadingScreen />;
  if (!person) return <div>Not found</div>;

  const daysUntil = getDaysUntil(person.birthday);
  const isMissed = daysUntil > 350; // Roughly, if it was in the last 15 days
  const daysLate = 365 - daysUntil;
  const score = getRelationshipScore(person);

  const handleRecovery = async () => {
    setIsRecovering(true);
    const plan = await generateRecoveryPlan({
      daysLate,
      relationship: person.category
    });
    setRecoveryPlan(plan);
    setIsRecovering(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      {/* Hero Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-[var(--line)] pt-[var(--sat)]">
        <div className="p-6 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <span className="label-micro mb-0">Profile</span>
            <div className="w-1 h-1 bg-zinc-300 rounded-full" />
            <span className="text-xs font-bold text-zinc-400">{person.category}</span>
          </div>
          <button 
            onClick={() => {
              setEditData({
                name: person.name,
                nickname: person.nickname,
                birthday: person.birthday,
                category: person.category,
                importance: person.importance,
                notes: person.notes,
                interests: person.interests,
                photo_url: person.photo_url
              });
              setShowEditModal(true);
            }} 
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <MoreVertical size={24} />
          </button>
        </div>
        
        <div className="px-6 pb-10 flex flex-col items-center text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 rounded-[2rem] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl font-black shadow-2xl shadow-zinc-900/10 dark:shadow-white/5 overflow-hidden border-4 border-white dark:border-zinc-900"
          >
            {person.photo_url ? (
              <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <span className="serif-italic">{person.name[0]}</span>
            )}
          </motion.div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-black tracking-tight">{person.name}</h1>
              {user?.streak && user.streak > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-200 dark:border-amber-800/50">
                  <Zap size={10} fill="currentColor" />
                  {user.streak}
                </div>
              )}
            </div>
            <p className="text-zinc-500 font-medium serif-italic text-lg">
              {person.nickname || person.category} • Turning {getTurningAge(person.birthday)}
            </p>
          </div>
          
          <div className="flex gap-4 w-full max-w-sm">
            <div className="flex-1 p-4 card-premium bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1">
              <p className="label-micro">Countdown</p>
              <p className="text-xl font-black tracking-tight">{daysUntil} <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Days</span></p>
            </div>
            <div className="flex-1 p-4 card-premium bg-zinc-50/50 dark:bg-zinc-800/30 space-y-1">
              <p className="label-micro">Relate Score</p>
              <p className="text-xl font-black tracking-tight text-emerald-500">{score}<span className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">%</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Tab Switcher */}
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
          {(['overview', 'gifts', 'timeline'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all",
                activeTab === tab 
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Recovery Mode */}
            <AnimatePresence>
              {isMissed && !recoveryPlan && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-3xl space-y-4 shadow-xl shadow-red-500/5"
                >
                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                    <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-2xl">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h3 className="font-black tracking-tight">Birthday Missed</h3>
                      <p className="text-xs font-medium opacity-80">You're {daysLate} days late. Time for damage control.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleRecovery}
                    disabled={isRecovering}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-600/20 active:scale-95 transition-all relative overflow-hidden"
                  >
                    {isRecovering && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <span className="relative z-10">{isRecovering ? 'Analyzing...' : 'Activate Recovery Mode'}</span>
                  </button>
                </motion.div>
              )}

              {recoveryPlan && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-zinc-900 text-white rounded-3xl space-y-6"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-amber-400 flex items-center gap-2">
                      <Zap size={18} />
                      Late but Legendary Plan
                    </h3>
                    <button onClick={() => setRecoveryPlan(null)} className="text-xs opacity-50">Dismiss</button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">The Apology</p>
                      <p className="text-sm italic text-zinc-300">"{recoveryPlan.apologyMessage}"</p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">Recovery Gifts</p>
                      <ul className="space-y-1">
                        {recoveryPlan.recoveryGiftIdeas.map((gift: string, i: number) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <div className="w-1 h-1 bg-amber-400 rounded-full" />
                            {gift}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500 mb-1">
                        <span>Damage Control</span>
                        <span>65% Recovery</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-[65%]" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 gap-4">
              {daysUntil === 0 && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={handleWishBirthday}
                  className="flex items-center justify-center gap-2 p-6 bg-emerald-500 text-white rounded-3xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Heart size={24} fill="currentColor" />
                  Wish Happy Birthday!
                </motion.button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleGenerateMessage}
                disabled={isGenerating}
                className="flex items-center justify-center gap-2 p-4 bg-zinc-900 text-white rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50 relative overflow-hidden group"
              >
                {isGenerating && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                )}
                <Sparkles size={18} className={cn(isGenerating && "animate-pulse text-emerald-400")} />
                <span className="relative z-10">{isGenerating ? 'Writing...' : 'AI Message'}</span>
              </button>
              <Link 
                to={`/groups/create?personId=${person.id}`}
                className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold shadow-sm hover:scale-[1.02] transition-transform"
              >
                <Zap size={18} className="text-amber-500" />
                Plan Group
              </Link>
            </div>
          </div>

            {/* AI Message Result */}
            <AnimatePresence>
              {aiMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl space-y-6 shadow-xl shadow-emerald-500/5"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2 tracking-tight">
                      <Sparkles size={18} />
                      AI Crafted Messages
                    </h3>
                    <button onClick={() => setAiMessage(null)} className="label-micro mb-0 text-emerald-600 hover:underline">Clear</button>
                  </div>
                    <div className="space-y-6">
                      <div className="space-y-2 group relative">
                        <div className="flex justify-between items-center">
                          <p className="label-micro">Short Text</p>
                          <button 
                            onClick={() => copyToClipboard(aiMessage.shortText, 'short')}
                            className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded transition-colors"
                          >
                            {copied === 'short' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-emerald-600" />}
                          </button>
                        </div>
                        <p className="text-sm serif-italic text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">"{aiMessage.shortText}"</p>
                      </div>
                      <div className="space-y-2 group relative">
                        <div className="flex justify-between items-center">
                          <p className="label-micro">Card Message</p>
                          <button 
                            onClick={() => copyToClipboard(aiMessage.cardMessage, 'card')}
                            className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded transition-colors"
                          >
                            {copied === 'card' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-emerald-600" />}
                          </button>
                        </div>
                        <p className="text-sm serif-italic text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">"{aiMessage.cardMessage}"</p>
                      </div>
                    </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={() => setShowMemoryForm(true)}
              className="w-full flex items-center justify-center gap-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold shadow-sm hover:scale-[1.02] transition-transform"
            >
              <Plus size={18} className="text-emerald-500" />
              Log a Memory
            </button>

            {/* Planning Checklist (Project Manager) */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Planning Checklist
                </h2>
                <span className="label-micro">Progress</span>
              </div>
              <div className="card-premium p-2 space-y-1">
                {['Gift Decision', 'Card Message', 'Celebration Prep'].map((defaultTask) => {
                  const task = person.tasks?.find((t: any) => t.title === defaultTask);
                  return (
                    <motion.button
                      key={defaultTask}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => task ? toggleTask(task.id, !!task.completed) : addTask(defaultTask)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                    >
                      {task?.completed ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500">
                          <CheckCircle2 size={20} fill="currentColor" className="text-white dark:text-zinc-900" />
                        </motion.div>
                      ) : (
                        <Circle size={20} className="text-zinc-300" />
                      )}
                      <span className={cn("text-sm font-bold", task?.completed && "text-zinc-400 line-through")}>
                        {defaultTask}
                      </span>
                      {task?.completed && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto label-micro mb-0 text-emerald-500">
                          Done
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Reminder Settings */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BellRing size={20} className="text-zinc-400" />
                  Custom Reminder Timings
                </h2>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 space-y-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Select when you'd like to be notified about {person.name.split(' ')[0]}'s birthday. These settings are saved specifically for this profile.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(person.reminder_settings || {}).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => {
                        const settings = { ...(person.reminder_settings || {}) };
                        settings[key] = !val;
                        updateReminders(settings);
                      }}
                      className={cn(
                        "flex justify-between items-center p-4 rounded-2xl border transition-all",
                        val ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-zinc-50 dark:bg-zinc-800 border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          val ? "bg-emerald-500" : "bg-zinc-300"
                        )} />
                        <span className="text-sm font-bold capitalize">{key.replace('_', ' ')}</span>
                      </div>
                      {val ? <CheckCircle2 size={18} /> : <Circle size={18} className="opacity-20" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Memory Timeline */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History size={20} className="text-zinc-400" />
                  Memory Timeline
                </h2>
                <button 
                  onClick={() => setShowMemoryForm(!showMemoryForm)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full"
                >
                  <Plus size={18} />
                </button>
              </div>

              <AnimatePresence>
                {showMemoryForm && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4"
                  >
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase text-zinc-400">Memory Type</label>
                      <select
                        value={newMemory.type}
                        onChange={(e) => setNewMemory({ ...newMemory, type: e.target.value })}
                        className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm appearance-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="gift">Gift</option>
                        <option value="joke">Joke</option>
                        <option value="milestone">Milestone</option>
                      </select>
                    </div>
                    <textarea 
                      value={newMemory.content}
                      onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm min-h-[100px]"
                      placeholder={`Log a new ${newMemory.type}...`}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowMemoryForm(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                      <button onClick={addMemory} className="flex-1 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl font-bold text-sm">Save Memory</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                {[2026, 2025, 2024].map((year) => (
                  <div key={year} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    <button 
                      onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                      className="w-full p-4 flex justify-between items-center font-bold"
                    >
                      <span>{year}</span>
                      {expandedYear === year ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <AnimatePresence>
                      {expandedYear === year && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="px-4 pb-4 space-y-3"
                        >
                          {person.memories?.filter((m: any) => m.year === year).length > 0 ? (
                            person.memories.filter((m: any) => m.year === year).map((memory: any) => (
                              <div key={memory.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex gap-3 group/memory">
                                <div className="mt-1">
                                  {memory.type === 'gift' && <Gift size={16} className="text-emerald-500" />}
                                  {memory.type === 'joke' && <Smile size={16} className="text-amber-500" />}
                                  {memory.type === 'milestone' && <Zap size={16} className="text-blue-500" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm">{memory.content}</p>
                                  <p className="text-[10px] text-zinc-400 uppercase font-bold mt-1">{memory.type}</p>
                                </div>
                                <button 
                                  onClick={() => deleteMemory(memory.id)}
                                  className="opacity-0 group-hover/memory:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-500 text-center py-4">No memories logged for this year.</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </section>

            {/* Reflection Prompt */}
            <section className="p-6 bg-zinc-900 text-white rounded-3xl space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-400" />
                Yearly Reflection
              </h3>
              <p className="text-sm text-zinc-400">What's one thing that changed about {person.name.split(' ')[0]} this year?</p>
              <textarea 
                className="w-full bg-zinc-800 border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-emerald-500"
                placeholder="Type your reflection..."
              />
              <button className="w-full py-3 bg-white text-zinc-900 rounded-xl font-bold text-sm">Save Reflection</button>
            </section>
          </motion.div>
        )}

        {activeTab === 'gifts' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight">Gift Registry</h2>
              <button 
                onClick={() => setShowGiftForm(true)}
                className="p-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full"
              >
                <Plus size={20} />
              </button>
            </div>

            <AnimatePresence>
              {showGiftForm && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4 overflow-hidden"
                >
                  <div className="space-y-1">
                    <label className="label-micro">Gift Name</label>
                    <input 
                      type="text"
                      value={newGift.name}
                      onChange={(e) => setNewGift({ ...newGift, name: e.target.value })}
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm"
                      placeholder="e.g. Vintage Watch"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="label-micro">Status</label>
                      <select 
                        value={newGift.status}
                        onChange={(e) => setNewGift({ ...newGift, status: e.target.value as any })}
                        className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm appearance-none"
                      >
                        <option value="idea">Idea / Wishlist</option>
                        <option value="given">Already Given</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="label-micro">Price ($)</label>
                      <input 
                        type="number"
                        value={newGift.price}
                        onChange={(e) => setNewGift({ ...newGift, price: e.target.value })}
                        className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowGiftForm(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                    <button onClick={addGift} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm">Add to Registry</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="label-micro text-zinc-400">Wishlist & Ideas</p>
                {person.gifts?.filter((g: any) => g.status === 'idea').length > 0 ? (
                  person.gifts.filter((g: any) => g.status === 'idea').map((gift: any) => (
                    <div key={gift.id} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{gift.name}</p>
                          {gift.price && <p className="text-[10px] text-zinc-400 font-bold">${gift.price}</p>}
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          const giftRef = doc(db, 'people', id!, 'gifts', gift.id);
                          await setDoc(giftRef, { status: 'given', date: new Date().toISOString() }, { merge: true });
                          setPerson((prev: any) => ({
                            ...prev,
                            gifts: prev.gifts.map((g: any) => g.id === gift.id ? { ...g, status: 'given' } : g)
                          }));
                        }}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
                      >
                        Mark Given
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-zinc-100/50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400">No gift ideas yet. Use the AI to brainstorm!</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="label-micro text-zinc-400">Gift History</p>
                {person.gifts?.filter((g: any) => g.status === 'given').length > 0 ? (
                  person.gifts.filter((g: any) => g.status === 'given').map((gift: any) => (
                    <div key={gift.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-transparent flex justify-between items-center opacity-70">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded-lg">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{gift.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Given in {new Date(gift.date || Date.now()).getFullYear()}</p>
                        </div>
                      </div>
                      {gift.price && <p className="text-xs font-bold text-zinc-400">${gift.price}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-4">No history recorded.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'timeline' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight">Relationship Timeline</h2>
            </div>
            {/* Timeline content already exists below in the original code, 
                but we'll move it here for better organization */}
            <div className="space-y-4">
              {/* Timeline content */}
            </div>
          </motion.div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editData && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-8 overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-xl font-bold mb-6">Edit Profile</h2>
              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">Nickname</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={editData.nickname || ''}
                      onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">Birthday</label>
                    <input
                      type="date"
                      required
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                      value={editData.birthday || ''}
                      onChange={(e) => setEditData({ ...editData, birthday: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Category</label>
                  <select
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                    value={editData.category || ''}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  >
                    <option value="friend">Friend</option>
                    <option value="family">Family</option>
                    <option value="partner">Partner</option>
                    <option value="coworker">Coworker</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Interests (for AI jokes/facts)</label>
                  <input
                    type="text"
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Eagles, Dodgers, Warriors"
                    value={editData.interests || ''}
                    onChange={(e) => setEditData({ ...editData, interests: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Notes</label>
                  <textarea
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                    value={editData.notes || ''}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-4 text-sm font-bold text-zinc-500"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
