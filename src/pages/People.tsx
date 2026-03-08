import React from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  Share2, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Globe, 
  MessageSquare,
  Users,
  Plus
} from 'lucide-react';
import { cn, getDaysUntil } from '../lib/utils';
import Navigation from '../components/Navigation';
import { Link } from 'react-router-dom';

export default function People() {
  const { firebaseUser } = useAuth();
  const [people, setPeople] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!firebaseUser) return;

    const peopleRef = collection(db, 'people');
    const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPeople(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const filteredPeople = people.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => getDaysUntil(a.birthday) - getDaysUntil(b.birthday));

  const handleCopy = (id: string) => {
    const url = `${window.location.origin}/shared/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
      <header className="p-8 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl text-white">
              <Globe size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Shared Birthday Pages</h1>
          </div>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Every person gets a public landing page. Share the link with friends to collect video, voice, and text surprises that reveal on their birthday.
          </p>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        {filteredPeople.length > 0 ? (
          <div className="grid gap-4">
            {filteredPeople.map((person, i) => {
              const daysLeft = getDaysUntil(person.birthday);
              const isSoon = daysLeft <= 30;

              return (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold overflow-hidden border-2 border-white dark:border-zinc-900">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                        ) : (
                          person.name[0]
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{person.name}</h3>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Birthday in {daysLeft} days
                        </p>
                      </div>
                    </div>
                    {isSoon && (
                      <div className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                        Active Now
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleCopy(person.id)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all",
                        copiedId === person.id 
                          ? "bg-emerald-500 text-white" 
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      )}
                    >
                      {copiedId === person.id ? (
                        <>
                          <Check size={18} />
                          Link Copied
                        </>
                      ) : (
                        <>
                          <Copy size={18} />
                          Copy Link
                        </>
                      )}
                    </button>
                    <Link 
                      to={`/shared/${person.id}`}
                      target="_blank"
                      className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm hover:opacity-90 transition-all"
                    >
                      <ExternalLink size={18} />
                      Preview
                    </Link>
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MessageSquare size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Surprise Box</span>
                    </div>
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-800" />
                      ))}
                      <div className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-bold">
                        +
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 space-y-6">
            <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-[2.5rem] flex items-center justify-center mx-auto text-zinc-300">
              <Users size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black">No one to celebrate yet</h3>
              <p className="text-zinc-500 text-sm max-w-[280px] mx-auto leading-relaxed">
                Add your friends and family to start collecting birthday surprises for them.
              </p>
            </div>
            <Link 
              to="/add"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-500/20 hover:scale-105 transition-transform"
            >
              <Plus size={20} />
              Add Someone
            </Link>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
