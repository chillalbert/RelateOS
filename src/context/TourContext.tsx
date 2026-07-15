import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from './AuthContext';

export interface TourStep {
  title: string;
  route: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Dashboard 📊",
    route: "/",
    description: "Your relationship command center. Track connection streaks, check-in with friends, and view upcoming milestones."
  },
  {
    title: "Birthday Calendar 🎂",
    route: "/calendar",
    description: "Never miss a celebration. View birthdays in an organized grid and instantly generate personalized AI birthday wishes."
  },
  {
    title: "Circles & Groups 👥",
    route: "/groups",
    description: "Organize your network into custom social circles. Track relationship health and circle strengths dynamically."
  },
  {
    title: "Secret Planning Rooms 🎁",
    route: "/rooms",
    description: "Collaborate with others to brainstorm gift ideas or organize surprise events in shared, encrypted vaults."
  },
  {
    title: "Add Contacts ➕",
    route: "/add",
    description: "Expand your circles. Import contacts directly from Google Calendar & Contacts, or add new friends manually."
  },
  {
    title: "Spark Activities ⚡",
    route: "/spark",
    description: "Keep connections strong with collaborative games, daily icebreakers, and relationship challenge rooms."
  },
  {
    title: "Memory Vaults 🔒",
    route: "/vaults",
    description: "Preserve cherished milestones. Store secure photos, logs, and shared memories safely within digital vaults."
  },
  {
    title: "Relationship Analytics 📈",
    route: "/analytics",
    description: "Visualize connection depth, response frequency, and interaction trends with interactive charts and graphs."
  },
  {
    title: "AI Relationship Coach 🧠",
    route: "/coach",
    description: "Get smart advice. Receive tailored gift suggestions and communication tips from your personal AI relationship mentor."
  },
  {
    title: "Notifications 🔔",
    route: "/notifications",
    description: "Review circle activities, pending invitations, and friend request notifications in real-time."
  },
  {
    title: "Settings ⚙️",
    route: "/settings",
    description: "Manage your user profile, active integrations, notification intervals, and choose your favorite AI accent theme."
  }
];

interface TourContextType {
  tourStep: number | null;
  setTourStep: (step: number | null) => void;
  nextTourStep: () => void;
  skipTour: () => void;
  isCurrentRouteHighlighted: boolean;
}

const TourContext = React.createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tourStep, setTourStepState] = React.useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseUser, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    if (!firebaseUser) {
      setTourStepState(null);
    }
  }, [firebaseUser, isLoading]);

  const setTourStep = (step: number | null) => {
    if (!firebaseUser) {
      setTourStepState(null);
      return;
    }
    setTourStepState(step);
    if (step !== null) {
      const targetRoute = TOUR_STEPS[step - 1]?.route;
      if (targetRoute && location.pathname !== targetRoute) {
        navigate(targetRoute);
      }
    }
  };

  const nextTourStep = () => {
    if (tourStep === null) return;
    if (tourStep < TOUR_STEPS.length) {
      const nextStep = tourStep + 1;
      setTourStepState(nextStep);
      const targetRoute = TOUR_STEPS[nextStep - 1]?.route;
      if (targetRoute) {
        navigate(targetRoute);
      }
    } else {
      setTourStepState(null);
      navigate('/');
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }, 300);
    }
  };

  const skipTour = () => {
    setTourStepState(null);
    navigate('/');
  };

  // Check if current route matches the active step's route
  const activeStepRoute = tourStep !== null ? TOUR_STEPS[tourStep - 1]?.route : null;
  const isCurrentRouteHighlighted = tourStep !== null && activeStepRoute === location.pathname;

  return (
    <TourContext.Provider value={{ tourStep, setTourStep, nextTourStep, skipTour, isCurrentRouteHighlighted }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = React.useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
