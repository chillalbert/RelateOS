import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Lock, 
  MessageSquare, 
  Gift, 
  Image as ImageIcon, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';

interface Surprise {
  id: string;
  type: string;
  content: string;
  user_name: string;
  user_id: string;
  created_at?: any;
}

interface Contribution {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
}

export default function SurpriseReveal() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [room, setRoom] = React.useState<any>(null);
  const [surprises, setSurprises] = React.useState<Surprise[]>([]);
  const [contributions, setContributions] = React.useState<Contribution[]>([]);
  const [isUnlocked, setIsUnlocked] = React.useState(false);

  React.useEffect(() => {
    if (!roomId) return;

    async function fetchSurpriseData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch room document
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          setError("This link is invalid or has expired");
          setLoading(false);
          return;
        }

        const roomData = roomSnap.data();
        setRoom(roomData);

        // Fetch surprises
        const surprisesRef = collection(db, 'rooms', roomId, 'surprises');
        const surprisesSnap = await getDocs(surprisesRef);
        const surprisesList = surprisesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Surprise[];
        setSurprises(surprisesList);

        // Fetch contributions
        const contributionsRef = collection(db, 'rooms', roomId, 'contributions');
        const contributionsSnap = await getDocs(contributionsRef);
        const contributionsList = contributionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Contribution[];
        setContributions(contributionsList);

        // Calculate lock/unlock state
        const now = new Date();
        const todayMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const birthdayStr = roomData.person_birthday || ''; // expected YYYY-MM-DD
        const bdayMMDD = birthdayStr.slice(5, 10); // get MM-DD

        setIsUnlocked(todayMMDD === bdayMMDD);

      } catch (err) {
        console.error("Error loading surprise room:", err);
        setError("This link is invalid or has expired");
      } finally {
        setLoading(false);
      }
    }

    fetchSurpriseData();
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
        <p className="mt-4 text-zinc-400 text-sm font-medium animate-pulse">
          Opening surprise wall...
        </p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm shadow-xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unavailable Link</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {error || "This link is invalid or has expired"}
          </p>
        </div>
      </div>
    );
  }

  // Calculate unique contributors
  const uniqueContributors = Array.from(new Set([
    ...surprises.map(s => s.user_name || ''),
    ...contributions.map(c => c.user_name || '')
  ].filter(Boolean)));

  const totalContributed = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);

  // Format birthday date string (e.g. "2026-06-15" -> "June 15")
  const formatBirthdayDate = (dateStr: string) => {
    if (!dateStr) return 'their birthday';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const dummyDate = new Date(2020, month - 1, day);
      return dummyDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }
    return dateStr;
  };

  const formattedBirthday = formatBirthdayDate(room.person_birthday);

  // Locked State UI
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6">
        {/* Spacer */}
        <div />

        {/* Center Card Container */}
        <div className="max-w-md w-full mx-auto space-y-6">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl relative"
          >
            {/* Top Blurred Teaser Section */}
            <div className="relative p-6 border-b border-zinc-800 bg-zinc-950/40 min-h-[180px] flex flex-col justify-center items-center overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-xl brightness-50 z-10" />

              {/* Teaser Content (Blurred but still visible structural hints) */}
              <div className="relative z-0 text-center space-y-4">
                {/* Avatars */}
                <div className="flex justify-center -space-x-2">
                  {uniqueContributors.slice(0, 5).map((name, i) => (
                    <div 
                      key={i} 
                      className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 text-xs font-black flex items-center justify-center select-none"
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-300">
                    {uniqueContributors.length} friends left you something
                  </p>
                  {totalContributed > 0 && (
                    <p className="text-xs font-semibold text-emerald-400/80">
                      Gift pool: ${totalContributed}
                    </p>
                  )}
                </div>

                {/* 3 Blurred placeholder cards */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-xs mt-2 px-4">
                  <div className="bg-zinc-800 animate-pulse rounded-2xl h-14" />
                  <div className="bg-zinc-800 animate-pulse rounded-2xl h-14" />
                  <div className="bg-zinc-800 animate-pulse rounded-2xl h-14" />
                </div>
              </div>

              {/* Large Lock Icon Centered On Top Of Blur */}
              <div className="absolute z-20 w-16 h-16 bg-white/10 backdrop-blur-[2px] border border-white/20 text-white rounded-full flex items-center justify-center shadow-lg">
                <Lock size={28} className="animate-pulse" />
              </div>
            </div>

            {/* Middle Section - CTA */}
            <div className="p-8 text-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Your friends built something for you 🎁
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Create your free account to unlock it on your birthday.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login', { state: { redirectTo: `/surprise/${roomId}` } })}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-2xl font-bold transition-all text-sm tracking-wide shadow-lg shadow-emerald-500/15"
                >
                  Unlock My Surprises →
                </button>

                <p className="text-xs text-zinc-500 font-medium">
                  Already have an account?{' '}
                  <button
                    onClick={() => navigate('/login', { state: { redirectTo: `/surprise/${roomId}` } })}
                    className="text-emerald-400 hover:underline font-bold"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Bottom locked release info */}
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full select-none shadow-sm">
              <Lock size={12} className="text-zinc-500" />
              <span>Unlocks on {formattedBirthday}</span>
            </div>
          </div>
        </div>

        {/* Footer brand */}
        <div className="text-center py-4">
          <p className="text-[10px] font-bold text-zinc-650 uppercase tracking-widest select-none">
            Built with RelateOS
          </p>
        </div>
      </div>
    );
  }

  // Unlocked State UI
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 space-y-10">
        
        {/* Header Dashboard */}
        <motion.header 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="text-5xl">🎉</div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tight">
              Happy Birthday! 🎂
            </h1>
            <p className="text-zinc-400 text-base">
              Your friends built this just for you
            </p>
          </div>

          {/* Contributor Row (Not blurred) */}
          {uniqueContributors.length > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="flex justify-center -space-x-2">
                {uniqueContributors.slice(0, 5).map((name, i) => (
                  <div 
                    key={i} 
                    title={name}
                    className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-zinc-950 text-emerald-400 text-sm font-black flex items-center justify-center select-none shadow-md"
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Surprise wall created by {uniqueContributors.join(', ')}
              </p>
            </div>
          )}
        </motion.header>

        {/* Gift Pool Segment */}
        {totalContributed > 0 && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base">Gift Pool 💰</h4>
                <p className="text-xs text-zinc-400 font-medium">Contributed by your friends for your perfect gift</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400">${totalContributed}</span>
            </div>
          </motion.div>
        )}

        {/* Surprises Wall Grid */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
            Your Birthday surprises ({surprises.length})
          </h2>

          {surprises.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl">
              <p className="text-sm text-zinc-500 font-medium">No surprises have been added to the locker yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {surprises.map((surprise, sIdx) => {
                const getIcon = () => {
                  switch (surprise.type?.toLowerCase()) {
                    case 'message':
                    case 'text':
                      return <MessageSquare size={16} className="text-blue-400" />;
                    case 'gift':
                      return <Gift size={16} className="text-yellow-400" />;
                    case 'photo':
                    case 'image':
                    case 'video':
                    case 'voice':
                      return <ImageIcon size={16} className="text-purple-400" />;
                    default:
                      return <Sparkles size={16} className="text-emerald-400" />;
                  }
                };

                return (
                  <motion.div
                    key={surprise.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: sIdx * 0.1 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-full text-xs font-bold text-zinc-300">
                        {getIcon()}
                        <span className="capitalize">{surprise.type || 'Message'}</span>
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        From {surprise.user_name || 'Friend'}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-100 font-medium leading-relaxed whitespace-pre-wrap">
                      {surprise.content}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom CTA — conversion hook */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 text-center space-y-4 shadow-xl"
        >
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white">
              Want to do this for your friends too?
            </h3>
            <p className="text-zinc-400 text-sm">
              Join RelateOS and never miss a birthday moment.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-2xl font-bold transition-all text-sm shadow-md"
          >
            Create My Free Account →
          </button>
        </motion.div>

        {/* Footer brand */}
        <div className="text-center pt-4">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest select-none">
            Built with RelateOS
          </p>
        </div>
      </div>
    </div>
  );
}
