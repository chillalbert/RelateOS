import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Sparkles, 
  ShieldAlert, 
  Trophy, 
  Palette, 
  Brain, 
  CheckCircle, 
  AlertCircle,
  Coins,
  CalendarCheck,
  Flame,
  Users
} from 'lucide-react';
import Navigation from '../components/Navigation';
import AuraHeaderBadge from '../components/AuraHeaderBadge';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { DEFAULT_SHOP_COSTS, ShopCosts } from '../types';

export default function AuraShop() {
  const navigate = useNavigate();
  const { user, firebaseUser, refreshUser } = useAuth();

  const [shopCosts, setShopCosts] = React.useState<ShopCosts>(DEFAULT_SHOP_COSTS);
  const [auraPerDay, setAuraPerDay] = React.useState<number>(10);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [purchasingItem, setPurchasingItem] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    const fetchShopConfig = async () => {
      try {
        setLoadingConfig(true);
        const configRef = doc(db, 'config', 'gamification');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.auraPerDay === 'number') {
            setAuraPerDay(data.auraPerDay);
          }
          if (data.shopCosts) {
            setShopCosts({
              streakFreeze: typeof data.shopCosts.streakFreeze === 'number' ? data.shopCosts.streakFreeze : DEFAULT_SHOP_COSTS.streakFreeze,
              leaderboardFlair: typeof data.shopCosts.leaderboardFlair === 'number' ? data.shopCosts.leaderboardFlair : DEFAULT_SHOP_COSTS.leaderboardFlair,
              customAccentColor: typeof data.shopCosts.customAccentColor === 'number' ? data.shopCosts.customAccentColor : DEFAULT_SHOP_COSTS.customAccentColor,
              bonusEnrichment: typeof data.shopCosts.bonusEnrichment === 'number' ? data.shopCosts.bonusEnrichment : DEFAULT_SHOP_COSTS.bonusEnrichment,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching shop costs:', err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchShopConfig();
  }, []);

  const showToastNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handlePurchase = async (itemId: 'streakFreeze' | 'leaderboardFlair' | 'customAccentColor' | 'bonusEnrichment', itemName: string) => {
    if (!firebaseUser?.uid) return;

    const cost = shopCosts[itemId];
    const currentBalance = user?.auraBalance || 0;

    if (currentBalance < cost) {
      showToastNotification('error', `Insufficient Aura balance. You need ${cost} Aura to purchase ${itemName}.`);
      return;
    }

    try {
      setPurchasingItem(itemId);
      const userRef = doc(db, 'users', firebaseUser.uid);

      const updates: Record<string, any> = {
        auraBalance: increment(-cost)
      };

      if (itemId === 'streakFreeze') {
        updates.streakFreezeAvailable = increment(1);
      } else if (itemId === 'leaderboardFlair') {
        updates.leaderboardFlairUnlocked = true;
      } else if (itemId === 'customAccentColor') {
        updates.premiumAccentUnlocked = true;
      } else if (itemId === 'bonusEnrichment') {
        updates.bonusEnrichmentCredits = increment(1);
      }

      await updateDoc(userRef, updates);
      await refreshUser();

      showToastNotification('success', `Successfully purchased ${itemName}!`);
    } catch (err) {
      console.error(`Error purchasing ${itemId}:`, err);
      showToastNotification('error', `Transaction failed. Please try again.`);
    } finally {
      setPurchasingItem(null);
    }
  };

  const currentAura = user?.auraBalance || 0;

  const items = [
    {
      id: 'streakFreeze' as const,
      name: 'Streak Freeze',
      cost: shopCosts.streakFreeze,
      icon: ShieldAlert,
      iconBg: 'bg-sky-500/10 text-sky-500',
      description: 'Automatically preserves your active check-in streak if you miss a single day.',
      inventoryText: `Held: ${user?.streakFreezeAvailable || 0}`,
      alreadyUnlocked: false,
      buttonText: 'Purchase Freeze',
      canPurchaseMultiple: true
    },
    {
      id: 'leaderboardFlair' as const,
      name: 'Leaderboard Flair',
      cost: shopCosts.leaderboardFlair,
      icon: Trophy,
      iconBg: 'bg-amber-500/10 text-amber-500',
      description: 'Unlocks a special cosmetic flair badge displayed next to your profile on rankings.',
      inventoryText: user?.leaderboardFlairUnlocked ? 'Unlocked' : 'Not Owned',
      alreadyUnlocked: !!user?.leaderboardFlairUnlocked,
      buttonText: user?.leaderboardFlairUnlocked ? 'Owned' : 'Purchase Flair',
      canPurchaseMultiple: false
    },
    {
      id: 'customAccentColor' as const,
      name: 'Custom Accent Color',
      cost: shopCosts.customAccentColor,
      icon: Palette,
      iconBg: 'bg-violet-500/10 text-violet-500',
      description: 'Unlocks 3 premium AI accent color themes (Gold, Cyan, Fuchsia) in your Settings.',
      inventoryText: user?.premiumAccentUnlocked ? 'Unlocked' : 'Not Owned',
      alreadyUnlocked: !!user?.premiumAccentUnlocked,
      buttonText: user?.premiumAccentUnlocked ? 'Owned' : 'Purchase Colors',
      canPurchaseMultiple: false
    },
    {
      id: 'bonusEnrichment' as const,
      name: 'Bonus AI Enrichment',
      cost: shopCosts.bonusEnrichment,
      icon: Brain,
      iconBg: 'bg-emerald-500/10 text-emerald-500',
      description: 'Grants 1 instant AI Notes & Vision profile enrichment run outside normal cadence.',
      inventoryText: `Credits: ${user?.bonusEnrichmentCredits || 0}`,
      alreadyUnlocked: false,
      buttonText: 'Purchase Credit',
      canPurchaseMultiple: true
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-32">
      {/* Toast Banner */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
          <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'success' 
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : 'bg-rose-600 text-white border-rose-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
            <p className="text-xs font-bold">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Go Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-amber-500" />
            <h1 className="text-lg font-black tracking-tight">Aura Shop</h1>
          </div>
          <AuraHeaderBadge />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Balance Banner Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Coins size={140} />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Current Aura Balance</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-tight">{currentAura}</span>
              <span className="text-sm font-bold text-zinc-400">Aura Tokens</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Earn +{auraPerDay} Aura tokens each day by recording check-ins and keeping your relationship streak active.
            </p>
          </div>
        </div>

        {/* How to Earn Aura Rules Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">How to Earn Aura</h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Simple ways to stack Aura tokens for items & power-ups</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <CalendarCheck size={15} />
                <span>Daily Tasks</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Earn <strong className="text-amber-500 font-bold">+{auraPerDay} Aura</strong> each day by completing your daily cycle task.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <Flame size={15} />
                <span>Active Streaks</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Log relationship check-ins daily to keep your momentum streak active.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <Users size={15} />
                <span>Friend Circles</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Join or create Friend Circles to earn group Aura bonuses and rank higher.
              </p>
            </div>
          </div>
        </div>

        {/* Shop Items Grid */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-1">Available Power-Ups & Items</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => {
              const IconComp = item.icon;
              const isAffordable = currentAura >= item.cost;
              const isDisabled = item.alreadyUnlocked || !isAffordable || purchasingItem === item.id;

              return (
                <div 
                  key={item.id}
                  className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-4 relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-2xl ${item.iconBg}`}>
                        <IconComp size={20} />
                      </div>
                      <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-black">
                        <Sparkles size={12} />
                        <span>{item.cost} Aura</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {item.inventoryText}
                    </span>

                    <button
                      onClick={() => handlePurchase(item.id, item.name)}
                      disabled={isDisabled}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        item.alreadyUnlocked
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                          : isAffordable
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:scale-[1.02] active:scale-[0.98]'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      {purchasingItem === item.id ? (
                        <span>Processing...</span>
                      ) : item.alreadyUnlocked ? (
                        <span>Owned</span>
                      ) : (
                        <span>{item.buttonText}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
