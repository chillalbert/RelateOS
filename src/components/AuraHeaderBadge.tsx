import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuraHeaderBadgeProps {
  className?: string;
}

export default function AuraHeaderBadge({ className = '' }: AuraHeaderBadgeProps) {
  const navigate = useNavigate();
  const { firebaseUser, user } = useAuth();
  const [balance, setBalance] = useState<number>(user?.auraBalance ?? 0);

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    const userRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.auraBalance !== undefined) {
            setBalance(data.auraBalance);
          }
        }
      },
      (err) => {
        console.warn('Error listening to aura balance in header badge:', err);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser?.uid]);

  if (!firebaseUser) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/shop')}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-xs shadow-sm hover:bg-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ${className}`}
      title="Aura Balance - Tap to visit Aura Shop"
    >
      <Sparkles size={13} className="text-amber-500 fill-amber-500/20 shrink-0" />
      <span className="tracking-tight">{balance}</span>
      <span className="text-[10px] uppercase tracking-wider font-black text-amber-500/80 hidden sm:inline">Aura</span>
    </button>
  );
}
