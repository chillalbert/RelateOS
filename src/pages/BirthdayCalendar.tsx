import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { getDaysUntil, cn } from '../lib/utils';
import Navigation from '../components/Navigation';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BirthdayCalendar() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchPeople = async () => {
    if (!firebaseUser) return;
    try {
      const peopleRef = collection(db, 'people');
      const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPeople(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPeople();
  }, [firebaseUser]);

  // Group people by month
  const groupedPeople = MONTHS.map((month, index) => {
    const monthPeople = people.filter(p => {
      const [year, m, d] = p.birthday.split('-').map(Number);
      return (m - 1) === index;
    }).sort((a, b) => {
      const dayA = Number(a.birthday.split('-')[2]);
      const dayB = Number(b.birthday.split('-')[2]);
      return dayA - dayB;
    });
    return { month, people: monthPeople };
  }).filter(group => group.people.length > 0);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
      <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black tracking-tight">Birthday Calendar</h1>
        </div>
      </header>

      <div className="p-6 space-y-10 max-w-2xl mx-auto">
        {groupedPeople.length > 0 ? groupedPeople.map((group, i) => (
          <motion.section 
            key={group.month}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 px-1">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{group.month}</h2>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <div className="grid gap-3">
              {group.people.map((person) => {
                const daysLeft = getDaysUntil(person.birthday);
                const isUrgent = daysLeft <= 7;
                const [y, m, d] = person.birthday.split('-').map(Number);
                const bdayDate = new Date(y, m - 1, d);
                
                return (
                  <Link 
                    key={person.id}
                    to={`/person/${person.id}`}
                    className="group flex items-center p-4 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg font-bold overflow-hidden border-2 border-white dark:border-zinc-900">
                      {person.photo_url ? (
                        <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                      ) : (
                        person.name[0]
                      )}
                    </div>
                    
                    <div className="ml-4 flex-1">
                      <h3 className="font-bold group-hover:text-emerald-500 transition-colors">{person.name}</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">
                        {bdayDate.getDate()}{['st', 'nd', 'rd'][((bdayDate.getDate() + 90) % 100 - 10) % 10 - 1] || 'th'} • {person.category}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={cn(
                        "text-xs font-black",
                        isUrgent ? "text-amber-500" : "text-zinc-400"
                      )}>
                        {daysLeft === 0 ? "Today!" : `In ${daysLeft}d`}
                      </p>
                      {isUrgent && <Sparkles size={12} className="text-amber-500 ml-auto mt-1" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.section>
        )) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-300">
              <CalendarIcon size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-lg">No birthdays yet</h3>
              <p className="text-zinc-500 text-sm max-w-[240px] mx-auto">Add your friends and family to see them in your calendar.</p>
            </div>
            <Link 
              to="/add"
              className="inline-block px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-sm"
            >
              Add Someone
            </Link>
          </div>
        )}
      </div>
      <Navigation />
    </div>
  );
}
