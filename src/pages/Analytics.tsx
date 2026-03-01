import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PieChart, TrendingUp, Award } from 'lucide-react';
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
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function Analytics() {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!firebaseUser) return;
      try {
        const peopleRef = collection(db, 'people');
        const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
        const querySnapshot = await getDocs(q);
        const people = querySnapshot.docs.map(doc => doc.data());

        // Calculate stats
        const categoryMap: Record<string, number> = {};
        const importanceMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        people.forEach((p: any) => {
          categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
          importanceMap[p.importance] = (importanceMap[p.importance] || 0) + 1;
        });

        const categoryStats = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));
        const importanceStats = Object.entries(importanceMap).map(([importance, count]) => ({ importance, count }));

        setData({ categoryStats, importanceStats });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [firebaseUser]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Birthday Analytics</h1>
        <div className="w-10" />
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Category Distribution */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-6">
          <div className="flex items-center gap-2">
            <PieChart size={20} className="text-zinc-400" />
            <h3 className="font-bold">Relationship Mix</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={data?.categoryStats || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="category"
                >
                  {data?.categoryStats?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
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
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-zinc-400" />
            <h3 className="font-bold">Effort Scores</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.importanceStats || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="importance" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-zinc-500 text-center">Distribution of birthdays by importance level</p>
        </section>
      </div>
    </div>
  );
}
