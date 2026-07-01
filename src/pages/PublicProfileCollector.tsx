import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Check, User, Heart, Lock, ShieldAlert, 
  HelpCircle, Copy, Share2, CornerDownRight, ArrowRight, Home, Star
} from 'lucide-react';
import { triggerSystemNotification } from '../lib/pushManager';
import { getDisplayName } from '../lib/utils';

export default function PublicProfileCollector() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { firebaseUser, user, isLoading } = useAuth();

  // Host search states
  const [hostUser, setHostUser] = React.useState<any>(null);
  const [isSearching, setIsSearching] = React.useState(true);
  
  // Interaction states
  const [isGrabbing, setIsGrabbing] = React.useState(false);
  const [hasGrabbed, setHasGrabbed] = React.useState(false);
  const [friendRequestSent, setFriendRequestSent] = React.useState(false);
  const [isSendingRequest, setIsSendingRequest] = React.useState(false);
  const [alreadyInOrbit, setAlreadyInOrbit] = React.useState(false);
  const [friendRequestRelationship, setFriendRequestRelationship] = React.useState<string | null>(null);
  const [isCloseFriend, setIsCloseFriend] = React.useState(false);
  const [existingPersonDocId, setExistingPersonDocId] = React.useState<string | null>(null);

  // Pre-flight duplicate orbital check
  React.useEffect(() => {
    const checkOrbit = async () => {
      if (!firebaseUser || !hostUser) {
        setAlreadyInOrbit(false);
        return;
      }
      try {
        const peopleRef = collection(db, 'people');
        const q = query(
          peopleRef,
          where('user_id', '==', firebaseUser.uid),
          where('host_uid', '==', hostUser.id)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setAlreadyInOrbit(true);
          const firstDoc = snap.docs[0];
          setExistingPersonDocId(firstDoc.id);
          setIsCloseFriend(!!firstDoc.data().isCloseFriend);
        } else {
          setAlreadyInOrbit(false);
          setExistingPersonDocId(null);
          setIsCloseFriend(false);
        }
      } catch (err) {
        console.error("Error checking pre-flight duplicate status:", err);
      }
    };
    checkOrbit();
  }, [firebaseUser, hostUser]);

  // Pre-flight duplicate friend request check
  React.useEffect(() => {
    const checkFriendRequest = async () => {
      if (!firebaseUser || !hostUser) {
        setFriendRequestRelationship(null);
        return;
      }
      try {
        const frCollection = collection(db, 'friend_requests');
        const q1 = query(frCollection, where('sender_uid', '==', firebaseUser.uid), where('receiver_uid', '==', hostUser.id));
        const q2 = query(frCollection, where('sender_uid', '==', hostUser.id), where('receiver_uid', '==', firebaseUser.uid));
        
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const reqDoc = snap1.docs[0] || snap2.docs[0];
        if (reqDoc) {
          setFriendRequestRelationship(reqDoc.data().status || null);
        } else {
          setFriendRequestRelationship(null);
        }
      } catch (err) {
        console.error("Error checking pre-flight friend request duplicate:", err);
      }
    };
    checkFriendRequest();
  }, [firebaseUser, hostUser, friendRequestSent]);

  // Month labels helper
  const getMonthLabel = (m: number) => {
    const list = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return list[m - 1] || 'Special Month';
  };

  React.useEffect(() => {
    const fetchHostUser = async () => {
      if (!username) {
        setIsSearching(false);
        return;
      }

      // Strict registration check - do not query unless visitor is signed in
      if (!firebaseUser) {
        setIsSearching(false);
        return;
      }

      try {
        const usersRef = collection(db, 'users');
        
        // Strip leading '@' if it exists in the URL param to normalize testing variations
        const cleanHandle = username.startsWith('@') ? username.slice(1) : username;
        
        // Generate flexible variations to bypass strict case sensitivity matches completely
        const variations = Array.from(new Set([
          cleanHandle,
          cleanHandle.toLowerCase(),
          cleanHandle.toUpperCase(),
          cleanHandle.charAt(0).toUpperCase() + cleanHandle.slice(1).toLowerCase(),
          `@${cleanHandle}`,
          `@${cleanHandle.toLowerCase()}`
        ]));
        
        // Execute optimized multi-case lookup matrices
        const q1 = query(usersRef, where('handle', 'in', variations));
        const q2 = query(usersRef, where('custom_handle', 'in', variations));
        
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const matchedDoc = snap1.docs[0] || snap2.docs[0];

        if (matchedDoc) {
          const uData = matchedDoc.data();
          // ONLY load safe public fields, strictly omitting email and birth_year
          setHostUser({
            id: matchedDoc.id,
            name: uData.name || 'User',
            profile_picture_url: uData.profile_picture_url || '',
            birthday_month: uData.birthday_month || 1,
            birthday_day: uData.birthday_day || 1,
            is_private: uData.is_private || false,
            fav_sports_teams: uData.fav_sports_teams || '',
            fav_artists: uData.fav_artists || '',
            weekend_activities: uData.weekend_activities || '',
            anything_extra: uData.anything_extra || '',
            blocked_uids: uData.blocked_uids || []
          });
        }
      } catch (err) {
        console.error('Error fetching public host user:', err);
      } finally {
        setIsSearching(false);
      }
    };

    fetchHostUser();
  }, [username, firebaseUser]);

  // Handler to toggle close friend designation
  const handleToggleCloseFriend = async () => {
    const nextVal = !isCloseFriend;
    setIsCloseFriend(nextVal);

    if (alreadyInOrbit && existingPersonDocId) {
      try {
        const personRef = doc(db, 'people', existingPersonDocId);
        await updateDoc(personRef, {
          isCloseFriend: nextVal
        });
        console.log(`[Close Friend] Updated ${existingPersonDocId} isCloseFriend to ${nextVal}`);
      } catch (err) {
        console.error("Failed to update close friend status from invite link:", err);
        setIsCloseFriend(!nextVal); // rollback
      }
    }
  };

  // Handler to add host birthday & save social activity
  const handleGrabData = async () => {
    if (!hostUser || !firebaseUser || !user) return;
    
    // Explicit self-link bypass check: intercept and block adding own card
    if (firebaseUser.uid === hostUser.id) {
      console.warn("Self-link bypass: blocked creator from adding their own profile.");
      return;
    }

    setIsGrabbing(true);

    try {
      // 1. Add static doc to visitor's private 'people' roster in firestore:
      const peopleRef = collection(db, 'people');
      const formattedMonth = String(hostUser.birthday_month).padStart(2, '0');
      const formattedDay = String(hostUser.birthday_day).padStart(2, '0');
      const bDayStr = `2000-${formattedMonth}-${formattedDay}`;

      const compiledNotes = `Favorite Sports Teams: ${hostUser.fav_sports_teams || ''}\nFavorite Artists: ${hostUser.fav_artists || ''}\nWeekend Activities: ${hostUser.weekend_activities || ''}\nExtra Details: ${hostUser.anything_extra || ''}`;

      const docRef = await addDoc(peopleRef, {
        name: hostUser.name,
        nickname: hostUser.name,
        birthday: bDayStr,
        birthYearUnknown: true, 
        category: 'friend',
        importance: 4, 
        notes: compiledNotes,
        ai_notes: compiledNotes,
        interests: hostUser.fav_artists || '',
        photo_url: hostUser.profile_picture_url || '',
        user_id: firebaseUser.uid, // visitor's UID
        host_uid: hostUser.id, 
        isCloseFriend: isCloseFriend,
        created_at: serverTimestamp(),
        reminder_settings: {
          one_week_before: true,
          three_days_before: true,
          day_of: true
        }
      });

      setExistingPersonDocId(docRef.id);

      // 2. Add a record to 'social_activity' collection:
      const activityRef = collection(db, 'social_activity');
      await addDoc(activityRef, {
        host_uid: hostUser.id,
        grabber_uid: firebaseUser.uid,
        grabber_name: getDisplayName(user) || 'Anonymous Friend',
        timestamp: serverTimestamp()
      });

      // 3. Fire push ping request to Notify host immediately
      const hostUid = hostUser?.id;
      const visitorName = getDisplayName(user) || 'A Friend';
      if (hostUid && visitorName) {
        try {
          await fetch('/.netlify/functions/send-push-ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [hostUid],
              title: "Profile Saved! ⚡",
              body: `${visitorName} just added your profile card to their list.`,
              url: "/notifications"
            })
          });
        } catch (err) {
          console.warn('Failed sending push ping notify:', err);
        }
      }

      setHasGrabbed(true);
    } catch (err) {
      console.error('Error syncing birthday info:', err);
    } finally {
      setIsGrabbing(false);
    }
  };

  // Handler to send outbound friend request
  const handleSendFriendRequest = async () => {
    if (!hostUser || !firebaseUser || !user) return;
    setIsSendingRequest(true);
    try {
      const frRef = collection(db, 'friend_requests');
      await addDoc(frRef, {
        sender_uid: firebaseUser.uid,
        receiver_uid: hostUser.id,
        sender_name: getDisplayName(user) || 'A Friend',
        status: 'pending',
        members: [firebaseUser.uid, hostUser.id],
        timestamp: serverTimestamp()
      });

      // Trigger automatic high-priority background system alert
      await triggerSystemNotification(
        "New Orbit Invitation! 🚀",
        `${getDisplayName(user) || 'A Friend'} invited you to join their network Circle. Check it out now!`,
        "/notifications"
      );

      setFriendRequestSent(true);
    } catch (err) {
      console.error('Error sending friend request:', err);
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Loading spinner
  if (isLoading || isSearching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-550 dark:text-zinc-400 font-bold text-xs tracking-tight uppercase">Scanning Orbit...</p>
      </div>
    );
  }

  // Guest Handling View: If visitor is NOT logged in, freeze screen with a marketing card
  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 select-none">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[36px] text-center space-y-6 shadow-xl relative overflow-hidden"
        >
          <div className="w-16 h-16 rounded-[24px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <Sparkles size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
              Connect with {username || 'Friend'} 🎂
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
              RelateOS is a modern, clean social utility to sync birthdays, current vibes, and sport teams with your closest circle. 
            </p>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl text-[11px] text-zinc-400 font-semibold leading-relaxed">
            ✨ Register today to grab {username}'s birthday list and sync your calendar in 1 click.
          </div>
          <button
            onClick={() => {
              if (username) {
                sessionStorage.setItem('cached_host_handle', username);
              }
              navigate('/login');
            }}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
          >
            Claim My Free Account <ArrowRight size={13} />
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-500 dark:text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all"
          >
            Cancel & Return
          </button>
        </motion.div>
      </div>
    );
  }

  // Local state derivation for soft-hide blocking mechanic
  const currentUserData = user;
  const targetUserId = hostUser?.id;
  const isBlocked = !!(targetUserId && currentUserData?.blocked_uids?.includes(targetUserId));

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[32px] text-center space-y-6 shadow-xl"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Profile Hidden</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
              You have soft-hidden/blocked this user. To restore their profile's visibility, click unblock.
            </p>
          </div>
          <button 
            onClick={async () => {
              if (!firebaseUser || !targetUserId) return;
              try {
                const userRef = doc(db, 'users', firebaseUser.uid);
                await updateDoc(userRef, {
                  blocked_uids: arrayRemove(targetUserId)
                });
              } catch (unblockErr) {
                console.error("Failed to unblock target user:", unblockErr);
              }
            }}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Unblock {hostUser?.name || 'User'}
          </button>
        </motion.div>
      </div>
    );
  }

  // Profile not found
  if (!hostUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[32px] text-center space-y-6 shadow-xl"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            <ShieldAlert size={36} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Orbit Not Found</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
              We couldn't locate a profile matching "{username}". Verify that the handle link is correct.
            </p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-md cursor-pointer"
          >
            Go to Dashboard <Home size={14} />
          </button>
        </motion.div>
      </div>
    );
  }

  // Security Block Checker
  const visitorUid = firebaseUser.uid;
  const isBlockedByHost = hostUser.blocked_uids?.includes(visitorUid);
  
  if (isBlockedByHost) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 select-none">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[32px] text-center space-y-6 shadow-xl"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
            <Lock size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Profile is Locked 🔒</h1>
            <p className="text-xs text-zinc-450 dark:text-zinc-400 leading-relaxed font-semibold">
              This profile has been locked by the host and is currently unavailable.
            </p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // Host Private Shield Check
  if (hostUser.is_private) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[32px] text-center space-y-6 shadow-xl"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-105 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
            <Lock size={32} />
          </div>
          <div className="space-y-3">
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">This Profile is Private 🔒</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-405 font-semibold leading-relaxed">
              {hostUser.name}'s workspace is configured for maximum confidentiality. Direct public invitations are disabled.
            </p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all hover:bg-emerald-600 shadow-md cursor-pointer"
          >
            Launch My Dashboard ⚡
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 pt-[var(--sat)] select-none">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-3">
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
            <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-500 animate-ping opacity-20" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] uppercase tracking-wider">
              Profile Invite Link
            </span>
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white mt-1.5">
              {hostUser.name}
            </h1>
            <p className="text-xs text-zinc-400 font-bold">@{username}</p>
          </div>
        </div>

        {/* Digital Identity Premium Card showing only allowed fields */}
        <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[32px] p-6 shadow-md space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              🎂
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Birthday Month & Day</h2>
              <p className="text-sm font-extrabold text-zinc-900 dark:text-white">
                {getMonthLabel(hostUser.birthday_month)} {hostUser.birthday_day}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {hostUser.fav_sports_teams && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">🏅 Cheering For</span>
                <div className="flex flex-wrap gap-1.5">
                  {hostUser.fav_sports_teams.split(',').map((team: string, idx: number) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg border border-zinc-100 dark:border-zinc-750"
                    >
                      {team.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hostUser.fav_artists && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">🎵 Currently Jamming</span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                  {hostUser.fav_artists}
                </p>
              </div>
            )}

            {hostUser.weekend_activities && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">⚡ Favorite Weekend Activity</span>
                <p className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-xs text-zinc-650 dark:text-zinc-350 italic font-medium leading-relaxed">
                  "{hostUser.weekend_activities}"
                </p>
              </div>
            )}

            {hostUser.anything_extra && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">✨ Anything Extra</span>
                <p className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-xs text-zinc-650 dark:text-zinc-300 font-semibold leading-relaxed">
                  {hostUser.anything_extra}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Action Panel */}
        <div className="space-y-3">
          {/* Premium Close Friend Toggle Card */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${isCloseFriend ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                <Star className="w-4 h-4" fill={isCloseFriend ? "currentColor" : "none"} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Add as close friend</p>
                <p className="text-[10px] text-zinc-400 font-semibold uppercase">Enables special indicators & priority updates</p>
              </div>
            </div>
            <button
              type="button"
              id="close-friend-toggle"
              onClick={handleToggleCloseFriend}
              className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${
                isCloseFriend ? 'bg-amber-500' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              <motion.div 
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="bg-white w-5 h-5 rounded-full shadow-md"
                style={{
                  x: isCloseFriend ? 20 : 0
                }}
              />
            </button>
          </div>

          {alreadyInOrbit ? (
            <div className="space-y-3">
              <div 
                id="already-in-orbit-badge"
                className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed select-none"
              >
                Already in Orbit ✨
              </div>
              <button
                id="cancel-return-btn"
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-650 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          ) : !hasGrabbed ? (
            <div className="space-y-3">
              <button
                id="grab-data-btn"
                onClick={handleGrabData}
                disabled={isGrabbing || (firebaseUser && firebaseUser.uid === hostUser.id)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 font-black text-xs text-white uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGrabbing ? 'Saving to list...' : firebaseUser && firebaseUser.uid === hostUser.id ? "Your Own Invite Link (Cannot Add Self)" : `Add ${hostUser.name} to My Birthday List 🎂`}
              </button>
              <button
                id="cancel-return-guest-btn"
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-500 dark:text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all"
              >
                Cancel & Return
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black text-center rounded-2xl flex items-center justify-center gap-1.5 animate-bounce">
                <Check size={14} strokeWidth={3} /> Saved to Your Personal Birthday List!
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={
                    friendRequestSent || 
                    isSendingRequest || 
                    friendRequestRelationship === 'pending' || 
                    friendRequestRelationship === 'accepted'
                  }
                  onClick={handleSendFriendRequest}
                  className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    friendRequestRelationship === 'pending' || friendRequestSent
                      ? 'border-amber-500 bg-amber-500/5 text-amber-600'
                      : friendRequestRelationship === 'accepted'
                        ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-sm'
                  }`}
                >
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    {friendRequestRelationship === 'pending'
                      ? 'Request Pending ⏳'
                      : friendRequestRelationship === 'accepted'
                        ? 'Connected 🤝'
                        : friendRequestSent 
                          ? 'Sent! 🤝' 
                          : 'Send Friend Request 🤝'}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-semibold leading-tight">
                    {friendRequestRelationship === 'pending'
                      ? 'Awaiting response'
                      : friendRequestRelationship === 'accepted'
                        ? 'Connected'
                        : friendRequestSent 
                          ? 'Outbound request pending' 
                          : 'Connect accounts to sync updates'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-350 text-center flex flex-col items-center justify-center gap-2 hover:border-zinc-400 transition-all shadow-sm cursor-pointer"
                >
                  <span className="text-[11px] font-black uppercase tracking-wider">Done</span>
                  <span className="text-[9px] text-zinc-400 font-semibold leading-tight">
                    See my dashboard calendar
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
