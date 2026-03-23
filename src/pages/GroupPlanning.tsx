import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Users, 
  Send, 
  Plus, 
  Vote, 
  DollarSign, 
  Shield, 
  ChevronUp, 
  Sparkles, 
  ExternalLink,
  Lock,
  Unlock,
  MessageSquare,
  Gift,
  Image as ImageIcon,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import { generateGiftSuggestions } from '../services/geminiService';
import { db } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp, 
  arrayUnion, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { cn, formatDate } from '../lib/utils';

export default function GroupPlanning() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const personId = searchParams.get('personId');
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();
  
  const [group, setGroup] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'planning' | 'vault' | 'chat'>('planning');
  
  // Form states
  const [newIdea, setNewIdea] = React.useState('');
  const [isContributing, setIsContributing] = React.useState(false);
  const [contributionAmount, setContributionAmount] = React.useState('25');
  const [aiSuggestions, setAiSuggestions] = React.useState<any[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState('');
  const [joinError, setJoinError] = React.useState('');
  const [isJoiningLoading, setIsJoiningLoading] = React.useState(false);
  
  // Chat states
  const [newMessage, setNewMessage] = React.useState('');
  const [messages, setMessages] = React.useState<any[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Vault states
  const [showSurpriseForm, setShowSurpriseForm] = React.useState(false);
  const [newSurprise, setNewSurprise] = React.useState({ type: 'message', content: '' });
  const [surprises, setSurprises] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!id || !firebaseUser) return;

    const groupRef = doc(db, 'rooms', id);
    const unsubscribeGroup = onSnapshot(groupRef, async (docSnap) => {
      if (docSnap.exists()) {
        const groupData = { id: docSnap.id, ...docSnap.data() } as any;
        
        // Check if user is a member or recipient
        const isMember = groupData.members?.includes(firebaseUser.uid);
        const isRecipient = user?.email === groupData.recipient_email;
        
        if (!isMember && !isRecipient) {
          setJoinError("You are not a member of this room.");
          setLoading(false);
          return;
        }

        // Fetch ideas
        const ideasRef = collection(db, 'rooms', id, 'ideas');
        const ideasSnap = await getDocs(ideasRef);
        const ideas = ideasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch contributions
        const contributionsRef = collection(db, 'rooms', id, 'contributions');
        const contributionsSnap = await getDocs(contributionsRef);
        const contributions = contributionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setGroup({ ...groupData, ideas, contributions, isMember, isRecipient });
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    // Chat subscription
    const chatRef = collection(db, 'rooms', id, 'chat');
    const chatQuery = query(chatRef, orderBy('created_at', 'asc'), limit(50));
    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Surprises subscription
    const surprisesRef = collection(db, 'rooms', id, 'surprises');
    const unsubscribeSurprises = onSnapshot(surprisesRef, (snapshot) => {
      setSurprises(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeGroup();
      unsubscribeChat();
      unsubscribeSurprises();
    };
  }, [id, firebaseUser, user?.email]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim() || !firebaseUser) return;
    try {
      const chatRef = collection(db, 'rooms', id, 'chat');
      await addDoc(chatRef, {
        user_id: firebaseUser.uid,
        user_name: user?.name || 'Anonymous',
        content: newMessage,
        created_at: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSurprise = async () => {
    if (!id || !newSurprise.content.trim() || !firebaseUser) return;
    try {
      const surprisesRef = collection(db, 'rooms', id, 'surprises');
      await addDoc(surprisesRef, {
        user_id: firebaseUser.uid,
        user_name: user?.name || 'Anonymous',
        type: newSurprise.type,
        content: newSurprise.content,
        created_at: serverTimestamp()
      });
      setNewSurprise({ type: 'message', content: '' });
      setShowSurpriseForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleContribute = async () => {
    if (!id || !firebaseUser) return;
    try {
      const contributionsRef = collection(db, 'rooms', id, 'contributions');
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
      const groupsRef = collection(db, 'rooms');
      const q = query(groupsRef, where('invite_code', '==', inviteCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setJoinError('Invalid invite code. Please check and try again.');
        setIsJoiningLoading(false);
        return;
      }
      
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();
      
      if (!groupData.members?.includes(firebaseUser.uid)) {
        await updateDoc(doc(db, 'rooms', groupDoc.id), {
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
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const code_name = formData.get('code_name') as string;
    const recipient_email = formData.get('recipient_email') as string;

    try {
      const groupsRef = collection(db, 'rooms');
      const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      let person_name = 'Someone';
      let person_notes = '';
      let person_category = '';
      let person_birthday = '';

      if (personId) {
        const personSnap = await getDoc(doc(db, 'people', personId));
        if (personSnap.exists()) {
          const pData = personSnap.data();
          person_name = pData.name;
          person_notes = pData.notes;
          person_category = pData.category;
          person_birthday = pData.birthday;
        }
      }

      const docRef = await addDoc(groupsRef, {
        name,
        code_name,
        person_id: personId,
        person_name,
        person_notes,
        person_category,
        person_birthday,
        recipient_email: recipient_email.toLowerCase(),
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
      const ideasRef = collection(db, 'rooms', id, 'ideas');
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
      const ideaRef = doc(db, 'rooms', id, 'ideas', ideaId);
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
        <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{isJoining ? 'Join Room' : 'Create Room'}</h1>
          <div className="w-10" />
        </header>
        
        <div className="p-6 max-w-lg mx-auto space-y-8">
          <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800 rounded-2xl shadow-inner">
            <button 
              onClick={() => setIsJoining(false)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200",
                !isJoining ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
              )}
            >
              Create New
            </button>
            <button 
              onClick={() => setIsJoining(true)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200",
                isJoining ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
              )}
            >
              Join with Code
            </button>
          </div>

          {!isJoining ? (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleCreateGroup} 
              className="space-y-6"
            >
              <div className="p-6 bg-emerald-500 text-white rounded-3xl space-y-3 shadow-xl shadow-emerald-500/20 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                  <Shield size={120} />
                </div>
                <Shield size={32} className="relative z-10" />
                <div className="relative z-10">
                  <h2 className="text-xl font-bold">Social Surprise Mode</h2>
                  <p className="text-sm opacity-90 leading-relaxed">Collaborate with friends in secret. The birthday person will never know until their big day.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Room Name</label>
                  <input 
                    name="name" 
                    required 
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                    placeholder="e.g. Sarah's 30th Crew" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Secret Code Name</label>
                  <input 
                    name="code_name" 
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                    placeholder="e.g. Project Cupcake" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Recipient Email</label>
                  <input 
                    name="recipient_email" 
                    type="email" 
                    required 
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                    placeholder="The person we are surprising" 
                  />
                  <p className="text-[10px] text-zinc-500 ml-1">This links the vault to their account for the auto-reveal.</p>
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                Start Planning
              </button>
            </motion.form>
          ) : (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleJoinGroup} 
              className="space-y-6"
            >
              <div className="p-6 bg-zinc-900 text-white rounded-3xl space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                  <Users size={120} />
                </div>
                <Users size={32} className="text-emerald-500 relative z-10" />
                <div className="relative z-10">
                  <h2 className="text-xl font-bold">Join the Crew</h2>
                  <p className="text-sm opacity-90 text-zinc-400 leading-relaxed">Enter the 6-character invite code shared by your friends to join the planning group.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Invite Code</label>
                  <input 
                    value={inviteCode || ''}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required 
                    maxLength={6}
                    className="w-full p-6 text-center text-3xl font-mono font-bold tracking-[0.5em] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 uppercase focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                    placeholder="XXXXXX" 
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-red-500 font-medium text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{joinError}</p>
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={isJoiningLoading || inviteCode.length < 6}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isJoiningLoading ? 'Joining...' : 'Join Room'}
              </button>
            </motion.form>
          )}
        </div>
        <Navigation />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!group) return <div className="p-8 text-center">Room not found or access denied.</div>;

  const totalContributed = group.contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
  const targetAmount = group.target_amount || 500;
  const progress = Math.min((totalContributed / targetAmount) * 100, 100);

  // Check if it's the birthday
  const today = new Date().toISOString().split('T')[0].slice(5); // MM-DD
  const bday = group.person_birthday?.slice(5);
  const isBirthday = today === bday;
  const isUnlocked = isBirthday || group.isMember;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex flex-col gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft size={24} /></button>
          <div className="text-center">
            <h1 className="font-bold">{group.code_name || group.name}</h1>
            <p className="text-[10px] text-zinc-400 uppercase font-bold">For {group.person_name}</p>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          {(['planning', 'vault', 'chat'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                activeTab === tab 
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-400"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {activeTab === 'planning' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
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
          </motion.div>
        )}

        {activeTab === 'vault' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="p-6 bg-zinc-900 text-white rounded-[40px] space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                {isUnlocked ? <Unlock size={120} /> : <Lock size={120} />}
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  {isUnlocked ? <Unlock className="text-emerald-500" /> : <Lock className="text-amber-500" />}
                  Secret Vault
                </h2>
                <p className="text-sm text-zinc-400 mt-2">
                  {isUnlocked 
                    ? "The vault is open! Enjoy all the surprises your friends left for you."
                    : `Locked until ${group.person_name}'s birthday. Add surprises below!`}
                </p>
              </div>
            </div>

            {group.isMember && (
              <button 
                onClick={() => setShowSurpriseForm(true)}
                className="w-full p-4 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Plus size={20} />
                Add a Surprise
              </button>
            )}

            <AnimatePresence>
              {showSurpriseForm && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4"
                >
                  <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    {(['message', 'image', 'gift'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setNewSurprise({ ...newSurprise, type })}
                        className={cn(
                          "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                          newSurprise.type === type ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-400"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <textarea 
                    value={newSurprise.content}
                    onChange={(e) => setNewSurprise({ ...newSurprise, content: e.target.value })}
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm min-h-[100px]"
                    placeholder={newSurprise.type === 'message' ? "Write a secret message..." : "Paste a URL or description..."}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowSurpriseForm(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                    <button onClick={handleAddSurprise} className="flex-1 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl font-bold text-sm">Add to Vault</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-4">
              {isUnlocked ? (
                surprises.length > 0 ? surprises.map((surprise, i) => (
                  <motion.div
                    key={surprise.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      {surprise.type === 'message' && <MessageSquare size={16} className="text-blue-500" />}
                      {surprise.type === 'image' && <ImageIcon size={16} className="text-emerald-500" />}
                      {surprise.type === 'gift' && <Gift size={16} className="text-amber-500" />}
                      <span className="text-[10px] font-bold uppercase text-zinc-400">From {surprise.user_name}</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{surprise.content}</p>
                  </motion.div>
                )) : (
                  <div className="p-12 text-center space-y-4">
                    <Heart className="mx-auto text-zinc-200" size={48} />
                    <p className="text-zinc-500">No surprises yet. Be the first!</p>
                  </div>
                )
              ) : (
                <div className="p-12 text-center space-y-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-[40px] border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Lock className="mx-auto text-zinc-300" size={48} />
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-400 uppercase tracking-widest text-xs">Vault Locked</p>
                    <p className="text-sm text-zinc-500">Only members can see what's inside until the big reveal.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'chat' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[60vh]">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
              {messages.map((msg, i) => {
                const isMe = msg.user_id === firebaseUser?.uid;
                return (
                  <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-2xl text-sm shadow-sm",
                      isMe ? "bg-emerald-500 text-white rounded-tr-none" : "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-tl-none"
                    )}>
                      {!isMe && <p className="text-[10px] font-bold opacity-50 mb-1">{msg.user_name}</p>}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className="text-[8px] text-zinc-400 mt-1 uppercase font-bold">{msg.created_at ? formatDate(msg.created_at.toDate().toISOString()) : 'Just now'}</p>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
              <input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm"
                placeholder="Message the crew..."
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </form>
          </motion.div>
        )}
      </div>
      <Navigation />
    </div>
  );
}
