import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Sliders,
  Key,
  Lock
} from 'lucide-react';
import Navigation from '../components/Navigation';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, linkWithCredential, unlink } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { GamificationConfig, UnlockItem, DEFAULT_SHOP_COSTS, ShopCosts } from '../types';

const DEFAULT_CONFIG: GamificationConfig = {
  dailyActionType: 'check_in',
  cycleLengthDays: 7,
  auraPerDay: 10,
  shopCosts: DEFAULT_SHOP_COSTS,
  unlockSequence: [
    {
      id: 'leaderboard',
      name: 'Leaderboard',
      description: 'Compare your Relationship Score with friends'
    },
    {
      id: 'aura_shop',
      name: 'Aura Shop',
      description: 'Redeem Aura tokens for custom badges and themes'
    },
    {
      id: 'deep_analytics',
      name: 'Advanced Insights',
      description: 'Unlock detailed relationship trend reports'
    }
  ],
  currentUnlockIndex: 0
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [config, setConfig] = React.useState<GamificationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [linkingState, setLinkingState] = React.useState<{ loading: boolean; success?: string; error?: string }>({ loading: false });

  const handleSetEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkingState({ loading: true, error: undefined, success: undefined });

    if (!password || password.length < 6) {
      setLinkingState({ loading: false, error: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      setLinkingState({ loading: false, error: 'Passwords do not match.' });
      return;
    }

    const currentUser = auth.currentUser || firebaseUser;
    if (!currentUser || !currentUser.email) {
      setLinkingState({ loading: false, error: 'No authenticated user email found.' });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await linkWithCredential(currentUser, credential);

      let unlinkedGoogle = false;
      const isGoogleLinked = currentUser.providerData.some(p => p.providerId === 'google.com');
      if (isGoogleLinked) {
        try {
          await unlink(currentUser, 'google.com');
          unlinkedGoogle = true;
        } catch (unlinkErr: any) {
          console.warn('Google unlink notice:', unlinkErr);
        }
      }

      setLinkingState({
        loading: false,
        success: `Email & Password authentication successfully configured for ${currentUser.email}! ${unlinkedGoogle ? 'Google sign-in method unlinked.' : ''}`
      });
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Failed to link email/password:', err);
      setLinkingState({
        loading: false,
        error: err?.message || 'Failed to set email/password credentials.'
      });
    }
  };

  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'config', 'gamification');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as GamificationConfig;
          setConfig({
            dailyActionType: data.dailyActionType || 'check_in',
            cycleLengthDays: typeof data.cycleLengthDays === 'number' ? data.cycleLengthDays : 7,
            auraPerDay: typeof data.auraPerDay === 'number' ? data.auraPerDay : 10,
            shopCosts: {
              streakFreeze: typeof data.shopCosts?.streakFreeze === 'number' ? data.shopCosts.streakFreeze : DEFAULT_SHOP_COSTS.streakFreeze,
              leaderboardFlair: typeof data.shopCosts?.leaderboardFlair === 'number' ? data.shopCosts.leaderboardFlair : DEFAULT_SHOP_COSTS.leaderboardFlair,
              customAccentColor: typeof data.shopCosts?.customAccentColor === 'number' ? data.shopCosts.customAccentColor : DEFAULT_SHOP_COSTS.customAccentColor,
              bonusEnrichment: typeof data.shopCosts?.bonusEnrichment === 'number' ? data.shopCosts.bonusEnrichment : DEFAULT_SHOP_COSTS.bonusEnrichment,
            },
            unlockSequence: Array.isArray(data.unlockSequence) ? data.unlockSequence : DEFAULT_CONFIG.unlockSequence,
            currentUnlockIndex: typeof data.currentUnlockIndex === 'number' ? data.currentUnlockIndex : 0
          });
        }
      } catch (err) {
        console.error('Failed to load gamification config:', err);
        setStatusMessage({ type: 'error', text: 'Failed to load existing configuration' });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);

      // Validate currentUnlockIndex is within bounds
      const safeIndex = Math.max(0, Math.min(config.currentUnlockIndex, Math.max(0, config.unlockSequence.length - 1)));
      
      const payload: GamificationConfig = {
        ...config,
        currentUnlockIndex: safeIndex
      };

      const docRef = doc(db, 'config', 'gamification');
      await setDoc(docRef, payload, { merge: true });

      setConfig(payload);
      setStatusMessage({ type: 'success', text: 'Gamification config saved to Firestore' });
    } catch (err) {
      console.error('Error saving gamification config:', err);
      setStatusMessage({ type: 'error', text: 'Failed to save configuration to Firestore' });
    } finally {
      setSaving(false);
    }
  };

  const addUnlockItem = () => {
    const idNum = Date.now();
    const newItem: UnlockItem = {
      id: `unlock_${idNum}`,
      name: `New Unlock ${config.unlockSequence.length + 1}`,
      description: 'Feature description'
    };
    setConfig(prev => ({
      ...prev,
      unlockSequence: [...prev.unlockSequence, newItem]
    }));
  };

  const updateUnlockItem = (index: number, field: keyof UnlockItem, value: string) => {
    setConfig(prev => {
      const nextSeq = [...prev.unlockSequence];
      nextSeq[index] = { ...nextSeq[index], [field]: value };
      return { ...prev, unlockSequence: nextSeq };
    });
  };

  const removeUnlockItem = (index: number) => {
    setConfig(prev => {
      const nextSeq = prev.unlockSequence.filter((_, i) => i !== index);
      let nextIndex = prev.currentUnlockIndex;
      if (nextIndex >= nextSeq.length) {
        nextIndex = Math.max(0, nextSeq.length - 1);
      }
      return {
        ...prev,
        unlockSequence: nextSeq,
        currentUnlockIndex: nextIndex
      };
    });
  };

  const moveUnlockItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.unlockSequence.length) return;

    setConfig(prev => {
      const nextSeq = [...prev.unlockSequence];
      const temp = nextSeq[index];
      nextSeq[index] = nextSeq[targetIndex];
      nextSeq[targetIndex] = temp;

      // Adjust currentUnlockIndex if affected
      let nextIndex = prev.currentUnlockIndex;
      if (prev.currentUnlockIndex === index) {
        nextIndex = targetIndex;
      } else if (prev.currentUnlockIndex === targetIndex) {
        nextIndex = index;
      }

      return {
        ...prev,
        unlockSequence: nextSeq,
        currentUnlockIndex: nextIndex
      };
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-28 pt-[calc(1.5rem+var(--sat))] px-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-500" />
                <h1 className="text-xl font-bold tracking-tight">Admin Configuration</h1>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Gamification & Streak System Rules</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase font-bold">
            Admin Only
          </span>
        </header>

        {statusMessage && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
            Loading gamification config...
          </div>
        ) : (
          <>
            <form onSubmit={handleSave} className="space-y-6">
            {/* Core Settings Card */}
            <section className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <Sliders size={18} className="text-emerald-500" />
                <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Daily Rules & Rewards</h2>
              </div>

              {/* Daily Action Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Daily Action Type Required
                </label>
                <select
                  value={config.dailyActionType}
                  onChange={e => setConfig({ ...config, dailyActionType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="check_in">Daily Check-In</option>
                  <option value="note_edit">Note or AI Note Update</option>
                  <option value="memory_added">Memory or Reflection Added</option>
                </select>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Action users must complete daily to sustain their streak.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cycle Length Days */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Cycle Length (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={config.cycleLengthDays}
                    onChange={e => setConfig({ ...config, cycleLengthDays: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Days needed to trigger the next feature unlock.
                  </p>
                </div>

                {/* Aura Per Day */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Aura Earned Per Day
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={config.auraPerDay}
                    onChange={e => setConfig({ ...config, auraPerDay: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Aura tokens granted per active day.
                  </p>
                </div>
              </div>
            </section>

            {/* Aura Shop Costs Config Card */}
            <section className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <Sparkles size={18} className="text-amber-500" />
                <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Aura Shop Item Costs</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Streak Freeze Cost */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Streak Freeze Cost (Aura)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={config.shopCosts?.streakFreeze ?? DEFAULT_SHOP_COSTS.streakFreeze}
                    onChange={e => setConfig({
                      ...config,
                      shopCosts: {
                        ...(config.shopCosts || DEFAULT_SHOP_COSTS),
                        streakFreeze: parseInt(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Default: 20 Aura</p>
                </div>

                {/* Leaderboard Flair Cost */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Leaderboard Flair Cost (Aura)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={config.shopCosts?.leaderboardFlair ?? DEFAULT_SHOP_COSTS.leaderboardFlair}
                    onChange={e => setConfig({
                      ...config,
                      shopCosts: {
                        ...(config.shopCosts || DEFAULT_SHOP_COSTS),
                        leaderboardFlair: parseInt(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Default: 50 Aura</p>
                </div>

                {/* Custom Accent Color Cost */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Custom Accent Color Cost (Aura)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={config.shopCosts?.customAccentColor ?? DEFAULT_SHOP_COSTS.customAccentColor}
                    onChange={e => setConfig({
                      ...config,
                      shopCosts: {
                        ...(config.shopCosts || DEFAULT_SHOP_COSTS),
                        customAccentColor: parseInt(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Default: 30 Aura</p>
                </div>

                {/* Bonus AI Enrichment Cost */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Bonus AI Enrichment Cost (Aura)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={config.shopCosts?.bonusEnrichment ?? DEFAULT_SHOP_COSTS.bonusEnrichment}
                    onChange={e => setConfig({
                      ...config,
                      shopCosts: {
                        ...(config.shopCosts || DEFAULT_SHOP_COSTS),
                        bonusEnrichment: parseInt(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Default: 40 Aura</p>
                </div>
              </div>
            </section>

            {/* Unlock Sequence Manager Card */}
            <section className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Unlock Sequence & Gating</h2>
                </div>
                <button
                  type="button"
                  onClick={addUnlockItem}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {config.unlockSequence.map((item, index) => {
                  return (
                    <div 
                      key={item.id || index}
                      className="p-4 rounded-2xl border transition-all space-y-3 bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {item.name || 'Unnamed Unlock'}
                          </span>
                        </div>

                        {/* Actions: Move Up / Down / Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveUnlockItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 disabled:opacity-30 transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveUnlockItem(index, 'down')}
                            disabled={index === config.unlockSequence.length - 1}
                            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 disabled:opacity-30 transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeUnlockItem(index)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer ml-1"
                            title="Remove Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ID Slug</label>
                          <input
                            type="text"
                            value={item.id}
                            onChange={e => updateUnlockItem(index, 'id', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-zinc-100"
                            placeholder="e.g. leaderboard"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Feature Name</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => updateUnlockItem(index, 'name', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
                            placeholder="e.g. Leaderboard"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateUnlockItem(index, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
                          placeholder="e.g. Compare your Relationship Score with friends"
                        />
                      </div>
                    </div>
                  );
                })}

                {config.unlockSequence.length === 0 && (
                  <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
                    No unlock sequence items added yet. Click &quot;Add Item&quot; above to create one.
                  </div>
                )}
              </div>
            </section>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={18} />
                <span>{saving ? 'Saving to Firestore...' : 'Save Gamification Settings'}</span>
              </button>
            </div>
          </form>

          {/* Set Email/Password Section */}
          <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm mt-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                <Key size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Set Email & Password Login
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configure password login for <span className="font-semibold text-zinc-800 dark:text-zinc-200">{firebaseUser?.email || auth.currentUser?.email || 'admin'}</span> and unlink Google authentication.
                </p>
              </div>
            </div>

            {linkingState.success && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0" />
                <span>{linkingState.success}</span>
              </div>
            )}

            {linkingState.error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{linkingState.error}</span>
              </div>
            )}

            <form onSubmit={handleSetEmailPassword} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">New Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <Lock size={14} className="absolute left-3 top-3 text-zinc-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Confirm Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <Lock size={14} className="absolute left-3 top-3 text-zinc-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={linkingState.loading || !password || !confirmPassword}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Key size={16} />
                <span>{linkingState.loading ? 'Updating Credentials...' : 'Set Email/Password Login & Unlink Google'}</span>
              </button>
            </form>
          </section>
          </>
        )}
      </div>

      <Navigation />
    </div>
  );
}
