import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Users, Globe, Sparkles, Award, Crown, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import AuraHeaderBadge from '../components/AuraHeaderBadge';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

interface LeaderboardUser {
  id: string;
  name?: string;
  custom_handle?: string;
  handle?: string;
  profile_picture_url?: string;
  relationshipScore?: number;
  leaderboardFlairUnlocked?: boolean;
  leaderboardVisibility?: 'public' | 'private';
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { firebaseUser, user: currentUserProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'friends' | 'global'>('friends');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;

    let isMounted = true;
    setLoading(true);

    const fetchLeaderboardData = async () => {
      try {
        if (activeTab === 'friends') {
          // Query accepted friends
          const frRef = collection(db, 'friend_requests');
          const qFriends = query(
            frRef,
            where('status', '==', 'accepted'),
            where('members', 'array-contains', firebaseUser.uid)
          );
          const friendSnap = await getDocs(qFriends);

          const friendUids = new Set<string>();
          friendUids.add(firebaseUser.uid); // Always include current user

          friendSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (Array.isArray(data.members)) {
              data.members.forEach((m: string) => friendUids.add(m));
            }
          });

          // Fetch user documents for all friend UIDs
          const userProfiles = await Promise.all(
            Array.from(friendUids).map(async (uid) => {
              try {
                const uDoc = await getDoc(doc(db, 'users', uid));
                if (uDoc.exists()) {
                  return { id: uDoc.id, ...uDoc.data() } as LeaderboardUser;
                }
              } catch (e) {
                console.warn(`Failed to fetch user profile for ${uid}:`, e);
              }
              return null;
            })
          );

          const validUsers = userProfiles.filter((u): u is LeaderboardUser => u !== null);
          validUsers.sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0));

          if (isMounted) {
            setUsers(validUsers);
            setLoading(false);
          }
        } else {
          // Global view: users with leaderboardVisibility == 'public'
          const usersRef = collection(db, 'users');
          const qGlobal = query(usersRef, where('leaderboardVisibility', '==', 'public'));
          const globalSnap = await getDocs(qGlobal);

          const globalUsers: LeaderboardUser[] = globalSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          } as LeaderboardUser));

          // Ensure current user is included even if their setting is private
          const currentUserInGlobal = globalUsers.some((u) => u.id === firebaseUser.uid);
          if (!currentUserInGlobal && currentUserProfile) {
            globalUsers.push({
              id: firebaseUser.uid,
              name: currentUserProfile.name,
              custom_handle: currentUserProfile.custom_handle,
              handle: currentUserProfile.handle,
              profile_picture_url: currentUserProfile.profile_picture_url,
              relationshipScore: currentUserProfile.relationshipScore || 0,
              leaderboardFlairUnlocked: currentUserProfile.leaderboardFlairUnlocked,
              leaderboardVisibility: currentUserProfile.leaderboardVisibility || 'private',
            });
          }

          globalUsers.sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0));

          if (isMounted) {
            setUsers(globalUsers);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching leaderboard data:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchLeaderboardData();

    return () => {
      isMounted = false;
    };
  }, [activeTab, firebaseUser, currentUserProfile]);

  const getRankBadge = (index: number) => {
    const rank = index + 1;
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-black text-xs shadow-sm">
          <Crown size={16} />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-zinc-300/20 border border-zinc-300/40 text-zinc-400 dark:text-zinc-300 flex items-center justify-center font-black text-xs">
          <Award size={16} />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-700/10 border border-amber-700/30 text-amber-600 dark:text-amber-500 flex items-center justify-center font-black text-xs">
          <Award size={16} />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 flex items-center justify-center font-bold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-28 pt-[calc(1.5rem+var(--sat))] px-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                Leaderboard
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Unlocked
                </span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ranked by Relationship Score
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AuraHeaderBadge />
            <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Trophy size={18} />
            </div>
          </div>
        </header>

        {/* Ranking Explainer Subheading */}
        <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold text-center max-w-sm mx-auto shadow-sm">
          <Sparkles size={14} className="shrink-0 text-emerald-500" />
          <span>Ranked by Relationship Score</span>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex bg-zinc-200/60 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Users size={14} />
            <span>Friends</span>
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'global'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Globe size={14} />
            <span>Global</span>
          </button>
        </div>

        {/* Leaderboard List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 text-center space-y-3"
            >
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Calculating Scores...
              </p>
            </motion.div>
          ) : users.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Shield size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  {activeTab === 'friends' ? 'No Connected Friends' : 'No Public Rankings Yet'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  {activeTab === 'friends'
                    ? 'Connect with friends in the app to compare your User Relationship Scores!'
                    : 'Be the first to appear on the global leaderboard by setting your Leaderboard Visibility to Public in Settings.'}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeTab}-list`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-2.5"
            >
              {users.map((u, index) => {
                const isCurrentUser = u.id === firebaseUser?.uid;
                const hasFlair = u.leaderboardFlairUnlocked === true;

                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      isCurrentUser
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 shadow-sm'
                        : hasFlair
                        ? 'bg-white dark:bg-zinc-900 border-amber-400/50 dark:border-amber-400/30 shadow-sm'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Rank Badge */}
                      {getRankBadge(index)}

                      {/* Avatar with potential flair */}
                      <div className="relative shrink-0">
                        {u.profile_picture_url ? (
                          <img
                            src={u.profile_picture_url}
                            alt={u.name || 'User'}
                            className={`w-11 h-11 rounded-full object-cover ${
                              hasFlair ? 'ring-2 ring-amber-400 dark:ring-amber-400 shadow-md shadow-amber-500/20' : ''
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm uppercase text-white ${
                              isCurrentUser
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-tr from-zinc-700 to-zinc-900'
                            } ${hasFlair ? 'ring-2 ring-amber-400 dark:ring-amber-400 shadow-md shadow-amber-500/20' : ''}`}
                          >
                            {u.name?.charAt(0) || 'U'}
                          </div>
                        )}

                        {hasFlair && (
                          <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-500 text-zinc-950 shadow-sm" title="Leaderboard Flair Unlocked">
                            <Sparkles size={10} />
                          </div>
                        )}
                      </div>

                      {/* Name & Handles */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                            {u.name || 'Anonymous User'}
                          </h4>
                          {isCurrentUser && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500 text-white">
                              You
                            </span>
                          )}
                          {hasFlair && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                              <Sparkles size={9} /> Flair
                            </span>
                          )}
                        </div>
                        {(u.custom_handle || u.handle) && (
                          <p className="text-[11px] text-zinc-400 font-medium truncate">
                            @{u.custom_handle || u.handle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Relationship Score Badge */}
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <span className="font-black text-sm">{u.relationshipScore ?? 0}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Navigation />
    </div>
  );
}
