import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  where, 
  getDocs,
  getDoc,
  deleteDoc,
  setDoc,
  limit,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  MessageSquare, 
  Calendar, 
  Trophy, 
  ArrowLeft, 
  Send, 
  Plus, 
  Clock, 
  MapPin, 
  Trash2, 
  Sparkles, 
  Camera, 
  Heart,
  Share2,
  Users,
  X
} from 'lucide-react';

export default function GroupView() {
  const { groupId } = useParams<{ groupId: string }>();
  const { firebaseUser, user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'schedule' | 'leaderboard'>('chat');
  
  // Real-time Members Dynamic Profile Data
  const [membersMetadata, setMembersMetadata] = useState<Record<string, any>>({});

  // Chat Space State
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Stories Space State
  const [stories, setStories] = useState<any[]>([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [storyImageUrl, setStoryImageUrl] = useState('');
  const [storyCaption, setStoryCaption] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);

  // Schedule Space State
  const [events, setEvents] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLoading, setEventLoading] = useState(false);

  // Leaderboard Space State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showBazaar, setShowBazaar] = useState(false);

  // Edit Hub Settings state
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTriggerTime, setEditTriggerTime] = useState('12:00');
  const [saveSettingsLoading, setSaveSettingsLoading] = useState(false);
  const [saveSettingsError, setSaveSettingsError] = useState<string | null>(null);

  // Social connection states
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [showMutualFriendsCarousel, setShowMutualFriendsCarousel] = useState(true);

  // Listen to all friend requests in real-time involving this user
  useEffect(() => {
    if (!firebaseUser) return;
    const frRef = collection(db, 'friend_requests');
    const q1 = query(frRef, where('sender_uid', '==', firebaseUser.uid));
    const q2 = query(frRef, where('receiver_uid', '==', firebaseUser.uid));

    const handleSnaps = (snap1: any, snap2: any) => {
      const list1 = snap1.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const list2 = snap2.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setFriendRequests([...list1, ...list2]);
    };

    const unsub1 = onSnapshot(q1, (snap1) => {
      getDocs(q2).then((snap2) => handleSnaps(snap1, snap2)).catch(() => {});
    }, (err) => console.warn("Handled snapshot restriction gracefully:", err.message));

    const unsub2 = onSnapshot(q2, (snap2) => {
      getDocs(q1).then((snap1) => handleSnaps(snap1, snap2)).catch(() => {});
    }, (err) => console.warn("Handled snapshot restriction gracefully:", err.message));

    return () => {
      unsub1();
      unsub2();
    };
  }, [firebaseUser]);

  // Listen to mutual friends with approved/accepted status in real-time
  useEffect(() => {
    if (!firebaseUser) return;
    const frRef = collection(db, 'friend_requests');
    const q1 = query(frRef, where('sender_uid', '==', firebaseUser.uid), where('status', '==', 'accepted'));
    const q2 = query(frRef, where('receiver_uid', '==', firebaseUser.uid), where('status', '==', 'accepted'));

    const handleMutualsSnaps = async (snap1: any, snap2: any) => {
      const list1 = snap1.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const list2 = snap2.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const combined = [...list1, ...list2];

      const friendsProfiles: any[] = [];
      for (const req of combined) {
        const friendUid = req.sender_uid === firebaseUser.uid ? req.receiver_uid : req.sender_uid;
        try {
          const uSnap = await getDoc(doc(db, 'users', friendUid));
          if (uSnap.exists()) {
            friendsProfiles.push({ uid: friendUid, id: friendUid, ...uSnap.data() });
          }
        } catch (err) {
          console.error("Error loading mutual friend details:", friendUid, err);
        }
      }
      setMutualFriends(friendsProfiles);
    };

    const unsub1 = onSnapshot(q1, (snap1) => {
      getDocs(q2).then((snap2) => handleMutualsSnaps(snap1, snap2)).catch(() => {});
    }, (err) => console.warn("Handled snapshot restriction gracefully:", err.message));

    const unsub2 = onSnapshot(q2, (snap2) => {
      getDocs(q1).then((snap1) => handleMutualsSnaps(snap1, snap2)).catch(() => {});
    }, (err) => console.warn("Handled snapshot restriction gracefully:", err.message));

    return () => {
      unsub1();
      unsub2();
    };
  }, [firebaseUser]);

  const getFriendshipStatus = (targetUid: string) => {
    if (targetUid === firebaseUser?.uid) return 'self';
    const found = friendRequests.find(fr => 
      (fr.sender_uid === firebaseUser?.uid && fr.receiver_uid === targetUid) ||
      (fr.sender_uid === targetUid && fr.receiver_uid === firebaseUser?.uid)
    );
    if (!found) return null;
    return found.status;
  };

  const friendsNotInGroup = mutualFriends.filter(f => !group?.members?.includes(f.uid));

  const handleAddFriendToGroup = async (friendUid: string) => {
    if (!groupId) return;
    try {
      await updateDoc(doc(db, 'spark_groups', groupId), {
        members: arrayUnion(friendUid)
      });
      confetti({ particleCount: 40, spread: 50 });
    } catch (err) {
      console.error("Error adding friend straight to squad:", err);
    }
  };

  const handleLeaveCircle = async () => {
    if (!groupId || !firebaseUser || !group) return;
    if (window.confirm("Are you sure you want to leave this Friend Circle? You can freely return with standard code or link access later.")) {
      try {
        const groupRef = doc(db, 'spark_groups', groupId);
        await updateDoc(groupRef, {
          members: arrayRemove(firebaseUser.uid)
        });
        navigate('/groups');
      } catch (e) {
        console.error("Error leaving friendship circle:", e);
      }
    }
  };

  const currentUserAuraItem = leaderboard.find(item => item.userId === firebaseUser?.uid);
  const userAura = currentUserAuraItem?.total_aura || 0;

  const handlePurchaseItem = async (item: { id: string, name: string, cost: number }) => {
    if (!groupId || !firebaseUser) return;
    try {
      const auraDocRef = doc(db, `spark_groups/${groupId}/aura`, firebaseUser.uid);
      const newTotal = userAura - item.cost;
      const spent = (currentUserAuraItem?.spent_aura || 0) + item.cost;
      
      await setDoc(auraDocRef, {
        total_aura: newTotal,
        spent_aura: spent
      }, { merge: true });

      confetti({ particleCount: 30, spread: 40 });
      alert(`Successfully unlocked ${item.name}! Applied to your active inventory.`);
    } catch (e) {
      console.error("Error purchasing item:", e);
      alert("Failed to purchase item under current security rules/connection.");
    }
  };

  // Default presets for stories
  const storyPresets = [
    { url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400', label: 'Workout Vibe' },
    { url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=400', label: 'Match Day' },
    { url: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400', label: 'Celebration' },
    { url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=400', label: 'Coffee Hangout' },
  ];

  // 1. Fetch Group Base Details & Dynamic Profiles
  useEffect(() => {
    if (!groupId || !firebaseUser) return;

    const groupRef = doc(db, 'spark_groups', groupId);
    const unsubscribe = onSnapshot(groupRef, async (snap) => {
      if (!snap.exists()) {
        console.error("Group not found");
        navigate('/groups');
        return;
      }
      
      const data = snap.data();
      setGroup({ id: snap.id, ...data });

      // Fetch user profiles for all members dynamically
      if (data.members && data.members.length > 0) {
        const metadata: Record<string, any> = {};
        for (const memberId of data.members) {
          try {
            const userSnap = await getDoc(doc(db, 'users', memberId));
            if (userSnap.exists()) {
              metadata[memberId] = userSnap.data();
            } else {
              metadata[memberId] = { name: 'Player', profile_picture_url: null };
            }
          } catch (e) {
            console.error("Error fetching user profile:", memberId, e);
            metadata[memberId] = { name: 'Player', profile_picture_url: null };
          }
        }
        setMembersMetadata(metadata);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, firebaseUser, navigate]);

  // 2. Real-time Locker Room Chat Messages
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;
    if (activeTab !== 'chat') return;

    const msgsQuery = query(
      collection(db, `spark_groups/${groupId}/messages`),
      orderBy('created_at', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(msgsQuery, (snapshot) => {
      const chatMsgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(chatMsgs);
      setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribe();
  }, [groupId, firebaseUser, group, activeTab]);

  // 3. Real-time Locker Stories (Lasting 24 hours nominally, or loaded descending)
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;
    if (activeTab !== 'chat') return;

    const storiesQuery = query(
      collection(db, `spark_groups/${groupId}/stories`),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(storiesQuery, (snapshot) => {
      const loadedStories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStories(loadedStories);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribe();
  }, [groupId, firebaseUser, group, activeTab]);

  // 4. Real-time Squad Schedule
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;
    if (activeTab !== 'schedule') return;

    const eventsQuery = query(
      collection(db, `spark_groups/${groupId}/events`),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const loadedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(loadedEvents);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribe();
  }, [groupId, firebaseUser, group, activeTab]);

  // 5. Real-time Leaderboard Rankings based on Group Aura subcollection
  useEffect(() => {
    if (!groupId || !firebaseUser || !group?.members?.includes(firebaseUser.uid)) return;

    const auraQuery = collection(db, `spark_groups/${groupId}/aura`);
    const unsubscribe = onSnapshot(auraQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...(doc.data() as any)
      }));
      
      // Sort in descending order of total_aura
      list.sort((a, b) => (b.total_aura || 0) - (a.total_aura || 0));
      setLeaderboard(list);
    }, (err) => {
      console.warn("Handled snapshot restriction gracefully:", err.message);
    });

    return () => unsubscribe();
  }, [groupId, firebaseUser, group]);

  // Save Hub Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !firebaseUser || !editName.trim()) return;

    setSaveSettingsLoading(true);
    setSaveSettingsError(null);

    try {
      await updateDoc(doc(db, 'spark_groups', groupId), {
        name: editName.trim(),
        trigger_time: editTriggerTime
      });
      setShowEditSettings(false);
    } catch (err: any) {
      console.error("Error updating hub settings:", err);
      setSaveSettingsError("Failed to update settings. Please try again.");
    } finally {
      setSaveSettingsLoading(false);
    }
  };

  // Post Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !firebaseUser || !newMessage.trim()) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, `spark_groups/${groupId}/messages`), {
        text: msgText,
        sender_id: firebaseUser.uid,
        user_id: firebaseUser.uid,
        sender_name: user?.name || firebaseUser.email || 'Friend',
        sender_picture: user?.profile_picture_url || '',
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error sending message:", e);
    }
  };

  // Create Locker Story
  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !firebaseUser || !storyImageUrl) return;

    setStoryLoading(true);
    try {
      await addDoc(collection(db, `spark_groups/${groupId}/stories`), {
        image_url: storyImageUrl,
        caption: storyCaption.trim(),
        user_id: firebaseUser.uid,
        user_name: user?.name || firebaseUser.email || 'Player',
        created_at: new Date().toISOString()
      });

      // Clear & Close
      setStoryImageUrl('');
      setStoryCaption('');
      setShowStoryModal(false);
    } catch (e) {
      console.error("Error adding story:", e);
    } finally {
      setStoryLoading(false);
    }
  };

  // Add squad Event
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !firebaseUser || !eventTitle.trim() || !eventDate) return;

    setEventLoading(true);
    try {
      await addDoc(collection(db, `spark_groups/${groupId}/events`), {
        title: eventTitle.trim(),
        date: eventDate,
        time: eventTime || 'All Day',
        location: eventLocation.trim() || 'TBD',
        desc: eventDesc.trim(),
        creator_id: firebaseUser.uid,
        user_id: firebaseUser.uid,
        creator_name: user?.name || 'Organizer',
        created_at: new Date().toISOString()
      });

      // Clear & Close
      setEventTitle('');
      setEventDate('');
      setEventTime('');
      setEventLocation('');
      setEventDesc('');
      setShowEventModal(false);
    } catch (e) {
      console.error("Error adding event:", e);
    } finally {
      setEventLoading(false);
    }
  };

  // Delete squad Event (any member can remove)
  const handleDeleteEvent = async (eventId: string, creatorId: string) => {
    if (!groupId || !firebaseUser) return;

    if (window.confirm("Are you sure you want to delete this squad event?")) {
      try {
        await deleteDoc(doc(db, `spark_groups/${groupId}/events`, eventId));
      } catch (e) {
        console.error("Error deleting event:", e);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white gap-4">
        <p className="font-bold">Group Hub not found.</p>
        <Link to="/groups" className="text-emerald-500 font-extrabold uppercase tracking-widest text-xs">Back to Directory</Link>
      </div>
    );
  }

  return (
    <div id="group-view-page" className="pb-12 pt-[calc(1.5rem+var(--sat))] bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-2rem)]">

        {/* Top Header Row */}
        <header className="flex items-center justify-between pb-3 px-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Link to="/groups" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight leading-tight">{group.name}</h1>
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                <span>{group.type}</span>
                <span>•</span>
                <span>{(group.members || []).filter((memberId: string) => !(user?.blocked_uids || []).includes(memberId)).length || 1} playing</span>
              </div>
              {/* Prominent Invite Code & Copy Invite Link Button */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="bg-zinc-150 dark:bg-zinc-800 text-zinc-805 dark:text-zinc-200 px-2 py-0.5 rounded text-xs font-black font-mono tracking-wide">
                  CODE: {group.invite_code}
                </span>
                <button
                  onClick={() => {
                    const shareUrl = window.location.origin + '/groups?join=' + group.invite_code;
                    navigator.clipboard.writeText(shareUrl);
                    alert('Invite link copied: ' + shareUrl);
                  }}
                  className="flex items-center gap-1 text-[11px] font-black text-emerald-500 hover:underline cursor-pointer"
                >
                  <span>Copy Invite Link 🔗</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBazaar(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900/10 hover:bg-zinc-900/20 dark:bg-white/10 dark:hover:bg-white/15 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 text-zinc-900 dark:text-white rounded-full text-xs font-black shadow-sm transition-all hover:scale-105 cursor-pointer"
              >
                <span>⚡ {userAura} Aura</span>
              </button>
              <Link
                to={`/spark/${group.id}`}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-full text-xs font-extrabold hover:scale-105 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <Sparkles size={12} className="animate-pulse" />
                <span>Daily Game</span>
              </Link>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => {
                  setEditName(group.name);
                  setEditTriggerTime(group.trigger_time || '12:00');
                  setShowEditSettings(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-full text-[11px] font-bold cursor-pointer transition-all shadow-sm"
              >
                <span>Hub Settings ⚙️</span>
              </button>
              <button
                onClick={handleLeaveCircle}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450 border border-rose-220/30 rounded-full text-[11px] font-bold cursor-pointer transition-all shadow-sm"
              >
                <span>Leave Circle 🚪</span>
              </button>
            </div>
          </div>
        </header>

        {/* MUTUAL FRIENDS CAROUSEL BAR (Directly beneath the header) */}
        {showMutualFriendsCarousel && friendsNotInGroup.length > 0 && (
          <div className="mx-4 mt-3 p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl relative">
            <button
              onClick={() => setShowMutualFriendsCarousel(false)}
              className="absolute top-2.5 right-2.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all cursor-pointer"
              title="Close Suggestions"
            >
              <X size={14} />
            </button>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-450 flex items-center gap-1 px-1 mb-1.5 pr-6">
              <span>Add Mutual Friends 👥</span>
            </p>
            <div className="flex overflow-x-auto scrollbar-hide gap-3 py-1">
              {friendsNotInGroup.map((friend) => (
                <div 
                  key={friend.uid} 
                  className="flex items-center gap-2 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl shadow-sm min-w-[170px] flex-shrink-0"
                >
                  {friend.profile_picture_url ? (
                    <img 
                      src={friend.profile_picture_url} 
                      alt={friend.name} 
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-black text-[10px]">
                      {friend.name?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate text-zinc-900 dark:text-white">
                      {friend.name?.split(' ')[0] || friend.name || 'Friend'}
                    </p>
                  </div>
                  <button
                     onClick={() => handleAddFriendToGroup(friend.uid)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg whitespace-nowrap transition-all shadow-sm cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spaces Sub-navigation Tabs */}
        <div className="flex justify-around bg-white dark:bg-zinc-900/60 p-1 rounded-2xl mx-4 mt-4 border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'chat' 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-md' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare size={15} />
            <span>Locker Space</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-3 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'schedule' 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-md' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Calendar size={15} />
            <span>Schedule</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-3 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'leaderboard' 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-md' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Trophy size={15} />
            <span>Rankings</span>
          </button>
        </div>

        {/* Tab Scroll Content Stage */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          <AnimatePresence mode="wait">
            {/* TAB 1: LOCKER ROOM CHAT & STORIES */}
            {activeTab === 'chat' && (
              <motion.div
                key="chat-space"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col h-full space-y-4"
              >
                {/* 24h Locker Stories Header Segment */}
                <div className="flex flex-col gap-2.5 pb-2 border-b border-zinc-150 dark:border-zinc-800">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Locker Stories (24h Vibe)</span>
                    <button 
                      onClick={() => setShowStoryModal(true)}
                      className="text-[11px] font-black text-emerald-500 flex items-center gap-1.5 hover:underline cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Post Story</span>
                    </button>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x mask-fade">
                    {/* Native Add Item */}
                    <div 
                      onClick={() => setShowStoryModal(true)}
                      className="flex-shrink-0 w-20 flex flex-col items-center gap-1 cursor-pointer snap-start"
                    >
                      <div className="w-14 h-14 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-white dark:bg-zinc-900 text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 transition-all">
                        <Camera size={18} />
                      </div>
                      <span className="text-[9px] font-bold text-zinc-400">Post Vibe</span>
                    </div>

                    {/* Loaded Stories */}
                    {stories.map((story) => (
                      <div 
                        key={story.id}
                        className="flex-shrink-0 w-20 flex flex-col items-center gap-1 text-center snap-start"
                        title={story.caption}
                      >
                        <div className="relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-emerald-400 to-teal-500">
                          <img 
                            src={story.image_url} 
                            alt={story.user_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover rounded-full bg-zinc-100"
                          />
                        </div>
                        <span className="text-[9px] font-black tracking-tight text-zinc-650 dark:text-zinc-300 truncate w-full">
                          {story.user_name?.split(' ')[0]}
                        </span>
                      </div>
                    ))}
                    
                    {stories.length === 0 && (
                      <div className="flex items-center text-[10px] text-zinc-400 font-bold px-4 max-w-xs leading-tight">
                        No stories posted today yet. Be the first! ✨
                      </div>
                    )}
                  </div>
                </div>

                {/* Real-time Messages Stream */}
                <div className="flex-1 bg-white/40 dark:bg-zinc-900/10 rounded-3xl p-4 border border-zinc-200/50 dark:border-zinc-800/20 overflow-y-auto space-y-3 min-h-[250px]">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === firebaseUser.uid;
                    const senderData = membersMetadata[msg.sender_id] || {};
                    const avatarUrl = senderData.profile_picture_url || msg.sender_picture;
                    const displayName = senderData.name || msg.sender_name;

                    return (
                      <div 
                        key={msg.id} 
                        className={`flex items-start gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt={displayName} 
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 flex items-center justify-center font-black text-[10px] flex-shrink-0">
                            {displayName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <span className={`text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest pl-1 block ${isMe ? 'text-right pr-1' : ''}`}>
                            {displayName}
                          </span>
                          <div className={`p-3.5 rounded-2xl text-xs leading-relaxed font-medium shadow-sm ${
                            isMe 
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-none' 
                              : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-800 rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {messages.length === 0 && (
                    <div className="h-full flex flex-col justify-center items-center text-center p-8 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-300">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs">Locker Chat is live</h4>
                        <p className="text-[10px] text-zinc-400">Discuss tactics, match times, or daily game hints!</p>
                      </div>
                    </div>
                  )}
                  <div ref={chatScrollRef} />
                </div>

                {/* Message Send Form */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text"
                    required
                    placeholder="Message the locker room..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 py-3 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-emerald-500 disabled:opacity-40 rounded-full transition-all cursor-pointer shadow-md shadow-zinc-500/10"
                  >
                    <Send size={15} />
                  </button>
                </form>

              </motion.div>
            )}

            {/* TAB 2: SQUAD SCHEDULE */}
            {activeTab === 'schedule' && (
              <motion.div
                key="schedule-space"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6 flex flex-col h-full"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-base">Squad Schedule & Meetups</h3>
                    <p className="text-[11px] text-zinc-500">Plan matches, workout timings, or social hangs in one calendar room.</p>
                  </div>
                  <button 
                    onClick={() => setShowEventModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Plan Event</span>
                  </button>
                </div>

                {/* Event Cards List */}
                <div className="space-y-3.5 flex-1 overflow-y-auto">
                  {events.map((evt) => {
                    // Match date strings to clean visual presentation
                    const dateObj = new Date(evt.date);
                    const formattedDate = dateObj.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div 
                        key={evt.id}
                        className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm flex items-start justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest font-mono font-black text-emerald-500 px-2 py-0.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-md">
                              {formattedDate} • {evt.time}
                            </span>
                          </div>
                          
                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm">{evt.title}</h4>
                            {evt.desc && (
                              <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">{evt.desc}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-450 dark:text-zinc-400 font-bold">
                            <span className="flex items-center gap-1">
                              <MapPin size={11} className="text-zinc-400" />
                              <span>{evt.location}</span>
                            </span>
                            <span className="text-zinc-400">Organized by {evt.creator_name}</span>
                          </div>
                        </div>

                        {firebaseUser && (
                          <button 
                            onClick={() => handleDeleteEvent(evt.id, evt.creator_id)}
                            className="p-1.5 text-zinc-300 hover:text-rose-500 hover:bg-rose-500/5 rounded-lg transition-all cursor-pointer"
                            title="Remove card"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {events.length === 0 && (
                    <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-300">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs">No Scheduled Meetups</h4>
                        <p className="text-[10px] text-zinc-400 max-w-xs mx-auto">Create match plans or group meetups to coordinate with everyone easily!</p>
                      </div>
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* TAB 3: GROUP LEADERBOARD */}
            {activeTab === 'leaderboard' && (
              <motion.div
                key="leaderboard-space"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="font-extrabold text-base">Group Leaderboard Rankings</h3>
                  <p className="text-[11px] text-zinc-500">Ranked by points won during active Spark daily interactive social deduction games.</p>
                </div>

                {/* Scoreboard List */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
                  {leaderboard.map((lbUser, index) => {
                    const memberProfile = membersMetadata[lbUser.userId] || {};
                    const name = memberProfile.name || 'Friend';
                    const avatarUrl = memberProfile.profile_picture_url || '';
                    const isMe = lbUser.userId === firebaseUser.uid;

                    // Medal or index style
                    const isFirst = index === 0;
                    const isSecond = index === 1;
                    const isThird = index === 2;

                    return (
                      <div 
                        key={lbUser.userId}
                        className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                          isMe ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank indicator */}
                          <div className="w-6 text-center font-bold font-mono text-xs text-zinc-400">
                            {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `${index + 1}`}
                          </div>

                          {/* Profile Head */}
                          {avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt={name} 
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 flex items-center justify-center font-black text-xs uppercase">
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <span className="font-extrabold text-sm">{name}</span>
                            {isMe && <span className="ml-1.5 text-[9px] uppercase font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-md leading-none">You</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-base font-black font-mono text-emerald-500">
                            {lbUser.total_aura || 0}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-0.5">Aura</span>
                        </div>
                      </div>
                    );
                  })}

                  {leaderboard.length === 0 && (
                    <div className="p-12 text-center text-zinc-400 font-bold text-xs space-y-1">
                      <p>Leaderboard empty.</p>
                      <p className="text-[10px] font-normal">Play or invite friends to accumulate points!</p>
                    </div>
                  )}
                </div>

                {/* Circle Roster Section */}
                <div className="space-y-3 mt-8">
                  <div>
                    <h3 className="font-extrabold text-base">Circle Roster 👥</h3>
                    <p className="text-[11px] text-zinc-500">All registered participants of {group?.name}. Add new friends with a simple tap!</p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
                    {(group?.members || []).filter((memberId: string) => !(user?.blocked_uids || []).includes(memberId)).map((memberId: string) => {
                      const memberProfile = membersMetadata[memberId] || {};
                      const name = memberProfile.name || 'Friend';
                      const avatarUrl = memberProfile.profile_picture_url || '';
                      const isMe = memberId === firebaseUser?.uid;

                      const status = getFriendshipStatus(memberId);
                      
                      return (
                        <div key={memberId} className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {avatarUrl ? (
                              <img 
                                src={avatarUrl} 
                                alt={name} 
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 flex items-center justify-center font-black text-xs uppercase">
                                {name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-extrabold text-sm">{name}</span>
                              {isMe && <span className="ml-1.5 text-[9px] uppercase font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-md leading-none">You</span>}
                            </div>
                          </div>

                          {!isMe && (
                            <div>
                              {status === 'accepted' || status === 'approved' ? (
                                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-md">Friends 🤝</span>
                              ) : status === 'pending' ? (
                                <span className="text-[10px] uppercase font-black tracking-wider text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded-md">Pending ⏳</span>
                              ) : (
                                <button
                                  onClick={async () => {
                                    try {
                                      await addDoc(collection(db, 'friend_requests'), {
                                        sender_uid: firebaseUser?.uid,
                                        receiver_uid: memberId,
                                        status: 'pending',
                                        created_at: new Date().toISOString()
                                      });
                                    } catch (err) {
                                      console.error("Error triggering friend request:", err);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-zinc-950 hover:bg-emerald-500 hover:text-white text-white dark:bg-zinc-50 dark:text-zinc-950 rounded-xl text-xs font-black transition-colors cursor-pointer"
                                >
                                  + Add Friend
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* Story Creator Modal */}
      <AnimatePresence>
        {showStoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStoryModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 space-y-6"
            >
              <div>
                <h3 className="text-lg font-extrabold">Post a Locker Room Story</h3>
                <p className="text-xs text-zinc-500">Share match clips, workout motivation, or daily snippets!</p>
              </div>

              <form onSubmit={handlePostStory} className="space-y-4">
                
                {/* Image Selection Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Select vibe background or paste link</label>
                  <div className="grid grid-cols-4 gap-2">
                    {storyPresets.map((pr) => (
                      <button
                        key={pr.label}
                        type="button"
                        onClick={() => setStoryImageUrl(pr.url)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          storyImageUrl === pr.url ? 'border-emerald-500 scale-95' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        title={pr.label}
                      >
                        <img 
                          src={pr.url} 
                          alt={pr.label} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                        />
                      </button>
                    ))}
                  </div>
                  
                  <input 
                    type="url"
                    placeholder="Or paste a custom image URL..."
                    value={storyImageUrl}
                    onChange={(e) => setStoryImageUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 mt-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 font-mono">Caption / Title</label>
                  <input 
                    type="text"
                    placeholder="e.g. Wednesday running squad early training! 🏃‍♂️"
                    value={storyCaption}
                    onChange={(e) => setStoryCaption(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-zinc-150 dark:border-zinc-800/80">
                  <button 
                    type="button"
                    onClick={() => setShowStoryModal(false)}
                    className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 font-bold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={storyLoading || !storyImageUrl}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/10"
                  >
                    {storyLoading ? "Posting..." : "Post Vibe"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Creator Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 space-y-5"
            >
              <div>
                <h3 className="text-base font-extrabold">Plan a Squad Meetup</h3>
                <p className="text-[11px] text-zinc-500">Plan a game match, a team practice, or weekend hangout card.</p>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Meetup Title / Match</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Wednesday Basketball Classic Match"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full px-3,5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Date</label>
                    <input 
                      type="date" 
                      min="2026-01-01"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Time</label>
                    <input 
                      type="time" 
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Location / Court</label>
                  <input 
                    type="text"
                    placeholder="e.g. Downtown Central Court Arena"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Short details (optional)</label>
                  <input 
                    type="text"
                    placeholder="Be there 10 mins early for warmups!"
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                  <button 
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 font-bold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={eventLoading || !eventTitle.trim() || !eventDate}
                    className="flex-1 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold rounded-xl text-xs"
                  >
                    {eventLoading ? "Adding..." : "Schedule"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Hub Settings Modal */}
      <AnimatePresence>
        {showEditSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditSettings(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 space-y-5"
            >
              <div>
                <h3 className="text-base font-extrabold">Edit Hub Settings ⚙️</h3>
                <p className="text-[11px] text-zinc-500">Update your circle hub's details. Only the owner can change these parameters.</p>
              </div>

              {saveSettingsError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-500 text-center text-xs font-bold">
                  {saveSettingsError}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Hub Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Wednesday Basketball Classic"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded-xl text-xs font-semibold animate-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">Daily Trigger Time (HH:MM)</label>
                  <input 
                    type="time" 
                    required
                    value={editTriggerTime}
                    onChange={(e) => setEditTriggerTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                  <button 
                    type="button"
                    onClick={() => setShowEditSettings(false)}
                    className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-805 text-zinc-650 dark:text-zinc-300 font-bold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saveSettingsLoading || !editName.trim()}
                    className="flex-1 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    {saveSettingsLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Aura Points Bazaar Slide-up Drawer */}
      <AnimatePresence>
        {showBazaar && (
          <div key="bazaar-drawer" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            {/* Backdrop click closer */}
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setShowBazaar(false)} 
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 z-10"
            >
              {/* Drag Handle indicator */}
              <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-5" />

              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white">
                    <span>Aura Bazaar 🏛️</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Spend your daily game achievements on premium squad perks</p>
                </div>
                <div className="bg-zinc-900/10 dark:bg-white/10 px-3 py-1.5 border border-zinc-200/50 dark:border-white/10 rounded-xl text-sm font-extrabold flex items-center gap-1 text-zinc-900 dark:text-white">
                  <span>⚡ {userAura} Aura</span>
                </div>
              </div>

              {/* 2x2 Grid of Bazaar Items */}
              <div className="grid grid-cols-2 gap-4 mb-6 animation-none">
                {[
                  { id: 'decoy_scanner', name: 'Decoy Scanner 📡', cost: 40, description: 'Sniff out decoy answers used by other players.' },
                  { id: 'smoke_bomb', name: 'Smoke Bomb 💨', cost: 25, description: 'Partially obscure your daily match guess answers.' },
                  { id: 'incognito', name: 'Incognito Toggle 🎭', cost: 60, description: 'Go fully incognito and hide your leaderboard presence.' },
                  { id: 'leaderboard_crown', name: 'Leaderboard Crown 👑', cost: 100, description: 'Flaunt a dynamic crown beside your name for 3 days.' }
                ].map((item) => {
                  const isLocked = userAura < item.cost;
                  return (
                    <div 
                      key={item.id}
                      className={`flex flex-col justify-between p-4 bg-zinc-100/40 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-800/80 rounded-2xl text-left transition-all ${
                        isLocked ? 'opacity-40' : 'hover:border-emerald-500/30'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1 pb-1">
                          <p className="font-extrabold text-[13px] text-zinc-900 dark:text-white leading-snug">{item.name}</p>
                          <span className="text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                            {item.cost}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1 mb-3">{item.description}</p>
                      </div>

                      <button
                        onClick={() => {
                          if (!isLocked) {
                            handlePurchaseItem(item);
                          }
                        }}
                        disabled={isLocked}
                        className={`w-full py-2 font-extrabold text-xs rounded-xl cursor-pointer transition-all ${
                          isLocked 
                            ? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 cursor-not-allowed' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:scale-[1.02]'
                        }`}
                      >
                        {isLocked ? 'Locked 🔒' : 'Unlock ⚡'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowBazaar(false)}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-805 text-zinc-650 dark:text-zinc-300 font-bold rounded-2xl text-xs transition-all cursor-pointer"
              >
                Close Bazaar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
