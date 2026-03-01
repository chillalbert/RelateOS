import React from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Users, Plus, ChevronRight, Shield, MessageSquare } from 'lucide-react';
import Navigation from '../components/Navigation';

export default function Groups() {
  const { firebaseUser } = useAuth();
  const [groups, setGroups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchGroups = async () => {
    if (!firebaseUser) return;
    try {
      const groupsRef = collection(db, 'groups');
      // Query groups where user is a member
      const q = query(
        groupsRef, 
        where('members', 'array-contains', firebaseUser.uid),
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const groupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(groupsData);
    } catch (err) {
      console.error("Error fetching groups:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGroups();
  }, [firebaseUser]);

  return (
    <div className="pb-32 pt-6 px-4 max-w-2xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Group Planning</h1>
          <p className="text-zinc-500 text-sm">Collaborate on surprises</p>
        </div>
        <Link to="/groups/create" className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-emerald-500">
          <Plus size={24} />
        </Link>
      </header>

      <section className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : groups.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {groups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link 
                  to={`/groups/${group.id}`}
                  className="block p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <Shield size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-emerald-500 transition-colors">{group.code_name || group.name}</h3>
                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Secret for {group.person_name}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-800">
                    <div className="flex -space-x-2">
                      {group.members?.slice(0, 4).map((m: string, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </div>
                      ))}
                      {(group.members?.length || 0) > 4 && (
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                          +{(group.members?.length || 0) - 4}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MessageSquare size={14} />
                      <span className="text-xs font-bold uppercase">{group.invite_code}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-300">
              <Users size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold">No active groups</h3>
              <p className="text-sm text-zinc-500">Start a secret planning group for a friend's birthday or join an existing one.</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/groups/create" className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20">
                Create Group
              </Link>
              <Link to="/groups/create?join=true" className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-bold">
                Join with Code
              </Link>
            </div>
          </div>
        )}
      </section>

      <Navigation />
    </div>
  );
}
