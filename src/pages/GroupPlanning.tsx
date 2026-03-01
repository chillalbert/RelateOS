import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Users, Send, Plus, Vote, DollarSign, Shield, ChevronUp, Sparkles, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import { generateGiftSuggestions } from '../services/geminiService';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, where, serverTimestamp, arrayUnion, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function GroupPlanning() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const personId = searchParams.get('personId');
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [newIdea, setNewIdea] = React.useState('');
  const [isContributing, setIsContributing] = React.useState(false);
  const [contributionAmount, setContributionAmount] = React.useState('25');
  const [aiSuggestions, setAiSuggestions] = React.useState<any[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState('');
  const [joinError, setJoinError] = React.useState('');
  const [isJoiningLoading, setIsJoiningLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id || !firebaseUser) return;

    const groupRef = doc(db, 'groups', id);
    const unsubscribe = onSnapshot(groupRef, async (docSnap) => {
      if (docSnap.exists()) {
        const groupData = { id: docSnap.id, ...docSnap.data() } as any;
        
        // Fetch ideas
        const ideasRef = collection(db, 'groups', id, 'ideas');
        const ideasSnap = await getDocs(ideasRef);
        const ideas = ideasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch contributions
        const contributionsRef = collection(db, 'groups', id, 'contributions');
        const contributionsSnap = await getDocs(contributionsRef);
        const contributions = contributionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setGroup({ ...groupData, ideas, contributions });
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, firebaseUser]);

  const handleContribute = async () => {
    if (!id || !firebaseUser) return;
    try {
      const contributionsRef = collection(db, 'groups', id, 'contributions');
      await addDoc(contributionsRef, {
        user_id: firebaseUser.uid,
        user_name: user?.name || 'Anonymous',
        amount: parseFloat(contributionAmount),
        created_at: serverTimestamp()
      });
      setIsContributing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!group) return;
    setIsGeneratingSuggestions(true);
    const totalContributed = group.contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
    const suggestions = await generateGiftSuggestions({
      interests: group.person_notes || 'General interests',
      budget: totalContributed || 50,
      relationship: group.person_category || 'Friend'
    });
    if (suggestions) setAiSuggestions(suggestions);
    setIsGeneratingSuggestions(false);
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !inviteCode.trim()) return;
    
    setIsJoiningLoading(true);
    setJoinError('');
    
    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('invite_code', '==', inviteCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setJoinError('Invalid invite code. Please check and try again.');
        setIsJoiningLoading(false);
        return;
      }
      
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();
      
      // Add user to members if not already there
      if (!groupData.members?.includes(firebaseUser.uid)) {
        await updateDoc(doc(db, 'groups', groupDoc.id), {
          members: arrayUnion(firebaseUser.uid)
        });
      }
      
      navigate(`/groups/${groupDoc.id}`);
    } catch (err) {
      console.error(err);
      setJoinError('An error occurred while joining the group.');
    } finally {
      setIsJoiningLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const name = (e.target as any).name.value;
    const code_name = (e.target as any).code_name.value;
    try {
      const groupsRef = collection(db, 'groups');
      const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Fetch person details for context
      let person_name = 'Someone';
      let person_notes = '';
      let person_category = '';
      if (personId) {
        const personSnap = await getDoc(doc(db, 'people', personId));
        if (personSnap.exists()) {
          const pData = personSnap.data();
          person_name = pData.name;
          person_notes = pData.notes;
          person_category = pData.category;
        }
      }

      const docRef = await addDoc(groupsRef, {
        name,
        code_name,
        person_id: personId,
        person_name,
        person_notes,
        person_category,
        invite_code,
        created_by: firebaseUser.uid,
        members: [firebaseUser.uid],
        target_amount: 500,
        created_at: serverTimestamp()
      });
      navigate(`/groups/${docRef.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddIdea = async () => {
    if (!id || !newIdea.trim() || !firebaseUser) return;
    try {
      const ideasRef = collection(db, 'groups', id, 'ideas');
      await addDoc(ideasRef, {
        title: newIdea,
        description: '',
        user_id: firebaseUser.uid,
        votes: [],
        created_at: serverTimestamp()
      });
      setNewIdea('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleVote = async (ideaId: string, currentVotes: string[]) => {
    if (!id || !firebaseUser) return;
    try {
      const ideaRef = doc(db, 'groups', id, 'ideas', ideaId);
      if (currentVotes.includes(firebaseUser.uid)) {
        await updateDoc(ideaRef, {
          votes: currentVotes.filter(uid => uid !== firebaseUser.uid)
        });
      } else {
        await updateDoc(ideaRef, {
          votes: arrayUnion(firebaseUser.uid)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <header className="p-6 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft size={24} /></button>
          <h1 className="text-lg font-bold">{isJoining ? 'Join Planning Group' : 'Create Planning Group'}</h1>
          <div className="w-10" />
        </header>
        
        <div className="p-6 max-w-lg mx-auto space-y-8">
          <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800 rounded-2xl">
            <button 
              onClick={() => setIsJoining(false)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                !isJoining ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500"
              )}
            >
              Create New
            </button>
            <button 
              onClick={() => setIsJoining(true)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                isJoining ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500"
              )}
            >
              Join Existing
            </button>
          </div>

          {!isJoining ? (
            <form onSubmit={handleCreateGroup} className="space-y-6">
              <div className="p-6 bg-emerald-500 text-white rounded-3xl space-y-2 shadow-xl shadow-emerald-500/20">
                <Shield size={32} />
                <h2 className="text-xl font-bold">Social Surprise Mode</h2>
                <p className="text-sm opacity-90">Collaborate with friends in secret. The birthday person will never know.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Group Name</label>
                  <input name="name" required className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800" placeholder="e.g. Sarah's 30th Crew" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Secret Code Name</label>
                  <input name="code_name" className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800" placeholder="e.g. Project Cupcake" />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-xl">
                Start Planning
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinGroup} className="space-y-6">
              <div className="p-6 bg-zinc-900 text-white rounded-3xl space-y-2 shadow-xl">
                <Users size={32} className="text-emerald-500" />
                <h2 className="text-xl font-bold">Join the Crew</h2>
                <p className="text-sm opacity-90 text-zinc-400">Enter the 6-character invite code shared by your friends to join the planning group.</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Invite Code</label>
                  <input 
                    value={inviteCode || ''}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required 
                    maxLength={6}
                    className="w-full p-5 text-center text-2xl font-mono font-bold tracking-widest rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 uppercase" 
                    placeholder="XXXXXX" 
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-red-500 font-medium text-center">{joinError}</p>
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={isJoiningLoading || inviteCode.length < 6}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 disabled:opacity-50"
              >
                {isJoiningLoading ? 'Joining...' : 'Join Group'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const totalContributed = group.contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
  const targetAmount = group.target_amount || 500;
  const progress = Math.min((totalContributed / targetAmount) * 100, 100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft size={24} /></button>
        <div>
          <h1 className="text-center font-bold">{group.code_name || group.name}</h1>
          <p className="text-[10px] text-center text-zinc-400 uppercase font-bold">Surprise for {group.person_name}</p>
        </div>
        <button className="p-2"><Users size={20} /></button>
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Invite Code */}
        <div className="p-4 bg-zinc-900 text-white rounded-2xl flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-400">Invite Code</p>
            <p className="text-xl font-mono font-bold tracking-widest">{group.invite_code}</p>
          </div>
          <button className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold" onClick={() => {
            navigator.clipboard.writeText(group.invite_code);
            alert('Code copied!');
          }}>Copy Code</button>
        </div>

        {/* Contribution Pool */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-500" />
              Gift Pool
            </h3>
            <span className="text-sm font-bold">${totalContributed} / ${targetAmount}</span>
          </div>
          <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-500" 
            />
          </div>
          
          <AnimatePresence>
            {isContributing ? (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2"
              >
                <div className="flex gap-2">
                  {['10', '25', '50', '100'].map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setContributionAmount(amt)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                        contributionAmount === amt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsContributing(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                  <button onClick={handleContribute} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm">Confirm</button>
                </div>
              </motion.div>
            ) : (
              <button 
                onClick={() => setIsContributing(true)}
                className="w-full py-3 bg-emerald-500/10 text-emerald-600 rounded-xl font-bold text-sm"
              >
                Contribute to Pool
              </button>
            )}
          </AnimatePresence>
        </section>

        {/* AI Gift Suggestions */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-amber-500" />
              AI Gift Suggestions
            </h2>
            <button 
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingSuggestions}
              className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1"
            >
              {isGeneratingSuggestions ? 'Analyzing...' : 'Refresh Suggestions'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {aiSuggestions.length > 0 ? aiSuggestions.map((suggestion, i) => (
              <motion.a
                key={i}
                href={suggestion.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group hover:border-emerald-500 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{suggestion.title}</h4>
                    <span className="text-xs font-bold text-emerald-500">{suggestion.price}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{suggestion.reason}</p>
                </div>
                <div className="p-2 text-zinc-300 group-hover:text-emerald-500 transition-colors">
                  <ExternalLink size={18} />
                </div>
              </motion.a>
            )) : (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-700">
                <p className="text-zinc-500 text-sm">Tap refresh to see AI gift ideas based on the current pool and interests.</p>
              </div>
            )}
          </div>
        </section>

        {/* Idea Board */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Vote size={20} className="text-zinc-400" />
              Idea Board
            </h2>
          </div>
          
          <div className="space-y-4">
            {group.ideas?.map((idea: any) => (
              <motion.div 
                key={idea.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-start"
              >
                <div>
                  <h4 className="font-bold">{idea.title}</h4>
                  <p className="text-sm text-zinc-500">{idea.description}</p>
                </div>
                <button 
                  onClick={() => handleVote(idea.id, idea.votes || [])}
                  className="flex flex-col items-center p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl min-w-[44px]"
                >
                  <ChevronUp size={20} className={cn((idea.votes || []).includes(firebaseUser?.uid) && "text-emerald-500")} />
                  <span className="text-xs font-bold">{(idea.votes || []).length}</span>
                </button>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              value={newIdea || ''}
              onChange={(e) => setNewIdea(e.target.value)}
              className="flex-1 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
              placeholder="Suggest something..."
            />
            <button 
              onClick={handleAddIdea}
              className="p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl"
            >
              <Plus size={24} />
            </button>
          </div>
        </section>
      </div>
      <Navigation />
    </div>
  );
}
