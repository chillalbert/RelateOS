import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function AddPerson() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = React.useState({
    name: '',
    nickname: '',
    birthday: '',
    category: 'friend',
    importance: 3,
    notes: '',
    photo_url: ''
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        navigate('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create profile. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-12">
      <header className="p-6 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">New Person</h1>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-8 max-w-lg mx-auto">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold text-center border border-red-100 dark:border-red-900/50"
          >
            {error}
          </motion.div>
        )}
        {/* Photo Upload Placeholder */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-3xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-300 dark:border-zinc-700">
            <Camera size={32} />
          </div>
          <p className="text-xs font-bold uppercase text-zinc-400">Add Profile Photo</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Full Name</label>
            <input
              type="text"
              required
              className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Sarah Jenkins"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-400">Nickname</label>
              <input
                type="text"
                className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-400">Birthday</label>
              <input
                type="date"
                required
                className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Relationship Category</label>
            <select
              className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 appearance-none"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="friend">Friend</option>
              <option value="family">Family</option>
              <option value="partner">Partner</option>
              <option value="coworker">Coworker</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase text-zinc-400">Importance Level</label>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, importance: level })}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    formData.importance === level 
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-lg' 
                    : 'bg-white dark:bg-zinc-900 text-zinc-400 border border-zinc-100 dark:border-zinc-800'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-zinc-400">Initial Notes</label>
            <textarea
              className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
              placeholder="Interests, gift ideas, or how you met..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles size={20} />
              Create Profile
            </>
          )}
        </button>
      </form>
    </div>
  );
}
