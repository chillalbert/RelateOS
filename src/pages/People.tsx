import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Search, Filter, MoreVertical, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRelationshipScore, cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function People() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editData, setEditData] = React.useState<any>(null);

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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const personRef = doc(db, 'people', editData.id);
      await updateDoc(personRef, {
        name: editData.name,
        nickname: editData.nickname,
        birthday: editData.birthday,
        category: editData.category,
        notes: editData.notes
      });
      fetchPeople();
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPeople = people.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.nickname?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">Your People</h1>
          <button className="p-2">
            <MoreVertical size={24} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name or nickname..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-none text-sm focus:ring-2 focus:ring-emerald-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        {filteredPeople.length > 0 ? filteredPeople.map((person, i) => {
          const score = getRelationshipScore(person);
          return (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link 
                to={`/person/${person.id}`}
                className="flex items-center p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold overflow-hidden">
                  {person.photo_url ? (
                    <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    person.name[0]
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-bold group-hover:text-emerald-500 transition-colors">{person.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">{person.category}</span>
                    <div className="w-1 h-1 bg-zinc-300 rounded-full" />
                    <div className="flex items-center gap-1">
                      <Heart size={10} className={cn(score > 70 ? "text-emerald-500" : "text-zinc-300")} fill={score > 70 ? "currentColor" : "none"} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">{score}% Score</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{person.birthday.split('-')[1]}/{person.birthday.split('-')[2]}</p>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold">Birthday</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      setEditData({ ...person });
                      setShowEditModal(true);
                    }}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <MoreVertical size={18} className="text-zinc-400" />
                  </button>
                </div>
              </Link>
            </motion.div>
          );
        }) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-400">
              <Search size={32} />
            </div>
            <p className="text-zinc-500 text-sm">No one found matching "{search}"</p>
          </div>
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
                    value={editData.name}
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
                      value={editData.birthday}
                      onChange={(e) => setEditData({ ...editData, birthday: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Category</label>
                  <select
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                    value={editData.category}
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
