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
  Circle
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { getDaysUntil, formatDate, cn, getRelationshipScore } from '../lib/utils';
import { Gift, MessageSquare } from 'lucide-react';

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
  const { user, token } = useAuth();
  const [people, setPeople] = React.useState<any[]>([]);
  const [analytics, setAnalytics] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchPeople = async () => {
    try {
      const [peopleRes, analyticsRes] = await Promise.all([
        fetch('/api/people', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!peopleRes.ok || !analyticsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const peopleData = await peopleRes.json();
      const analyticsData = await analyticsRes.json();
      
      // Fetch tasks for each person to show in planning overview
      const peopleWithTasks = await Promise.all(peopleData.map(async (p: any) => {
        const tasksRes = await fetch(`/api/tasks/${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
        const tasks = await tasksRes.json();
        return { ...p, tasks };
      }));

      setPeople(peopleWithTasks);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPeople();
  }, [token]);

  const toggleTask = async (taskId: number, completed: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !completed }),
      });
      fetchPeople(); // Refresh
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

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="pb-24 pt-6 px-4 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RelateOS</h1>
          <p className="text-zinc-500 text-sm">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-3">
          <button className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Bell size={20} />
          </button>
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
          className="p-4 rounded-2xl bg-zinc-900 text-white space-y-1"
        >
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total Birthdays</p>
          <p className="text-3xl font-bold">{analytics?.totalPeople || 0}</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-emerald-500 text-white space-y-1"
        >
          <p className="text-xs text-emerald-100 uppercase tracking-wider font-semibold">Streak</p>
          <p className="text-3xl font-bold">12 🔥</p>
        </motion.div>
      </section>

      {/* Upcoming */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <Link to="/people" className="text-sm text-zinc-500 hover:text-zinc-900">View all</Link>
        </div>
        <div className="space-y-3">
          {upcoming.length > 0 ? upcoming.map((person, i) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link 
                to={`/person/${person.id}`}
                className="flex items-center p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xl overflow-hidden">
                  {person.photo_url ? (
                    <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    person.name[0]
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-semibold">{person.name}</h3>
                  <p className="text-xs text-zinc-500">{formatDate(person.birthday)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    <AnimatedNumber value={getDaysUntil(person.birthday)} /> days
                  </p>
                  <p className="text-[10px] text-zinc-400 uppercase">Remaining</p>
                </div>
              </Link>
            </motion.div>
          )) : (
            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 text-sm">No birthdays added yet.</p>
              <Link to="/add" className="mt-2 inline-block text-emerald-500 font-medium">Add your first person</Link>
            </div>
          )}
        </div>
      </section>

      {/* Countdown Dashboard (Lightweight Project Manager) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock size={20} className="text-zinc-400" />
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
                className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-6 shadow-sm"
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
                          if (t) toggleTask(t.id, false);
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
                          if (t) toggleTask(t.id, false);
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
      <section className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Star className="text-amber-500" size={18} fill="currentColor" />
          <h2 className="text-lg font-semibold">Priority Intelligence</h2>
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
      <nav className="fixed bottom-6 left-4 right-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-full p-2 flex justify-around items-center shadow-2xl z-50">
        <Link to="/" className="p-3 text-emerald-500"><Calendar size={24} /></Link>
        <Link to="/people" className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><Users size={24} /></Link>
        <Link to="/add" className="p-4 bg-zinc-900 text-white rounded-full -mt-12 shadow-xl hover:scale-105 transition-transform"><Plus size={28} /></Link>
        <Link to="/analytics" className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><BarChart3 size={24} /></Link>
        <Link to="/settings" className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><Settings size={24} /></Link>
      </nav>
    </div>
  );
}
