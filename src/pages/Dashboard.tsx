import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Users, 
  BarChart3, 
  Settings, 
  Plus, 
  Bell, 
  Search,
  Heart,
  Clock,
  ChevronRight,
  Star,
  CheckCircle2,
  AlertCircle,
  Circle,
  Sparkles,
  Lightbulb,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { getDaysUntil, formatDate, cn, getRelationshipScore } from '../lib/utils';
import { Gift, MessageSquare, Sparkles as SparklesIcon } from 'lucide-react';
import confetti from 'canvas-confetti';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateGiftSuggestions, generateBirthdayMessage } from '../services/geminiService';

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;

    const duration = 1000;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}</span>;
};

export default function Dashboard() {
  const { user, firebaseUser, refreshUser } = useAuth();
  const [people, setPeople] = React.useState<any[]>([]);
  const [analytics, setAnalytics] = React.useState<any>(null);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [brainstormingPerson, setBrainstormingPerson] = React.useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatingMessagePerson, setGeneratingMessagePerson] = React.useState<any>(null);
  const [dashboardAiMessage, setDashboardAiMessage] = React.useState<any>(null);

  const handleGenerateDashboardMessage = async (person: any) => {
    setGeneratingMessagePerson(person);
    setIsGenerating(true);
    try {
      const memories = person.memories?.map((m: any) => m.content) || [];
      if (person.notes) memories.unshift(person.notes);
      
      const giftHistory = person.gifts?.filter((g: any) => g.status === 'given').map((g: any) => g.name) || [];
      const message = await generateBirthdayMessage({
        relationship: person.category,
        yearsKnown: 3,
        memories: memories.slice(0, 6),
        tone: 'heartfelt',
        length: 'medium',
        interests: person.interests,
        giftHistory
      });
      setDashboardAiMessage(message);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBrainstorm = async (person: any) => {
    setBrainstormingPerson(person);
    setIsGenerating(true);
    try {
      const suggestions = await generateGiftSuggestions({
        interests: person.notes || 'general interests',
        budget: 50,
        relationship: person.category,
        giftHistory: person.gifts?.filter((g: any) => g.status === 'given').map((g: any) => g.name)
      });
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSuggestion = async (suggestion: string) => {
    if (!brainstormingPerson) return;
    try {
      const giftsRef = collection(db, 'people', brainstormingPerson.id, 'gifts');
      await addDoc(giftsRef, {
        name: suggestion,
        status: 'idea',
        created_at: serverTimestamp()
      });
      setBrainstormingPerson(null);
      setAiSuggestions([]);
      fetchDashboardData(); // Refresh
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboardData = async () => {
    if (!firebaseUser) return;
    try {
      // Fetch People
      const peopleRef = collection(db, 'people');
      const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
      const querySnapshot = await getDocs(q);
      const peopleData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch Notifications
      const notifRef = collection(db, 'notifications');
      const nq = query(notifRef, where('user_id', '==', firebaseUser.uid));
      const nSnapshot = await getDocs(nq);
      const notifData = nSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
        .slice(0, 10);

      // Fetch tasks and gifts for each person
      const peopleWithDetails = await Promise.all(peopleData.map(async (p: any) => {
        const tasksRef = collection(db, 'people', p.id, 'tasks');
        const tSnapshot = await getDocs(tasksRef);
        const tasks = tSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const giftsRef = collection(db, 'people', p.id, 'gifts');
        const gSnapshot = await getDocs(giftsRef);
        const gifts = gSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { ...p, tasks, gifts };
      }));

      setPeople(peopleWithDetails);
      setNotifications(notifData);
      
      // Calculate simple analytics
      setAnalytics({
        totalPeople: peopleData.length,
      });
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        console.error("Firestore Permission Denied: Please check your Security Rules in the Firebase Console.");
      } else {
        console.error("Dashboard fetch error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDashboardData();
  }, [firebaseUser]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const toggleTask = async (personId: string, taskId: string, completed: boolean) => {
    try {
      const taskRef = doc(db, 'people', personId, 'tasks', taskId);
      // Use setDoc with merge to avoid "No document to update" if the document was somehow missing
      await setDoc(taskRef, { completed: !completed }, { merge: true });
      fetchDashboardData(); // Refresh
    } catch (err) {
      console.error(err);
    }
  };

  const upcoming = [...people]
    .sort((a, b) => getDaysUntil(a.birthday) - getDaysUntil(b.birthday))
    .slice(0, 5);

  const priorityPeople = [...people]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);

  const currentMonth = new Date().getMonth();
  const birthdaysThisMonth = people.filter(p => {
    const [y, m, d] = p.birthday.split('-').map(Number);
    return (m - 1) === currentMonth;
  }).sort((a, b) => {
    const dayA = Number(a.birthday.split('-')[2]);
    const dayB = Number(b.birthday.split('-')[2]);
    return dayA - dayB;
  });

  const handleWishBirthday = async (personId: string, personName: string) => {
    if (!firebaseUser || !user) return;
    try {
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });

      const userRef = doc(db, 'users', firebaseUser.uid);
      const newStreak = (user.streak || 0) + 1;
      await updateDoc(userRef, { streak: newStreak });
      
      // Log it as a memory
      const memoriesRef = collection(db, 'people', personId, 'memories');
      await addDoc(memoriesRef, {
        year: new Date().getFullYear(),
        type: 'milestone',
        content: `Wished a Happy Birthday! Streak increased to ${newStreak}.`,
        created_at: serverTimestamp()
      });

      // Mark card task as done if it exists
      const person = upcoming.find(p => p.id === personId);
      const cardTask = person?.tasks?.find((t: any) => t.title === 'Card Message');
      if (cardTask && !cardTask.completed) {
        await toggleTask(personId, cardTask.id, false);
      }

      await refreshUser();
      alert(`Happy Birthday wished to ${personName}! Your relationship streak is now ${newStreak} 🔥`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="pb-24 pt-[calc(1.5rem+var(--sat))] px-4 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RelateOS</h1>
          <p className="text-zinc-500 text-sm">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/groups/create" className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800" title="Join Group">
            <Users size={20} />
          </Link>
          <Link to="/notifications" className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 relative">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-zinc-900 rounded-full" />
            )}
          </Link>
          <button className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Search size={20} />
          </button>
        </div>
      </header>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 space-y-1 shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
        >
          <p className="label-micro text-zinc-400 dark:text-zinc-500">Total Birthdays</p>
          <p className="text-4xl font-black tracking-tighter"><AnimatedNumber value={analytics?.totalPeople || 0} /></p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-emerald-500 text-white space-y-1 shadow-xl shadow-emerald-500/20"
        >
          <p className="label-micro text-emerald-100">Relationship Streak</p>
          <p className="text-4xl font-black tracking-tighter">
            <AnimatedNumber value={user?.streak || 0} /> 🔥
          </p>
        </motion.div>
      </section>

      {/* Birthdays This Month */}
      <section className="space-y-4">
        <div className="flex justify-between items-end px-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Calendar size={16} />
            Birthdays This Month
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          {birthdaysThisMonth.length > 0 ? birthdaysThisMonth.map((person, i) => {
            const daysLeft = getDaysUntil(person.birthday);
            const isUrgent = daysLeft <= 1;
            const isSoon = daysLeft <= 7;
            const isSafe = daysLeft > 14;

            return (
              <motion.div
                key={`month-${person.id}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex-shrink-0 w-40"
              >
                <div className={cn(
                  "p-5 rounded-[32px] border-2 flex flex-col items-center text-center space-y-3 transition-all",
                  isUrgent ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50" :
                  isSoon ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50" :
                  isSafe ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50" :
                  "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"
                )}>
                  <Link to={`/person/${person.id}`} className="space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xl font-black overflow-hidden mx-auto border-2 border-white dark:border-zinc-900 shadow-sm">
                      {person.photo_url ? (
                        <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                      ) : (
                        person.name[0]
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold truncate w-32">{person.name.split(' ')[0]}</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">
                        {person.birthday.split('-')[2]} {new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2000, Number(person.birthday.split('-')[1]) - 1, 1))}
                      </p>
                    </div>
                  </Link>
                  
                  <div className="space-y-1">
                    <p className={cn(
                      "text-xs font-black",
                      isUrgent ? "text-red-500" : isSoon ? "text-amber-600" : isSafe ? "text-emerald-600" : "text-zinc-500"
                    )}>
                      {daysLeft === 0 ? "Today! 🎂" : daysLeft === 1 ? "Tomorrow! 🎂" : `In ${daysLeft} days 🎂`}
                    </p>
                  </div>

                  <button 
                    onClick={() => handleGenerateDashboardMessage(person)}
                    className={cn(
                      "w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                      isUrgent ? "bg-red-500 text-white" : 
                      isSoon ? "bg-amber-500 text-white" :
                      "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    )}
                  >
                    <SparklesIcon size={10} />
                    AI Message
                  </button>
                </div>
              </motion.div>
            );
          }) : (
            <div className="w-full p-8 text-center bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 text-sm">No birthdays this month.</p>
            </div>
          )}
        </div>
      </section>

      {/* Countdown Dashboard (Lightweight Project Manager) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Clock size={16} />
            Countdown Dashboard
          </h2>
        </div>
        <div className="space-y-4">
          {upcoming.filter(p => getDaysUntil(p.birthday) <= 45).map((person) => {
            const daysLeft = getDaysUntil(person.birthday);
            const tasks = person.tasks || [];
            const completedTasks = tasks.filter((t: any) => t.completed).length;
            const totalTasks = tasks.length || 3; // Default tasks if none created
            const progress = (completedTasks / totalTasks) * 100;
            
            // Deadlines
            const giftDeadlineDays = daysLeft - 14;
            const cardDeadlineDays = daysLeft - 3;

            return (
              <motion.div 
                key={`plan-${person.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 card-premium space-y-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg font-bold">
                      {person.name[0]}
                    </div>
                    <div>
                      <h3 className="font-bold">{person.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold"><AnimatedNumber value={daysLeft} /> days remaining</span>
                        <div className="w-1 h-1 bg-zinc-300 rounded-full" />
                        <span className="text-[10px] text-emerald-500 font-bold uppercase">{Math.round(progress)}% Ready</span>
                      </div>
                    </div>
                  </div>
                  <Link to={`/person/${person.id}`} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                    <ChevronRight size={20} />
                  </Link>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {daysLeft === 0 && (
                    <button
                      onClick={() => handleWishBirthday(person.id, person.name)}
                      className="flex items-center justify-center gap-2 p-3 bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <Heart size={14} fill="currentColor" />
                      Wish Happy Birthday!
                    </button>
                  )}
                  {/* Gift Deadline */}
                  <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        tasks.find((t: any) => t.title === 'Gift Decision')?.completed ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                      )}>
                        <Gift size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Gift Decision</p>
                        <p className={cn(
                          "text-[10px] font-medium",
                          giftDeadlineDays < 0 && !tasks.find((t: any) => t.title === 'Gift Decision')?.completed ? "text-red-500" : "text-zinc-400"
                        )}>
                          {tasks.find((t: any) => t.title === 'Gift Decision')?.completed 
                            ? 'Completed' 
                            : giftDeadlineDays < 0 ? 'Overdue' : `Deadline: ${giftDeadlineDays} days`}
                        </p>
                      </div>
                    </div>
                    {!tasks.find((t: any) => t.title === 'Gift Decision')?.completed && (
                      <button 
                        onClick={() => {
                          const t = tasks.find((t: any) => t.title === 'Gift Decision');
                          if (t) toggleTask(person.id, t.id, false);
                        }}
                        className="text-[10px] font-bold text-emerald-500 uppercase hover:underline"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>

                  {/* Card Reminder */}
                  <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        tasks.find((t: any) => t.title === 'Card Message')?.completed ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                      )}>
                        <MessageSquare size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">Card Message</p>
                        <p className={cn(
                          "text-[10px] font-medium",
                          cardDeadlineDays < 0 && !tasks.find((t: any) => t.title === 'Card Message')?.completed ? "text-red-500" : "text-zinc-400"
                        )}>
                          {tasks.find((t: any) => t.title === 'Card Message')?.completed 
                            ? 'Completed' 
                            : cardDeadlineDays < 0 ? 'Overdue' : `Reminder: ${cardDeadlineDays} days`}
                        </p>
                      </div>
                    </div>
                    {!tasks.find((t: any) => t.title === 'Card Message')?.completed && (
                      <button 
                        onClick={() => {
                          const t = tasks.find((t: any) => t.title === 'Card Message');
                          if (t) toggleTask(person.id, t.id, false);
                        }}
                        className="text-[10px] font-bold text-emerald-500 uppercase hover:underline"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Priority Intelligence Section */}
      <section className="p-6 card-premium space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="text-amber-500" size={18} fill="currentColor" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Priority Intelligence</h2>
          </div>
          <span className="label-micro">Algo v1.2</span>
        </div>
        <div className="space-y-6">
          {priorityPeople.map((person) => {
            const score = getRelationshipScore(person);
            return (
              <div key={person.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold">
                      {person.name[0]}
                    </div>
                    <span className="text-sm font-bold">{person.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">{score}% Score</span>
                </div>
                <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      score > 80 ? "bg-emerald-500" : score > 50 ? "bg-amber-500" : "bg-zinc-400"
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-400 text-center pt-2">Algorithm based on interaction frequency, memories & importance</p>
      </section>

      {/* Navigation Bar */}
      <Navigation />

      {/* Brainstorm Modal */}
      <AnimatePresence>
        {brainstormingPerson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBrainstormingPerson(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[32px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-amber-500" size={20} />
                  <h3 className="font-black tracking-tight">Gift Brainstorm</h3>
                </div>
                <button onClick={() => setBrainstormingPerson(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase">Subject</p>
                <p className="text-lg font-black">{brainstormingPerson.name}</p>
              </div>

              <div className="space-y-4">
                {isGenerating ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
                    ))}
                    <p className="text-center text-xs text-zinc-400 font-bold uppercase animate-bounce">AI is thinking...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Based on your notes and relationship, here are some ideas. Tap one to save it to their registry.
                    </p>
                    <div className="space-y-2">
                      {aiSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => saveSuggestion(suggestion)}
                          className="w-full p-4 text-left bg-zinc-50 dark:bg-zinc-800 hover:bg-emerald-500 hover:text-white rounded-2xl transition-all group"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold">{suggestion}</span>
                            <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => handleBrainstorm(brainstormingPerson)}
                      className="w-full py-3 text-xs font-bold text-zinc-400 uppercase hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      Regenerate Ideas
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Message Dashboard Modal */}
      <AnimatePresence>
        {generatingMessagePerson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isGenerating) {
                  setGeneratingMessagePerson(null);
                  setDashboardAiMessage(null);
                }
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[32px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="text-emerald-500" size={20} />
                  <h3 className="font-black tracking-tight">AI Birthday Message</h3>
                </div>
                {!isGenerating && (
                  <button onClick={() => {
                    setGeneratingMessagePerson(null);
                    setDashboardAiMessage(null);
                  }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase">For</p>
                <p className="text-lg font-black">{generatingMessagePerson.name}</p>
              </div>

              <div className="space-y-4">
                {isGenerating ? (
                  <div className="space-y-3">
                    <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
                    <p className="text-center text-xs text-zinc-400 font-bold uppercase animate-bounce">AI is writing a personal message...</p>
                  </div>
                ) : dashboardAiMessage ? (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Short Text</p>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-sm italic">
                        "{dashboardAiMessage.shortText}"
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Card Message</p>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-sm italic">
                        "{dashboardAiMessage.cardMessage}"
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(dashboardAiMessage.cardMessage);
                        // Could add a toast here
                      }}
                      className="w-full py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl font-bold text-sm"
                    >
                      Copy Card Message
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Something went wrong. Please try again.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
