import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PieChart, TrendingUp, Award, HeartPulse, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import AuraHeaderBadge from '../components/AuraHeaderBadge';
import HelpTip from '../components/HelpTip';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { calculateRelationshipHealthScore } from '../lib/healthScore';
import { HealthScoreBadge } from '../components/HealthScoreBadge';
import { cn } from '../lib/utils';

function parseTimestampDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        return isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000);
    }
  }
  return null;
}

export default function Analytics() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [showBreakdown, setShowBreakdown] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!firebaseUser) return;
      try {
        const peopleRef = collection(db, 'people');
        const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
        const querySnapshot = await getDocs(q);
        const peopleDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch subcollections for each person for the health score engine
        const peopleWithSubcollections = await Promise.all(peopleDocs.map(async (p: any) => {
          try {
            const memoriesRef = collection(db, 'people', p.id, 'memories');
            const mSnap = await getDocs(memoriesRef);
            const memories = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const reflectionsRef = collection(db, 'people', p.id, 'reflections');
            const rSnap = await getDocs(reflectionsRef);
            const reflections = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const photosRef = collection(db, 'people', p.id, 'photos');
            const phSnap = await getDocs(photosRef);
            const photos = phSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const giftsRef = collection(db, 'people', p.id, 'gifts');
            const gSnap = await getDocs(giftsRef);
            const gifts = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            return {
              ...p,
              memories,
              reflections,
              photos,
              gifts
            };
          } catch (err) {
            return p;
          }
        }));

        let roomsByPerson: Record<string, any[]> = {};
        try {
          const roomsRef = collection(db, 'rooms');
          const roomsSnap = await getDocs(roomsRef);
          roomsSnap.docs.forEach(doc => {
            const rm = doc.data();
            if (rm.person_id) {
              if (!roomsByPerson[rm.person_id]) roomsByPerson[rm.person_id] = [];
              roomsByPerson[rm.person_id].push({ id: doc.id, ...rm });
            }
          });
        } catch (e) {
          console.error("Error fetching rooms for analytics:", e);
        }

        // Calculate health scores
        const peopleHealthScores = peopleWithSubcollections.map((p: any) => {
          const pRooms = roomsByPerson[p.id] || [];
          const healthResult = calculateRelationshipHealthScore({
            person: p,
            memories: p.memories || [],
            reflections: p.reflections || [],
            photos: p.photos || [],
            gifts: p.gifts || [],
            rooms: pRooms
          });
          return {
            person: p,
            healthResult
          };
        });

        const totalScore = peopleHealthScores.reduce((acc, item) => acc + item.healthResult.score, 0);
        const avgHealthScore = peopleHealthScores.length > 0 ? Math.round(totalScore / peopleHealthScores.length) : 0;

        let avgHealthLabel: 'Thriving' | 'Stable' | 'Fading' | 'Dormant' = 'Dormant';
        if (avgHealthScore >= 80) avgHealthLabel = 'Thriving';
        else if (avgHealthScore >= 55) avgHealthLabel = 'Stable';
        else if (avgHealthScore >= 30) avgHealthLabel = 'Fading';

        let avgBadgeStyle = {
          bg: 'bg-zinc-500/10 dark:bg-zinc-800/80',
          text: 'text-zinc-600 dark:text-zinc-300',
          border: 'border-zinc-300 dark:border-zinc-700',
          dot: 'bg-zinc-400'
        };

        if (avgHealthLabel === 'Thriving') {
          avgBadgeStyle = {
            bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
            text: 'text-emerald-700 dark:text-emerald-400',
            border: 'border-emerald-500/30 dark:border-emerald-800/60',
            dot: 'bg-emerald-500'
          };
        } else if (avgHealthLabel === 'Stable') {
          avgBadgeStyle = {
            bg: 'bg-blue-500/10 dark:bg-blue-950/40',
            text: 'text-blue-700 dark:text-blue-400',
            border: 'border-blue-500/30 dark:border-blue-800/60',
            dot: 'bg-blue-500'
          };
        } else if (avgHealthLabel === 'Fading') {
          avgBadgeStyle = {
            bg: 'bg-amber-500/10 dark:bg-amber-950/40',
            text: 'text-amber-700 dark:text-amber-400',
            border: 'border-amber-500/30 dark:border-amber-800/60',
            dot: 'bg-amber-500'
          };
        }

        const healthDistribution = [
          { status: 'Thriving', count: peopleHealthScores.filter(item => item.healthResult.label === 'Thriving').length, color: '#10b981' },
          { status: 'Stable', count: peopleHealthScores.filter(item => item.healthResult.label === 'Stable').length, color: '#3b82f6' },
          { status: 'Fading', count: peopleHealthScores.filter(item => item.healthResult.label === 'Fading').length, color: '#f59e0b' },
          { status: 'Dormant', count: peopleHealthScores.filter(item => item.healthResult.label === 'Dormant').length, color: '#6b7280' }
        ];

        const needsAttention = [...peopleHealthScores]
          .sort((a, b) => a.healthResult.score - b.healthResult.score)
          .slice(0, 5);

        // Calculate User Relationship Score (0-100)
        // 1. weightedHealthScore (35%)
        let weightedSum = 0;
        let totalWeight = 0;
        let thrivingOrStableCount = 0;

        peopleHealthScores.forEach(({ person, healthResult }) => {
          const imp = [1, 2, 3, 4, 5].includes(Number(person.importance)) ? Number(person.importance) : 3;
          weightedSum += healthResult.score * imp;
          totalWeight += imp;
          if (healthResult.label === 'Thriving' || healthResult.label === 'Stable') {
            thrivingOrStableCount++;
          }
        });

        const weightedHealthScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

        // 2. consistencyScore (25%) & 4. activeEffortScore (20%)
        const now = new Date();
        const nowMs = now.getTime();
        const thirtyDaysAgoMs = nowMs - (30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgoMs = nowMs - (90 * 24 * 60 * 60 * 1000);

        const activeDates30Set = new Set<string>();
        let effortActions90Count = 0;

        peopleWithSubcollections.forEach((p: any) => {
          const pRooms = roomsByPerson[p.id] || [];

          const addAction = (dateVal: any, isEffortAction = true) => {
            const d = parseTimestampDate(dateVal);
            if (!d) return;
            const ms = d.getTime();
            if (ms > nowMs) return;

            if (ms >= thirtyDaysAgoMs) {
              const dateStr = d.toISOString().split('T')[0];
              activeDates30Set.add(dateStr);
            }

            if (isEffortAction && ms >= ninetyDaysAgoMs) {
              effortActions90Count++;
            }
          };

          if (p.lastCheckIn?.date) addAction(p.lastCheckIn.date, false);
          if (Array.isArray(p.checkInHistory)) {
            p.checkInHistory.forEach((h: any) => h?.date && addAction(h.date, false));
          }
          if (p.updated_at) addAction(p.updated_at, false);

          if (Array.isArray(p.memories)) {
            p.memories.forEach((m: any) => addAction(m.created_at || m.date, true));
          }
          if (Array.isArray(p.reflections)) {
            p.reflections.forEach((r: any) => addAction(r.created_at || r.date, true));
          }
          if (Array.isArray(p.photos)) {
            p.photos.forEach((ph: any) => addAction(ph.uploadedAt || ph.uploaded_at || ph.created_at, true));
          }
          if (Array.isArray(p.gifts)) {
            p.gifts.forEach((g: any) => {
              if (g.status === 'given') addAction(g.date || g.created_at, true);
            });
          }
          if (Array.isArray(pRooms)) {
            pRooms.forEach((rm: any) => addAction(rm.created_at, true));
          }
        });

        const activeDays30 = Math.min(30, activeDates30Set.size);
        const consistencyScore = Math.min(100, Math.round((activeDays30 / 30) * 100));

        // 3. breadthScore (20%)
        const totalPeopleCount = peopleDocs.length;
        let breadthScore = 0;
        if (totalPeopleCount > 0) {
          const ratio = thrivingOrStableCount / totalPeopleCount;
          const scale = Math.log2(totalPeopleCount + 1) / 2;
          breadthScore = Math.min(100, Math.round(ratio * 100 * scale));
        }

        // 4. activeEffortScore (20%)
        const activeEffortScore = Math.min(100, Math.round(Math.log2(effortActions90Count + 1) * 20));

        // Overall User Relationship Score
        const userRelationshipScore = totalPeopleCount === 0 ? 0 : Math.min(100, Math.max(0, Math.round(
          weightedHealthScore * 0.35 +
          consistencyScore * 0.25 +
          breadthScore * 0.20 +
          activeEffortScore * 0.20
        )));

        // Persist computed relationship score to user's Firestore document
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          await updateDoc(userDocRef, { relationshipScore: userRelationshipScore });
        } catch (updateErr) {
          console.error('Failed to persist relationship score:', updateErr);
        }

        const userScoreBreakdown = {
          weightedHealthScore,
          consistencyScore,
          breadthScore,
          activeEffortScore,
          activeDays30,
          effortActions90Count,
          thrivingOrStableCount
        };

        // Calculate legacy stats
        const categoryMap: Record<string, number> = {};
        const importanceMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        peopleDocs.forEach((p: any) => {
          if (p.category) categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
          if (p.importance) importanceMap[p.importance] = (importanceMap[p.importance] || 0) + 1;
        });

        const categoryStats = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));
        const importanceStats = Object.entries(importanceMap).map(([importance, count]) => ({ importance, count }));

        // Birthdays by month
        const monthMap: Record<string, number> = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach(m => monthMap[m] = 0);
        
        peopleDocs.forEach((p: any) => {
          if (p.birthday) {
            const monthIdx = new Date(p.birthday).getMonth();
            if (!isNaN(monthIdx)) {
              monthMap[months[monthIdx]]++;
            }
          }
        });
        const monthStats = Object.entries(monthMap).map(([month, count]) => ({ month, count }));

        setData({ 
          categoryStats, 
          importanceStats, 
          monthStats,
          totalPeople: peopleDocs.length,
          avgHealthScore,
          avgHealthLabel,
          avgBadgeStyle,
          healthDistribution,
          needsAttention,
          userRelationshipScore,
          userScoreBreakdown
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [firebaseUser]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 font-medium">Loading analytics...</div>;

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24 text-zinc-900 dark:text-zinc-100">
      <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Relationship Analytics</h1>
        <AuraHeaderBadge />
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* User Relationship Score Card */}
        <section className="card-premium p-6 space-y-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={22} className="text-emerald-500" />
              <div>
                <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">User Relationship Score</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Personal relationship consistency & effort rating</p>
              </div>
            </div>
            <span className="label-micro">Global Index</span>
          </div>

          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-black tracking-tight text-zinc-900 dark:text-white">
                {data?.userRelationshipScore || 0}
              </span>
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">/ 100</span>
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors py-1 cursor-pointer"
            >
              <span>Score Breakdown</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-zinc-400">
                  {showBreakdown ? 'Hide details' : 'Show details'}
                </span>
                {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            <AnimatePresence>
              {showBreakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pt-3 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* 1. Weighted Health */}
                    <div className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950/80 border border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-zinc-700 dark:text-zinc-300">
                        <span>Weighted Health (35%)</span>
                        <span className="text-emerald-500 font-mono">{data?.userScoreBreakdown?.weightedHealthScore || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${data?.userScoreBreakdown?.weightedHealthScore || 0}%` }} 
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">VIP & priority importance weighted health</p>
                    </div>

                    {/* 2. 30-Day Consistency */}
                    <div className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950/80 border border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-zinc-700 dark:text-zinc-300">
                        <span>30-Day Consistency (25%)</span>
                        <span className="text-blue-500 font-mono">{data?.userScoreBreakdown?.consistencyScore || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: `${data?.userScoreBreakdown?.consistencyScore || 0}%` }} 
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {data?.userScoreBreakdown?.activeDays30 || 0} active days in last 30 days
                      </p>
                    </div>

                    {/* 3. Network Breadth */}
                    <div className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950/80 border border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-zinc-700 dark:text-zinc-300">
                        <span>Network Breadth (20%)</span>
                        <span className="text-amber-500 font-mono">{data?.userScoreBreakdown?.breadthScore || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full" 
                          style={{ width: `${data?.userScoreBreakdown?.breadthScore || 0}%` }} 
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {data?.userScoreBreakdown?.thrivingOrStableCount || 0}/{data?.totalPeople || 0} thriving or stable connections
                      </p>
                    </div>

                    {/* 4. Active Effort */}
                    <div className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950/80 border border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-zinc-700 dark:text-zinc-300">
                        <span>Active Effort (20%)</span>
                        <span className="text-purple-500 font-mono">{data?.userScoreBreakdown?.activeEffortScore || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ width: `${data?.userScoreBreakdown?.activeEffortScore || 0}%` }} 
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {data?.userScoreBreakdown?.effortActions90Count || 0} relationship actions in last 90 days
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Overall Relationship Health Overview */}
        <section className="card-premium p-6 space-y-6 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <HeartPulse size={22} className="text-emerald-500" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base">Relationship Health Overview</h3>
                  <HelpTip 
                    title="Health Score Formula"
                    content="Your Relationship Health Score is calculated based on how recently you've connected, interaction frequency, depth of shared notes & history, and whether your connection trend is improving or declining."
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Aggregated across all {data?.totalPeople || 0} contacts</p>
              </div>
            </div>
            <span className="label-micro">Health Engine</span>
          </div>

          {/* Average Score Card + Distribution Donut/Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Average Score Box */}
            <div className="p-5 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 flex flex-col items-center justify-center text-center space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Average Health Score</span>
                <HelpTip 
                  title="Average Health Score"
                  content="The average score across all your contacts. Higher scores mean recent touchpoints, frequent check-ins, and strong relationship momentum."
                />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black tracking-tight">{data?.avgHealthScore || 0}</span>
                <span className="text-xs font-bold text-zinc-500">/ 100</span>
              </div>
              <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border mt-1", data?.avgBadgeStyle?.bg, data?.avgBadgeStyle?.text, data?.avgBadgeStyle?.border)}>
                <span className={cn("w-2 h-2 rounded-full", data?.avgBadgeStyle?.dot)} />
                <span>{data?.avgHealthLabel || 'Dormant'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-[200px] pt-1">
                {data?.healthDistribution?.find((d: any) => d.status === 'Thriving')?.count || 0} thriving out of {data?.totalPeople || 0} contacts
              </p>
            </div>

            {/* Health Status Distribution Donut Chart */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={data?.healthDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="status"
                    >
                      {(data?.healthDistribution || []).map((entry: any, index: number) => (
                        <Cell key={`health-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', backgroundColor: '#18181b', color: '#f4f4f5', fontSize: '12px' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 w-full text-[11px]">
                {(data?.healthDistribution || []).map((dist: any) => (
                  <div key={dist.status} className="flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dist.color }} />
                      <span className="text-zinc-600 dark:text-zinc-300">{dist.status}</span>
                    </div>
                    <span className="text-zinc-400 font-mono font-bold">{dist.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Needs Attention List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={15} className="text-amber-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Needs Attention</h4>
              </div>
              <span className="text-[10px] font-bold text-zinc-400">Lowest Health Scores</span>
            </div>

            {(!data?.needsAttention || data.needsAttention.length === 0) ? (
              <p className="text-xs text-zinc-400 italic">No contacts logged yet.</p>
            ) : (
              <div className="space-y-2">
                {data.needsAttention.map((item: any) => (
                  <div
                    key={item.person.id}
                    onClick={() => navigate(`/person/${item.person.id}`)}
                    className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-950/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-800/80 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden text-zinc-700 dark:text-zinc-300">
                        {item.person.photo_url ? (
                          <img src={item.person.photo_url} alt={item.person.name} className="w-full h-full object-cover" />
                        ) : (
                          (item.person.name || 'P')[0].toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-500 transition-colors">
                          {item.person.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate leading-snug">
                          {item.healthResult.reason}
                        </p>
                      </div>
                    </div>

                    <HealthScoreBadge 
                      input={{ 
                        person: item.person, 
                        memories: item.person.memories, 
                        reflections: item.person.reflections, 
                        photos: item.person.photos, 
                        gifts: item.person.gifts 
                      }} 
                      size="sm" 
                      showDetailsOnHover={false} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Monthly Distribution */}
        <section className="card-premium p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-zinc-400" />
              <h3 className="font-bold">Monthly Distribution</h3>
            </div>
            <span className="label-micro">Overview</span>
          </div>
          <div className="h-64 w-full">
            {data?.monthStats && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: '#18181b', color: '#f4f4f5' }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Category Distribution */}
        <section className="card-premium p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart size={20} className="text-zinc-400" />
              <h3 className="font-bold">Relationship Mix</h3>
            </div>
            <span className="label-micro">Distribution</span>
          </div>
          <div className="h-64 w-full">
            {data?.categoryStats && (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={data.categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="category"
                  >
                    {data.categoryStats.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#18181b', color: '#f4f4f5' }} />
                </RePieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data?.categoryStats?.map((stat: any, i: number) => (
              <div key={stat.category} className="flex items-center gap-2 text-xs font-medium">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="capitalize">{stat.category}</span>
                <span className="text-zinc-400 ml-auto">{stat.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Effort Score Chart */}
        <section className="card-premium p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={20} className="text-zinc-400" />
              <h3 className="font-bold">Effort Scores</h3>
            </div>
            <span className="label-micro">Trends</span>
          </div>
          <div className="h-64 w-full">
            {data?.importanceStats && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.importanceStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                  <XAxis dataKey="importance" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: '#18181b', color: '#f4f4f5' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-xs text-zinc-500 text-center">Distribution of birthdays by importance level</p>
        </section>
      </div>

      <Navigation />
    </div>
  );
}
