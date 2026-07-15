import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TourProvider, useTour } from './context/TourContext';
import TourOverlay from './components/TourOverlay';
import { cn } from './lib/utils';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AddPerson from './pages/AddPerson';
import PersonProfile from './pages/PersonProfile';
import Analytics from './pages/Analytics';
import GroupPlanning from './pages/GroupPlanning';
import Groups from './pages/Groups';
import Vaults from './pages/Vaults';
import BirthdayCalendar from './pages/BirthdayCalendar';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import AICoach from './pages/AICoach';
import SurpriseReveal from './pages/SurpriseReveal';
import PublicProfileCollector from './pages/PublicProfileCollector';
import GroupsDirectory from './pages/GroupsDirectory';
import GroupView from './pages/GroupView';
import SparkHome from './pages/SparkHome';
import SparkGameRoom from './pages/SparkGameRoom';

import LoadingScreen from './components/LoadingScreen';
import NotificationManager from './components/NotificationManager';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingFlow from './components/OnboardingFlow';
import { initializeGeminiKey } from './services/geminiService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

const RealtimeNotificationTracker = () => {
  const { firebaseUser } = useAuth();
  const [toast, setToast] = React.useState<{ id: string; senderName: string } | null>(null);
  const prevCountRef = React.useRef<number | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!firebaseUser) {
      (window as any).__pendingCount = 0;
      window.dispatchEvent(new CustomEvent('pending_requests_count', { detail: 0 }));
      return;
    }

    const q = query(
      collection(db, 'friend_requests'),
      where('receiver_uid', '==', firebaseUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      const prevCount = prevCountRef.current;
      prevCountRef.current = count;

      // Update global count
      (window as any).__pendingCount = count;
      window.dispatchEvent(new CustomEvent('pending_requests_count', { detail: count }));

      // Trigger standard in-app slide-down banner if pending request list grew
      if (prevCount !== null && count > prevCount) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        if (docs.length > 0) {
          // Identify the most recent or any pending request
          const newest = docs[docs.length - 1];
          if (newest && newest.sender_name) {
            setToast({ id: newest.id, senderName: newest.sender_name });
          }
        }
      }
    }, (error) => {
      console.error('Error listening to friend requests:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [firebaseUser]);

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -80, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -80, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="fixed top-6 left-1/2 z-[9999] w-full max-w-sm px-4 cursor-pointer"
          onClick={() => {
            navigate('/notifications');
            setToast(null);
          }}
        >
          <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-emerald-400 hover:bg-emerald-600 transition-all">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🤝</span>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">New Friend Request!</p>
                <p className="text-sm font-extrabold">{toast.senderName} wants to connect.</p>
                <p className="text-[10px] text-white/75 underline font-bold mt-1">Tap to review requests</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
              className="text-white/80 hover:text-white font-bold text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, user, isLoading } = useAuth();
  const { isCurrentRouteHighlighted } = useTour();

  if (isLoading) return <LoadingScreen />;
  if (!firebaseUser) return <Navigate to="/login" />;
  
  const isCompleted = user?.onboarding_completed === true || user?.has_completed_onboarding === true;
  if (user && !isCompleted) {
    return <OnboardingFlow />;
  }
  
  return (
    <div 
      className={cn(
        "min-h-screen transition-all duration-500",
        isCurrentRouteHighlighted && "ring-8 ring-emerald-500 scale-[0.98] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.3)] bg-emerald-500/5 select-none pointer-events-none"
      )}
    >
      {children}
    </div>
  );
};

const ThemeHandler = ({ children }: { children: React.ReactNode }) => {
  const { user, firebaseUser, isLoading } = useAuth();

  React.useEffect(() => {
    if (firebaseUser && !isLoading) {
      initializeGeminiKey();
    }
  }, [firebaseUser, isLoading]);

  React.useEffect(() => {
    if (user?.appearance === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.appearance]);

  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeHandler>
          <NotificationManager />
          <Router>
            <TourProvider>
              <RealtimeNotificationTracker />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/surprise/:roomId" element={<SurpriseReveal />} />
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/add" element={<PrivateRoute><AddPerson /></PrivateRoute>} />
                <Route path="/vaults" element={<PrivateRoute><Vaults /></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><BirthdayCalendar /></PrivateRoute>} />
                <Route path="/person/:id" element={<PrivateRoute><PersonProfile /></PrivateRoute>} />
                <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                <Route path="/coach" element={<PrivateRoute><AICoach /></PrivateRoute>} />
                <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
                <Route path="/groups" element={<PrivateRoute><GroupsDirectory /></PrivateRoute>} />
                <Route path="/groups/:groupId" element={<PrivateRoute><GroupView /></PrivateRoute>} />
                <Route path="/spark" element={<PrivateRoute><SparkHome /></PrivateRoute>} />
                <Route path="/spark/:groupId" element={<PrivateRoute><SparkGameRoom /></PrivateRoute>} />
                <Route path="/rooms" element={<PrivateRoute><Groups /></PrivateRoute>} />
                <Route path="/rooms/create" element={<PrivateRoute><GroupPlanning /></PrivateRoute>} />
                <Route path="/rooms/:id" element={<PrivateRoute><GroupPlanning /></PrivateRoute>} />
                <Route path="/u/:username" element={<PublicProfileCollector />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              <TourOverlay />
            </TourProvider>
          </Router>
        </ThemeHandler>
      </AuthProvider>
    </ErrorBoundary>
  );
}
