import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, User, Heart, Gift, ShieldAlert, Lock } from 'lucide-react';

export default function PublicProfileCollector() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  // Host search states
  const [hostUser, setHostUser] = React.useState<any>(null);
  const [isSearching, setIsSearching] = React.useState(true);
  
  // Visitor form states
  const [visitorName, setVisitorName] = React.useState('');
  const [visitorNickname, setVisitorNickname] = React.useState('');
  const [visitorCategory, setVisitorCategory] = React.useState<'friend' | 'family' | 'partner' | 'coworker' | 'other'>('friend');
  const [birthMonth, setBirthMonth] = React.useState('01');
  const [birthDay, setBirthDay] = React.useState('01');
  const [birthYear, setBirthYear] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [interests, setInterests] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccessful, setIsSuccessful] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Month array
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  React.useEffect(() => {
    const fetchHostUser = async () => {
      if (!username) {
        setIsSearching(false);
        return;
      }

      try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        
        // Find matching host user using standard username slug logic, supporting custom_handle
        const matched = querySnapshot.docs.find(doc => {
          const uData = doc.data();
          const name = uData.name || '';
          const emailPrefix = (uData.email || '').split('@')[0];
          const customHandle = uData.custom_handle || '';
          
          const slugFromName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const slugFromEmail = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');
          const targetSlug = username.toLowerCase().replace(/[^a-z0-9]/g, '');
          const slugFromCustomHandle = customHandle.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          return (
            slugFromName === targetSlug || 
            slugFromEmail === targetSlug || 
            name.toLowerCase() === username.toLowerCase() ||
            (customHandle && slugFromCustomHandle === targetSlug)
          );
        });

        if (matched) {
          setHostUser({ id: matched.id, ...matched.data() });
        }
      } catch (err) {
        console.error('Error fetching public host user:', err);
      } finally {
        setIsSearching(false);
      }
    };

    fetchHostUser();
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostUser) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const yearStr = birthYear.trim();
      const monthStr = birthMonth;
      const dayStr = birthDay.trim().padStart(2, '0');
      const hasYear = yearStr.length > 0;
      const birthdayStr = hasYear ? `${yearStr}-${monthStr}-${dayStr}` : `1900-${monthStr}-${dayStr}`;

      const peopleRef = collection(db, 'people');
      await addDoc(peopleRef, {
        name: visitorName,
        nickname: visitorNickname,
        birthday: birthdayStr,
        birthYearUnknown: !hasYear,
        category: visitorCategory,
        importance: 4, 
        notes: notes || 'Connected via Public Profile Link',
        interests: interests,
        photo_url: '',
        user_id: hostUser.id,
        created_at: serverTimestamp(),
        reminder_settings: {
          one_week_before: true,
          three_days_before: true,
          day_of: true
        }
      });

      setIsSuccessful(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSearching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-550 dark:text-zinc-400 font-bold text-xs tracking-tight uppercase">Scanning Orbit...</p>
      </div>
    );
  }

  if (!hostUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[32px] text-center space-y-6 shadow-sm"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            <ShieldAlert size={36} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold tracking-tight">Orbit Not Found</h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We couldn't locate a profile matching "{username}". Double check the spelling of your friend's name or link handle.
            </p>
          </div>
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-xs transition-colors hover:bg-zinc-805"
          >
            Launch My Own Circle
          </button>
        </motion.div>
      </div>
    );
  }

  if (hostUser.is_private) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[32px] text-center space-y-6 shadow-xl"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Lock size={32} className="text-zinc-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">This Profile is Private 🔒</h1>
            <p className="text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
              {hostUser.name}'s workspace is configured for maximum confidentiality. Public invitation requests are disabled.
            </p>
          </div>
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all hover:bg-emerald-600 shadow-md shadow-emerald-500/10"
          >
            Launch My Own Circle ⚡
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 pt-[var(--sat)] select-none">
      <AnimatePresence mode="wait">
        {!isSuccessful ? (
          <motion.div 
            key="collector-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-md space-y-6"
          >
            {/* High-energy header avatar badge */}
            <div className="flex flex-col items-center space-y-3 text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-[4px] border-emerald-500 shadow-xl shadow-emerald-500/10 bg-white dark:bg-zinc-900 relative z-10">
                  {hostUser.profile_picture_url ? (
                    <img 
                      src={hostUser.profile_picture_url} 
                      alt={hostUser.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-500 text-white font-black text-2xl uppercase">
                      {hostUser.name?.charAt(0)}
                    </div>
                  )}
                </div>
                {/* Visual energy rings */}
                <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-500 animate-ping opacity-25" />
              </div>
              
              <div className="space-y-1">
                <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5 justify-center">
                  Lock into {hostUser.name}'s Inner Circle <span className="animate-pulse">⚡</span>
                </h1>
                <p className="text-xs text-zinc-400 font-medium">Add yourself to their circle so they never miss your milestones or birthdays!</p>
              </div>
            </div>

            {/* Collector Form card */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block ml-0.5">Your Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-semibold outline-none"
                    placeholder="e.g., Jennifer Aniston"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                  />
                </div>

                {/* Nickname / Met */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block ml-0.5">Nickname / How We Met</label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., Jen / Coding Camp"
                    value={visitorNickname}
                    onChange={(e) => setVisitorNickname(e.target.value)}
                  />
                </div>

                {/* Relationship Category */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block ml-0.5">Category</label>
                  <div className="grid grid-cols-5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-2xl">
                    {(['friend', 'family', 'partner', 'coworker', 'other'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setVisitorCategory(cat)}
                        className={`py-2 text-[10px] font-black rounded-xl capitalize transition-all cursor-pointer ${
                          visitorCategory === cat 
                            ? 'bg-white dark:bg-zinc-700 text-emerald-555 dark:text-emerald-400 shadow-sm font-extrabold' 
                            : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Birthday Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block ml-0.5">Birthday Info</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border-none text-xs text-zinc-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      {months.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      required
                      min={1}
                      max={31}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border-none text-xs text-zinc-900 dark:text-white font-semibold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Day (e.g. 15)"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    />

                    <input
                      type="number"
                      min={1920}
                      max={new Date().getFullYear()}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border-none text-xs text-zinc-900 dark:text-white font-semibold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Year (Optional)"
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                    />
                  </div>
                </div>

                {/* Interests / Passions */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block ml-0.5">Your Passions / Interests (separated by commas)</label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., espresso, synth music, surfing, React"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block ml-0.5">Notes, Secret Memories or Wishes</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder="A funny catchphrase or memory we share..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting || !visitorName.trim()}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/15 uppercase tracking-wide cursor-pointer"
                >
                  {isSubmitting ? 'Locking in...' : 'Lock in ⚡'}
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="collector-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-100 dark:border-zinc-800 text-center space-y-6 shadow-xl"
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Check size={36} strokeWidth={3} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Profile Locked In! ⚡</h1>
              <p className="text-xs text-zinc-500 leading-relaxed">
                You are now officially in <span className="font-extrabold text-zinc-700 dark:text-zinc-200">{hostUser.name}'s</span> inner circle. They'll be alerted whenever your special days approach!
              </p>
            </div>

            <button 
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-xs"
            >
              Build My Own Circles
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
