import React from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, ChevronRight, MessageSquare, Key } from 'lucide-react';
import Navigation from '../components/Navigation';
import HelpTip from '../components/HelpTip';
import EmptyState from '../components/EmptyState';

export default function Groups() {
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Join by code states
  const [joinCodeInput, setJoinCodeInput] = React.useState('');
  const [isJoining, setIsJoining] = React.useState(false);
  const [joinError, setJoinError] = React.useState('');

  const fetchGroups = async () => {
    if (!firebaseUser) return;
    try {
      const groupsRef = collection(db, 'rooms');
      const qMembers = query(
        groupsRef, 
        where('members', 'array-contains', firebaseUser.uid)
      );
      const membersSnapshot = await getDocs(qMembers);
      const membersData = membersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setGroups(membersData.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)));
    } catch (err: any) {
      console.error("Error fetching groups:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGroups();
  }, [firebaseUser, user?.email]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !joinCodeInput.trim()) return;

    setIsJoining(true);
    setJoinError('');

    const rawCode = joinCodeInput.trim();
    const cleanedCode = rawCode.replace(/\s+/g, '').replace(/[^a-zA-Z0-9-_]/g, '');
    const normalizedCode = cleanedCode.toLowerCase();

    try {
      const groupsRef = collection(db, 'rooms');
      
      // Query 1: normalized_join_code
      let querySnapshot = await getDocs(query(groupsRef, where('normalized_join_code', '==', normalizedCode)));

      // Query 2: exact match on join_code
      if (querySnapshot.empty && cleanedCode) {
        querySnapshot = await getDocs(query(groupsRef, where('join_code', '==', cleanedCode)));
      }

      // Query 3: exact match on invite_code
      if (querySnapshot.empty && cleanedCode) {
        querySnapshot = await getDocs(query(groupsRef, where('invite_code', '==', cleanedCode)));
      }

      // Query 4: uppercase match for legacy codes like PARTY-X7K2Q9
      if (querySnapshot.empty && cleanedCode) {
        const upper = cleanedCode.toUpperCase();
        querySnapshot = await getDocs(query(groupsRef, where('join_code', '==', upper)));
        if (querySnapshot.empty) {
          const partyUpper = upper.startsWith('PARTY-') ? upper : `PARTY-${upper}`;
          querySnapshot = await getDocs(query(groupsRef, where('join_code', '==', partyUpper)));
        }
      }

      if (querySnapshot.empty) {
        setJoinError('Invalid code — double check and try again');
        setIsJoining(false);
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();

      if (!groupData.members?.includes(firebaseUser.uid)) {
        await updateDoc(doc(db, 'rooms', groupDoc.id), {
          members: arrayUnion(firebaseUser.uid),
          [`roles.${firebaseUser.uid}`]: groupData.roles?.[firebaseUser.uid] || 'guest',
          [`attendance.${firebaseUser.uid}`]: groupData.attendance?.[firebaseUser.uid] || 'undecided',
          [`rsvps.${firebaseUser.uid}`]: groupData.rsvps?.[firebaseUser.uid] || 'maybe'
        });
      }

      navigate(`/rooms/${groupDoc.id}`);
    } catch (err) {
      console.error("Error joining room by code:", err);
      setJoinError('Invalid code — double check and try again');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="pb-32 pt-[calc(1.5rem+var(--sat))] px-4 max-w-2xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Party Planning Rooms</h1>
            <HelpTip 
              title="What is a Party Room?" 
              content="Secret spaces for co-organizing surprise birthdays, tracking RSVPs, dividing tasks, and collecting gift ideas without the guest of honor knowing!" 
            />
          </div>
          <p className="text-zinc-500 text-sm">Secret spaces for party planning & surprise celebrations</p>
        </div>
        <Link to="/rooms/create" className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105 transition-all shadow-md shadow-emerald-500/20" title="Create Room">
          <Plus size={22} />
        </Link>
      </header>

      {/* JOIN WITH CODE CARD */}
      <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 rounded-3xl p-5 shadow-sm dark:shadow-lg space-y-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Key size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Join a Party Room</h3>
            <p className="text-xs text-zinc-400">Enter a party room join code to jump in as a guest</p>
          </div>
        </div>

        <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={joinCodeInput}
            onChange={(e) => {
              setJoinCodeInput(e.target.value.replace(/\s+/g, ''));
              if (joinError) setJoinError('');
            }}
            placeholder="e.g. Alex or Sarah30"
            className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm uppercase tracking-wider outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isJoining || !joinCodeInput.trim()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isJoining ? 'Joining...' : 'Join Room'}
          </button>
        </form>
        {joinError && (
          <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-xl text-center">
            {joinError}
          </p>
        )}
      </div>

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
                  to={`/rooms/${group.id}`}
                  className="block p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-700 border-t border-t-white/5 shadow-sm dark:shadow-lg hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-emerald-500 transition-colors">{group.code_name || group.name}</h3>
                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Secret for {group.person_name}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-700">
                    <div className="flex -space-x-2">
                      {((group.members || []) as string[]).filter((m: string) => !(user?.blocked_uids || []).includes(m)).slice(0, 4).map((m: string, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-950 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </div>
                      ))}
                      {((group.members || []) as string[]).filter((m: string) => !(user?.blocked_uids || []).includes(m)).length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                          +{((group.members || []) as string[]).filter((m: string) => !(user?.blocked_uids || []).includes(m)).length - 4}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MessageSquare size={14} />
                      <span className="text-xs font-bold uppercase tracking-widest font-mono">{group.join_code || group.invite_code}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState 
            icon={Users}
            title="No active party planning rooms"
            description="Start a secret planning room to organize a friend's birthday celebration with mutual friends, or enter a join code above!"
            actionLabel="Create Room"
            actionLink="/rooms/create"
          />
        )}
      </section>

      <Navigation />
    </div>
  );
}
