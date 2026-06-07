import React from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDocs, updateDoc, collection, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Camera, User, ArrowRight, ArrowLeft, 
  Check, Lock, Globe, Trophy, Music, Copy, Calendar
} from 'lucide-react';

export default function OnboardingFlow() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = React.useState(1);

  // Step 1: About You
  const [name, setName] = React.useState(user?.name || '');
  const [birthday, setBirthday] = React.useState(user?.birthday || '2008-01-01');
  const [customHandle, setCustomHandle] = React.useState('');
  const [profilePicUrl, setProfilePicUrl] = React.useState(user?.profile_picture_url || '');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');
  const [handleChecking, setHandleChecking] = React.useState(false);
  const [handleError, setHandleError] = React.useState('');
  const [handleSuccess, setHandleSuccess] = React.useState(false);

  // Step 2: Your Social Vibes
  const [sportsInput, setSportsInput] = React.useState('');
  const [sportsTeams, setSportsTeams] = React.useState<string[]>([]);
  const [favArtists, setFavArtists] = React.useState('');
  const [weekendActivities, setWeekendActivities] = React.useState('');

  // Step 3: Privacy
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Load existing handle if any
  React.useEffect(() => {
    if (user?.custom_handle) {
      setCustomHandle(user.custom_handle);
      setHandleSuccess(true);
    } else if (user?.name) {
      // Propose a handle based on name
      const proposed = user.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setCustomHandle(proposed);
    }
  }, [user]);

  // Handle unique handle check
  const checkHandleUniqueness = async (handleToCheck: string) => {
    const cleanHandle = handleToCheck.trim().toLowerCase().replace(/[^a-z0-0_\-]/g, '');
    if (!cleanHandle) {
      setHandleError('Handle cannot be empty');
      setHandleSuccess(false);
      return;
    }
    if (cleanHandle.length < 3) {
      setHandleError('Min 3 characters required');
      setHandleSuccess(false);
      return;
    }

    setHandleChecking(true);
    setHandleError('');
    setHandleSuccess(false);

    try {
      const usersRef = collection(db, 'users');
      const q1 = query(usersRef, where('custom_handle', '==', cleanHandle));
      const q2 = query(usersRef, where('handle', '==', cleanHandle));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const otherUserWithHandle = snap1.docs.find(d => d.id !== user?.id) || snap2.docs.find(d => d.id !== user?.id);

      if (otherUserWithHandle) {
        setHandleError('This handle is already taken 😔');
      } else {
        setHandleSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setHandleError('Error verifying handle.');
    } finally {
      setHandleChecking(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', 'relateos_uploads');

      const response = await fetch('https://api.cloudinary.com/v1_1/dffkrlv1k/image/upload', {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image to Cloudinary');
      }

      const data = await response.json();
      setProfilePicUrl(data.secure_url);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setUploadError('Failed to upload avatar. Try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSportTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = sportsInput.trim().replace(/,/g, '');
      if (tag && !sportsTeams.includes(tag)) {
        setSportsTeams([...sportsTeams, tag]);
      }
      setSportsInput('');
    }
  };

  const removeSportTag = (indexToRemove: number) => {
    setSportsTeams(sportsTeams.filter((_, i) => i !== indexToRemove));
  };

  const handleNextStep = async () => {
    if (step === 1) {
      // Validate step 1 fields
      if (!name.trim()) return;
      if (!customHandle.trim()) {
        setHandleError('Please provide a custom username handle!');
        return;
      }
      
      // Force unique handle double check if not validated
      if (!handleSuccess) {
        await checkHandleUniqueness(customHandle);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const userRef = doc(db, 'users', user.id);
      const cleanHandle = customHandle.toLowerCase().trim().replace(/[^a-z0-9_\-]/g, '');
      const finalProfilePic = profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=10b981&color=fff&size=256&bold=true`;

      await updateDoc(userRef, {
        name,
        birthday,
        custom_handle: cleanHandle,
        handle: cleanHandle,
        profile_picture_url: finalProfilePic,
        fav_sports_teams: sportsTeams.join(','),
        fav_artists: favArtists.trim(),
        weekend_activities: weekendActivities.trim(),
        is_private: isPrivate,
        onboarding_completed: true,
        has_completed_onboarding: true
      });

      await refreshUser();
    } catch (err) {
      console.error('Onboarding update failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bioLink = `${window.location.origin}/u/${customHandle.trim().toLowerCase()}`;

  const copyBioLink = () => {
    navigator.clipboard.writeText(bioLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 pt-[var(--sat)] select-none">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[36px] shadow-xl space-y-6 relative overflow-hidden">
        
        {/* Step indicators */}
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
            <Sparkles size={12} className="animate-pulse" /> Step {step} of 3
          </span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-350 ${
                  s === step ? 'w-8 bg-emerald-500' : s < step ? 'w-2 bg-emerald-500/40' : 'w-2 bg-zinc-200 dark:bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Create Your Profile Card ⚡</h2>
                <p className="text-xs text-zinc-400 font-semibold">Let's build your RelateOS visual identity card.</p>
              </div>

              {/* Cloudinary Upload & Preview */}
              <div className="flex flex-col items-center space-y-2 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-all shadow-inner">
                    {profilePicUrl ? (
                      <img src={profilePicUrl} alt="Onboarding avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : name ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-500 text-white text-3xl font-black uppercase">
                        {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    ) : (
                      <User size={36} className="text-zinc-400" />
                    )}
                    
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider">
                        <span>Uploading...</span>
                      </div>
                    )}
                  </div>
                  
                  <label className="absolute bottom-0 right-0 p-2 bg-zinc-950 dark:bg-white dark:text-zinc-900 text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
                    <Camera size={14} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {uploadError && <p className="text-red-500 text-[10px] font-bold">{uploadError}</p>}
                {profilePicUrl && (
                  <button 
                    type="button" 
                    onClick={() => setProfilePicUrl('')}
                    className="text-[9px] font-black uppercase tracking-wider text-red-500 hover:underline"
                  >
                    Delete Photo
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">Full name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Smayan Sri"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5 flex items-center gap-1">
                    <Calendar size={11} /> Birthday
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">Custom Handle / URL Link</label>
                  <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-0.5">
                    <span className="pl-3 text-zinc-400 text-xs font-bold font-mono">relateos.app/u/</span>
                    <input
                      type="text"
                      required
                      className="flex-1 p-3 pl-0 bg-transparent border-none text-xs font-bold text-zinc-950 dark:text-white outline-none focus:ring-0"
                      placeholder="smayan"
                      value={customHandle}
                      onChange={(e) => {
                        const cleanVal = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
                        setCustomHandle(cleanVal);
                        setHandleSuccess(false);
                      }}
                      onBlur={() => checkHandleUniqueness(customHandle)}
                    />
                    <button
                      type="button"
                      disabled={handleChecking || !customHandle.trim()}
                      onClick={() => checkHandleUniqueness(customHandle)}
                      className="px-3 py-1.5 mr-1 bg-zinc-250 dark:bg-zinc-700 text-[10px] font-black uppercase rounded-lg text-zinc-650 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-650 transition-colors cursor-pointer"
                    >
                      {handleChecking ? 'Checking...' : 'Verify'}
                    </button>
                  </div>
                  {handleError && <p className="text-red-500 text-[10px] font-bold ml-1">{handleError}</p>}
                  {handleSuccess && <p className="text-emerald-500 text-[10px] font-bold ml-1 flex items-center gap-1">✓ Beautiful! Handle is unique.</p>}
                </div>
              </div>

              <button
                type="button"
                disabled={!name.trim() || !customHandle.trim() || handleChecking || !!handleError}
                onClick={handleNextStep}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
              >
                Continue to Vibes <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Your Social Vibes ⚡</h2>
                <p className="text-xs text-zinc-400 font-semibold">Tell your circle what you're currently jamming to.</p>
              </div>

              <div className="space-y-4">
                {/* Favorite Sports Teams Tag Input */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5 flex items-center gap-1">
                    <Trophy size={11} /> Favorite Sports Teams (Press Enter or comma to add)
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Lakers, Real Madrid, Warriors"
                    value={sportsInput}
                    onChange={(e) => setSportsInput(e.target.value)}
                    onKeyDown={handleAddSportTag}
                  />
                  {sportsTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sportsTeams.map((team, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 rounded-lg flex items-center gap-1 shadow-sm"
                        >
                          {team}
                          <button 
                            type="button" 
                            onClick={() => removeSportTag(idx)} 
                            className="hover:text-red-500 font-extrabold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Favorite Artists */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5 flex items-center gap-1">
                    <Music size={11} /> Favorite Artists or Music Genre
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Drake, Billie Eilish, Synthwave, Lofi"
                    value={favArtists}
                    onChange={(e) => setFavArtists(e.target.value)}
                  />
                </div>

                {/* Weekend Activities Prompts */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">My Favorite Thing to Do on a Weekend is...</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder="e.g. coding late-night tracks, record vintage vinyl, hike with friends"
                    value={weekendActivities}
                    onChange={(e) => setWeekendActivities(e.target.value)}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                >
                  Configure Privacy <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Choose Your Privacy Shield 🛡️</h2>
                <p className="text-xs text-zinc-400 font-semibold">Select how you want to share your birthday and vibes link.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Public card */}
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-5 rounded-[24px] border-2 text-left space-y-3 transition-all relative ${
                    !isPrivate 
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
                      : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className={`p-2 rounded-xl inline-block ${!isPrivate ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[13px] text-zinc-900 dark:text-white">Go Public ⚡</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Bio link active. Friends can visit your page to add their info and view your social vibes!
                    </p>
                  </div>
                  {!isPrivate && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>

                {/* Private card */}
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-5 rounded-[24px] border-2 text-left space-y-3 transition-all relative ${
                    isPrivate 
                      ? 'border-zinc-900 dark:border-white bg-zinc-950/5 dark:bg-white/5' 
                      : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className={`p-2 rounded-xl inline-block ${isPrivate ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[13px] text-zinc-900 dark:text-white">Go Private 🔒</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Completely offline. Only you can view or manage your space. Public route is locked down.
                    </p>
                  </div>
                  {isPrivate && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {!isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-750 rounded-2xl space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">Your Public URL Invite URL</span>
                      <button 
                        type="button"
                        onClick={copyBioLink}
                        className="text-[10px] uppercase font-black tracking-wider text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} /> {copiedLink ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
                      {bioLink}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {isPrivate && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-850 border border-dashed border-zinc-200 dark:border-zinc-750 rounded-2xl text-center">
                  <p className="text-xs font-bold text-zinc-500">
                    🔒 Security Locked: Friends visiting `/u/{customHandle}` will be blocked with a privacy shield.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCompleteOnboarding}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer animate-bounce"
                >
                  {isSubmitting ? 'Securing...' : 'Claim My Workspace ⚡'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
