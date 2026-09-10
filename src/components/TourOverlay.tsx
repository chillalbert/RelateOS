import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useTour, TOUR_STEPS } from '../context/TourContext';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { isFeatureLocked } from '../lib/utils';

interface CardPosition {
  top?: number;
  left?: number;
  bottom?: number;
  arrowDirection?: 'up' | 'down';
  arrowStyle?: React.CSSProperties;
}

const ROUTE_TO_FEATURE_ID: Record<string, string> = {
  '/rooms': 'rooms',
  '/vaults': 'vaults',
  '/analytics': 'analytics',
  '/coach': 'coach',
};

const getTargetElement = (step: number) => {
  const stepInfo = TOUR_STEPS[step - 1];
  if (!stepInfo) return null;

  const route = stepInfo.route;

  // 1. Try nav link matching route
  const navEl = document.querySelector(`nav a[href="${route}"]`);
  if (navEl) return navEl;

  // 2. Try any link with href equal to route
  const linkEl = document.querySelector(`a[href="${route}"]`);
  if (linkEl) return linkEl;

  return null;
};

export default function TourOverlay() {
  const { tourStep, nextTourStep, skipTour } = useTour();
  const { firebaseUser, user } = useAuth();
  const { config } = useGamification();
  const [cardPosition, setCardPosition] = React.useState<CardPosition>({});
  const cardRef = React.useRef<HTMLDivElement>(null);

  const currentStepInfo = tourStep !== null ? TOUR_STEPS[tourStep - 1] : null;

  const featureId = currentStepInfo ? ROUTE_TO_FEATURE_ID[currentStepInfo.route] : null;
  const isLocked = featureId ? isFeatureLocked(featureId, user?.unlockedFeatures, config?.unlockSequence) : false;

  const displayTitle = isLocked ? "Locked Tab (???)" : currentStepInfo?.title;
  const displayDescription = isLocked 
    ? "This one's a mystery for now. Any tabs that say ??? will be unlocked through weekly/monthly streaks. Complete your cycle's task to unlock what's behind it." 
    : currentStepInfo?.description;

  const updatePosition = React.useCallback(() => {
    if (tourStep === null) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 16;
    const gap = 16;
    const cardWidth = Math.min(vw - padding * 2, 380);

    // Measure actual rendered height via ref instead of hardcoded constant
    const cardEl = cardRef.current;
    const measuredHeight = cardEl ? (cardEl.getBoundingClientRect().height || cardEl.offsetHeight) : 220;
    const cardHeight = measuredHeight > 0 ? measuredHeight : 220;

    const target = getTargetElement(tourStep);
    if (!target) {
      const defaultBottom = Math.max(padding, Math.min(vh - cardHeight - padding, 120));
      setCardPosition({
        top: undefined,
        left: Math.max(padding, (vw - cardWidth) / 2),
        bottom: defaultBottom,
        arrowDirection: undefined,
        arrowStyle: {}
      });
      return;
    }

    const rect = target.getBoundingClientRect();

    // Rely solely on actual measured position to decide if target is near the bottom
    const isBottomNav = rect.bottom > vh - 120;

    let top: number | undefined = undefined;
    let left: number | undefined = undefined;
    let bottom: number | undefined = undefined;
    let arrowDirection: 'up' | 'down' | undefined = undefined;
    let arrowStyle: React.CSSProperties = {};

    const targetCenterX = rect.left + rect.width / 2;
    left = targetCenterX - (cardWidth / 2);
    // Clamp horizontal position against viewport bounds
    left = Math.max(padding, Math.min(vw - cardWidth - padding, left));

    const arrowLeft = Math.max(24, Math.min(cardWidth - 24, targetCenterX - left));

    if (isBottomNav) {
      // Position directly ABOVE the item
      bottom = (vh - rect.top) + gap;
      // Clamp vertical position so top edge >= padding and bottom edge <= vh - padding
      const maxBottom = Math.max(padding, vh - cardHeight - padding);
      bottom = Math.max(padding, Math.min(maxBottom, bottom));

      arrowDirection = 'down';
      arrowStyle = {
        left: `${arrowLeft}px`,
        bottom: '-6px',
        transform: 'translateX(-50%) rotate(45deg)',
      };
    } else {
      // Position BELOW the item if it fits, else above
      if (rect.bottom + cardHeight + gap < vh - padding) {
        top = rect.bottom + gap;
        // Clamp vertical position so top edge >= padding and bottom edge <= vh - padding
        const maxTop = Math.max(padding, vh - cardHeight - padding);
        top = Math.max(padding, Math.min(maxTop, top));

        arrowDirection = 'up';
        arrowStyle = {
          left: `${arrowLeft}px`,
          top: '-6px',
          transform: 'translateX(-50%) rotate(45deg)',
        };
      } else {
        bottom = (vh - rect.top) + gap;
        // Clamp vertical position so top edge >= padding and bottom edge <= vh - padding
        const maxBottom = Math.max(padding, vh - cardHeight - padding);
        bottom = Math.max(padding, Math.min(maxBottom, bottom));

        arrowDirection = 'down';
        arrowStyle = {
          left: `${arrowLeft}px`,
          bottom: '-6px',
          transform: 'translateX(-50%) rotate(45deg)',
        };
      }
    }

    setCardPosition({
      top,
      left,
      bottom,
      arrowDirection,
      arrowStyle
    });
  }, [tourStep]);

  // When step changes, ensure target is scrolled into view before measuring/positioning
  React.useEffect(() => {
    if (tourStep === null) return;

    const target = getTargetElement(tourStep);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updatePosition();
    const t1 = setTimeout(updatePosition, 100);
    const t2 = setTimeout(updatePosition, 300);

    const handleScroll = () => updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('scrollend', handleScroll);
    const interval = setInterval(updatePosition, 150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('scrollend', handleScroll);
    };
  }, [tourStep, updatePosition]);

  // Recalculate position when the card element resizes (e.g. content updates)
  React.useEffect(() => {
    if (!cardRef.current) return;
    const observer = new ResizeObserver(() => {
      updatePosition();
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [updatePosition, tourStep]);

  if (tourStep === null || !firebaseUser || !currentStepInfo) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 380;
  const cardWidth = Math.min(vw - 32, 380);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] pointer-events-none">
        {/* Darken background slightly */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black pointer-events-auto"
          onClick={skipTour}
        />
        
        {/* Tour Dialog Card Positioning Wrapper */}
        <div 
          ref={cardRef}
          className="absolute pointer-events-auto transition-all duration-300"
          style={{
            top: cardPosition.top !== undefined ? `${cardPosition.top}px` : undefined,
            left: cardPosition.left !== undefined 
              ? `${cardPosition.left}px` 
              : `${Math.max(16, (vw - cardWidth) / 2)}px`,
            bottom: cardPosition.bottom !== undefined ? `${cardPosition.bottom}px` : undefined,
            width: `${cardWidth}px`,
          }}
        >
          {/* Animated Tour Dialog Card Content */}
          <motion.div 
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            className="relative bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-[28px] shadow-2xl space-y-4"
          >
            {/* Visual Pointer/Arrow */}
            {cardPosition.arrowDirection && (
              <div 
                className={`absolute w-3 h-3 bg-white dark:bg-zinc-900 border-zinc-150 dark:border-zinc-800 ${
                  cardPosition.arrowDirection === 'up' ? 'border-l border-t' : 'border-r border-b'
                }`}
                style={cardPosition.arrowStyle}
              />
            )}

            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-accent-500 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={12} className="animate-pulse" /> Workspace Tour • Step {tourStep} of {TOUR_STEPS.length}
              </span>
              <button 
                onClick={skipTour}
                className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                Skip
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-zinc-900 dark:text-white">
                {displayTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                {displayDescription}
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-1 flex-wrap">
                {TOUR_STEPS.map((_, index) => {
                  const s = index + 1;
                  return (
                    <div 
                      key={s} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        s === tourStep ? 'w-5 bg-accent-500 dark:bg-emerald-500' : 'w-1.5 bg-zinc-200 dark:bg-zinc-800'
                      }`}
                    />
                  );
                })}
              </div>
              <button
                onClick={nextTourStep}
                className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-all shadow-md shadow-accent-500/10 dark:shadow-emerald-500/10 cursor-pointer"
              >
                {tourStep === TOUR_STEPS.length ? "Finish" : "Next"} <ChevronRight size={12} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

