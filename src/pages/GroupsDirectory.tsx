import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  arrayUnion, 
  doc, 
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Zap, 
  Trophy, 
  ChevronRight, 
  Clock, 
  LogOut, 
  Search, 
  Sparkles, 
  UserPlus,
  Compass
} from 'lucide-react';
import Navigation from '../components/Navigation';

// Helper to generate a unique 6-character uppercase invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function GroupsDirectory() {
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();
  
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAura, setTotalAura] = useState(0);
  
  // Join Group State
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Create Group Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('Friend Circle'); // Friend Circle, Sports Team, Study Group, Family
  const [triggerTime, setTriggerTime] = useState('12:00');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Check for invite code in URL query dynamic parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setInviteCodeInput(joinCode.trim().toUpperCase());
    }
  }, []);

  // Load joined Groups & Aura
  useEffect(() => {
    if (!firebaseUser) return;

    const q = query(
      collection(db, 'spark_groups'),
      where('members', 'array-contains', firebaseUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const groupsList: any[] = [];
      let totalAuraAccumulator = 0;

      for (const d of snapshot.docs) {
        const groupData = d.data();
        const groupId = d.id;

        // Fetch user's aura in this group
        let userAura = 0;
        try {
          const userAuraDocRef = doc(db, 'spark_groups', groupId, 'aura', firebaseUser.uid);
          const userAuraDocSnap = await getDoc(userAuraDocRef);
          if (userAuraDocSnap.exists()) {
            userAura = userAuraDocSnap.data().total_aura || 0;
          }
        } catch (e) {
          console.error("Error loading aura for group:", groupId, e);
        }

        totalAuraAccumulator += userAura;

        groupsList.push({
          id: groupId,
          ...groupData,
          userAura
        });
      }

      setGroups(groupsList);
      setTotalAura(totalAuraAccumulator);
      setLoading(false);
    }, (error) => {
      console.error("Error loading groups:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Handle Joining a Group
  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !inviteCodeInput.trim()) return;

    setJoinLoading(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      const cleanedCode = inviteCodeInput.trim().toUpperCase();
      const q = query(
        collection(db, 'spark_groups'),
        where('invite_code', '==', cleanedCode)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setJoinError("No group found with that invite code. Please check and try again.");
        setJoinLoading(false);
        return;
      }

      const targetGroupDoc = querySnapshot.docs[0];
      const targetGroupData = targetGroupDoc.data();
      const targetGroupId = targetGroupDoc.id;

      if (targetGroupData.members?.includes(firebaseUser.uid)) {
        setJoinError("You are already a member of this group!");
        setJoinLoading(false);
        return;
      }

      // Add to members
      await updateDoc(doc(db, 'spark_groups', targetGroupId), {
        members: arrayUnion(firebaseUser.uid)
      });

      // Initialize Aura document for the user
      await setDoc(doc(db, `spark_groups/${targetGroupId}/aura`, firebaseUser.uid), {
        total_aura: 10, // Welcoming Aura!
        spent_aura: 0,
        history: [{
          points: 10,
          reason: "Joined group",
          created_at: new Date().toISOString()
        }]
      });

      // Update members list
      setInviteCodeInput('');
      setJoinSuccess(`Successfully joined "${targetGroupData.name}"!`);
      setTimeout(() => setJoinSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error joining group:", err);
      setJoinError("Failed to join group. Please try again.");
    } finally {
      setJoinLoading(false);
    }
  };

  // Handle Creating a Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !groupName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      const code = generateInviteCode();
      const newGroup = {
        name: groupName.trim(),
        type: groupType,
        created_by: firebaseUser.uid,
        members: [firebaseUser.uid],
        invite_code: code,
        trigger_time: triggerTime,
        used_questions: [],
        created_at: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'spark_groups'), newGroup);

      // Initialize Aura document
      await setDoc(doc(db, `spark_groups/${docRef.id}/aura`, firebaseUser.uid), {
        total_aura: 20, // Founder Aura!
        spent_aura: 0,
        history: [{
          points: 20,
          reason: "Founded the group",
          created_at: new Date().toISOString()
        }]
      });

      setGroupName('');
      setShowCreateModal(false);
      navigate(`/groups/${docRef.id}`);
    } catch (err: any) {
      console.error("Error creating group:", err);
      setCreateError("Could not create group. Please check connection and try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div id="groups-directory-page" className="pb-36 pt-[calc(1.5rem+var(--sat))] px-4 bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Circles & Hubs</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Real-time games, chat logs & collaborative leaderboards</p>
          </div>
          <button 
            id="open-create-group-modal"
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold shadow-lg shadow-emerald-500/10 cursor-pointer transition-all hover:scale-105"
          >
            <Plus size={18} />
            <span>Create hub</span>
          </button>
        </header>

        {/* Aura Dashboard Banner */}
        <div className="relative p-6 rounded-3xl overflow-hidden bg-gradient-to-tr from-emerald-500 via-teal-600 to-indigo-600 text-white shadow-xl">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
            <Trophy size={180} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider">
                <Sparkles size={12} className="animate-pulse" />
                <span>Your standing</span>
              </span>
              <h2 className="text-xl font-extrabold">All-Time Cumulative Aura</h2>
              <p className="text-emerald-100 text-sm max-w-md">Earned by answering daily social deduction questions and showing up for friends!</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-300 drop-shadow-sm font-mono leading-none">
                {totalAura}
              </span>
              <div className="text-left font-bold text-amber-200 text-xs uppercase tracking-widest">
                Aura<br />Points
              </div>
            </div>
          </div>
        </div>

        {/* Quick Join Container */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="text-emerald-500" size={20} />
            <h3 className="font-extrabold text-base">Join Circle with a Code</h3>
          </div>
          <form onSubmit={handleJoinGroup} className="flex gap-2.5">
            <div className="relative flex-1">
              <input 
                id="join-code-input"
                type="text"
                placeholder="PRO45Y"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                maxLength={9}
                className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center text-lg font-black tracking-widest placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
              />
            </div>
            <button 
              id="submit-join-group"
              type="submit" 
              disabled={joinLoading || !inviteCodeInput.trim()}
              className="px-6 py-3.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 rounded-2xl font-bold transition-all shadow-sm cursor-pointer"
            >
              {joinLoading ? "Joining..." : "Join Circle"}
            </button>
          </form>
          
          <AnimatePresence>
            {joinError && (
              <motion.p 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-bold text-center"
              >
                ⚠️ {joinError}
              </motion.p>
            )}
            {joinSuccess && (
              <motion.p 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-emerald-500 dark:text-emerald-400 text-xs font-bold text-center"
              >
                ✨ {joinSuccess}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Directory Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-extrabold text-lg flex items-center gap-2">
              <Users size={18} className="text-zinc-400" />
              <span>Your Active Hubs ({groups.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : groups.length > 0 ? (
            <div id="joined-groups-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="group relative"
                >
                  <Link 
                    to={`/groups/${group.id}`}
                    className="block p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-emerald-500/20 dark:hover:border-emerald-500/20 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md">
                          {group.type || 'Friend Circle'}
                        </span>
                        <h4 className="font-extrabold text-base leading-tight group-hover:text-emerald-500 transition-colors">
                          {group.name}
                        </h4>
                      </div>
                      <ChevronRight size={18} className="text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-zinc-400" />
                        <span>Daily trigger: {group.trigger_time || "12:00"}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy size={13} className="text-amber-500" />
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">+{group.userAura || 0} Aura</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3.5 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold tracking-wider text-zinc-400 border border-zinc-100 dark:border-zinc-800">
                        CODE: <span className="text-zinc-900 dark:text-white font-extrabold">{group.invite_code}</span>
                      </div>
                      
                      <div className="text-xs text-zinc-400 font-bold">
                        {group.members?.length || 1} Member{(group.members?.length || 1) !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-300">
                <Compass size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-md">Welcome to Circles</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Create a custom circle for your friend group or join one with an invite code. Play daily guess games and connect live.
                </p>
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold rounded-2xl shadow-sm hover:scale-105 transition-all text-xs"
                >
                  Create a Hub
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md p-6 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 space-y-6"
            >
              <div>
                <h3 className="text-xl font-extrabold">Create a Circle Hub</h3>
                <p className="text-xs text-zinc-500">Create an independent, real-time social cell for your friends or sports squad.</p>
              </div>

              {createError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-500 text-center text-xs font-bold animate-shake">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hub Name</label>
                  <input 
                    id="new-group-name"
                    type="text" 
                    required
                    placeholder="e.g. Wednesday Hoop Club"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded-xl text-sm font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Hub Type</label>
                    <select
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Friend Circle">Friend Circle</option>
                      <option value="Sports Team">Sports Team</option>
                      <option value="Group Chat Cell">Group Chat Cell</option>
                      <option value="Work Squad">Work Squad</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Daily Guess Time</label>
                    <input 
                      type="time" 
                      required
                      value={triggerTime}
                      onChange={(e) => setTriggerTime(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded-xl text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed pt-1">
                  💡 **Daily Spark Trigger**: On this time each day, Spark will pick a secret member of this hub to be the "Subject" of 3 AI-crafted questions. Answers are completely anonymous until guessing phase reveals who is who!
                </div>

                <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    id="submit-create-group"
                    type="submit"
                    disabled={createLoading || !groupName.trim()}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                  >
                    {createLoading ? "Creating..." : "Create Hub"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navigation />
    </div>
  );
}
