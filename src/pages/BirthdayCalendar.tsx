import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, Sparkles, Star, Cake } from 'lucide-react';
import { motion } from 'motion/react';
import { getDaysUntil, getTurningAge, cn } from '../lib/utils';
import { HealthScoreCompactBadge } from '../components/HealthScoreBadge';
import Navigation from '../components/Navigation';
import AuraHeaderBadge from '../components/AuraHeaderBadge';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CalendarEntry {
  personId: string;
  personName: string;
  personPhotoUrl?: string;
  personCategory: string;
  isCloseFriend?: boolean;
  label: string;
  date: string;
  month: number;
  day: number;
  type: 'birthday' | 'anniversary' | 'custom';
  year_unknown: boolean;
  person: any;
}

const getAnniversaryMilestone = (dateStr: string, yearUnknown: boolean) => {
  if (yearUnknown) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || isNaN(year) || year === 1900 || year === 2000) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventThisYear = new Date(today.getFullYear(), (month || 1) - 1, day || 1);
  
  let targetYear = today.getFullYear();
  if (eventThisYear < today) {
    targetYear++;
  }
  const count = targetYear - year;
  if (count <= 0) return null;
  const suffix = ['st', 'nd', 'rd'][((count + 90) % 100 - 10) % 10 - 1] || 'th';
  return `${count}${suffix} Anniversary`;
};

export default function BirthdayCalendar() {
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchPeople = async () => {
    if (!firebaseUser) return;
    try {
      const peopleRef = collection(db, 'people');
      const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const blockedUids = user?.blocked_uids || [];
      const visibleData = data.filter((p: any) => !p.host_uid || !blockedUids.includes(p.host_uid));

      // Efficient parallel fetch of events subcollection for each person
      const peopleWithEvents = await Promise.all(
        visibleData.map(async (person: any) => {
          try {
            const eventsRef = collection(db, 'people', person.id, 'events');
            const eventsSnap = await getDocs(eventsRef);
            const events = eventsSnap.docs.map(eDoc => ({ id: eDoc.id, ...eDoc.data() }));
            return { ...person, events };
          } catch (err) {
            console.error(`Failed to fetch events for person ${person.id}:`, err);
            return { ...person, events: [] };
          }
        })
      );

      setPeople(peopleWithEvents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPeople();
  }, [firebaseUser]);

  // Flatten people & their events into individual calendar entries
  const calendarEntries = React.useMemo(() => {
    const entries: CalendarEntry[] = [];
    people.forEach((person) => {
      if (person.birthday && !person.birthday_unset) {
        const [y, m, d] = person.birthday.split('-').map(Number);
        entries.push({
          personId: person.id,
          personName: person.name,
          personPhotoUrl: person.photo_url,
          personCategory: person.category,
          isCloseFriend: person.isCloseFriend,
          label: 'Birthday',
          date: person.birthday,
          month: (m || 1) - 1,
          day: d || 1,
          type: 'birthday',
          year_unknown: !!person.birthYearUnknown,
          person
        });
      }

      if (Array.isArray(person.events)) {
        person.events.forEach((evt: any) => {
          if (!evt.date) return;
          const [ey, em, ed] = evt.date.split('-').map(Number);
          entries.push({
            personId: person.id,
            personName: person.name,
            personPhotoUrl: person.photo_url,
            personCategory: person.category,
            isCloseFriend: person.isCloseFriend,
            label: evt.label || (evt.type === 'anniversary' ? 'Anniversary' : 'Event'),
            date: evt.date,
            month: (em || 1) - 1,
            day: ed || 1,
            type: evt.type || 'custom',
            year_unknown: !!evt.year_unknown,
            person
          });
        });
      }
    });
    return entries;
  }, [people]);

  // Group flattened calendar entries by month, sorted by day
  const groupedEntries = MONTHS.map((month, index) => {
    const monthEntries = calendarEntries
      .filter(entry => entry.month === index)
      .sort((a, b) => a.day - b.day);
    return { month, entries: monthEntries };
  }).filter(group => group.entries.length > 0);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FDF3EC] dark:bg-zinc-950 pb-32">
      <header className="p-6 pt-[calc(1.5rem+var(--sat))] bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-black tracking-tight">Birthday Calendar</h1>
          </div>
          <AuraHeaderBadge />
        </div>
      </header>

      <div className="p-6 space-y-10 max-w-2xl mx-auto">
        {groupedEntries.length > 0 ? groupedEntries.map((group, i) => (
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
              {group.entries.map((entry) => {
                const daysLeft = getDaysUntil(entry.date);
                const isUrgent = daysLeft <= 7;
                const [y, m, d] = entry.date.split('-').map(Number);
                const dateObj = new Date(y || 2000, (m || 1) - 1, d || 1);
                const ordinalDay = `${dateObj.getDate()}${['st', 'nd', 'rd'][((dateObj.getDate() + 90) % 100 - 10) % 10 - 1] || 'th'}`;
                
                let detailText = '';
                if (entry.type === 'birthday') {
                  if (!entry.year_unknown && y && y !== 1900 && y !== 2000) {
                    detailText = `${ordinalDay} • Turning ${getTurningAge(entry.date)} • ${entry.personCategory}`;
                  } else {
                    detailText = `${ordinalDay} • ${entry.personCategory}`;
                  }
                } else if (entry.type === 'anniversary') {
                  const milestone = getAnniversaryMilestone(entry.date, entry.year_unknown);
                  if (milestone) {
                    detailText = `${ordinalDay} • ${milestone} • ${entry.personCategory}`;
                  } else {
                    detailText = `${ordinalDay} • Anniversary • ${entry.personCategory}`;
                  }
                } else {
                  detailText = `${ordinalDay} • ${entry.label} • ${entry.personCategory}`;
                }

                return (
                  <Link 
                    key={`${entry.personId}_${entry.type}_${entry.label}_${entry.date}`}
                    to={`/person/${entry.personId}`}
                    className="group flex items-center p-4 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg font-bold overflow-hidden border-2 border-white dark:border-zinc-900 shrink-0">
                      {entry.personPhotoUrl ? (
                        <img src={entry.personPhotoUrl} alt={entry.personName} className="w-full h-full object-cover" />
                      ) : (
                        entry.personName[0]
                      )}
                    </div>
                    
                    <div className="ml-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold group-hover:text-accent-500 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-zinc-900 dark:text-white truncate">
                          {entry.personName}
                          {entry.isCloseFriend && (
                            <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0 inline-block align-middle" />
                          )}
                        </h3>
                        {entry.type === 'birthday' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200/50 dark:border-pink-800/40 shrink-0">
                            <Cake size={11} className="shrink-0" />
                            Birthday
                          </span>
                        ) : entry.type === 'anniversary' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40 shrink-0">
                            Anniversary
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/40 shrink-0">
                            {entry.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">
                          {detailText}
                        </p>
                        <HealthScoreCompactBadge input={{ person: entry.person, memories: entry.person?.memories, gifts: entry.person?.gifts }} />
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
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
              <h3 className="font-bold text-lg">No dates yet</h3>
              <p className="text-zinc-500 text-sm max-w-[240px] mx-auto">Add your friends and family to see their birthdays and important dates in your calendar.</p>
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
