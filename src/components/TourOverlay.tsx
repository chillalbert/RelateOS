import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useTour, TOUR_STEPS } from '../context/TourContext';
import { useAuth } from '../context/AuthContext';

interface CardPosition {
  top?: number;
  left?: number;
  bottom?: number;
  arrowDirection?: 'up' | 'down';
  arrowStyle?: React.CSSProperties;
}

const getTargetElement = (step: number) => {
  const stepInfo = TOUR_STEPS[step - 1];
  if (!stepInfo) return null;

  let selector = '';
  switch (step) {
    case 1:
      selector = 'nav a[href="/"]';
      break;
    case 2:
      selector = 'nav a[href="/calendar"]';
      break;
    case 3:
      selector = 'nav a[href="/groups"]';
      break;
    case 4:
      selector = 'nav a[href="/rooms"]';
      break;
    case 5:
      selector = 'nav a[href="/add"]';
      break;
    case 6:
      selector = 'nav a[href="/spark"]';
      break;
    case 7:
      selector = 'nav a[href="/vaults"]';
      break;
    case 8:
      selector = 'nav a[href="/analytics"]';
      break;
    case 9:
      selector = 'nav a[href="/coach"]';
      break;
    case 10:
      selector = 'a[href="/notifications"]';
      break;
    case 11:
      selector = 'a[href="/settings"]';
      break;
    default:
      break;
  }

  if (selector) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  const route = stepInfo.route;
  const fallbackEl = document.querySelector(`a[href="${route}"]`);
  return fallbackEl || null;
};

export default function TourOverlay() {
  const { tourStep, nextTourStep, skipTour } = useTour();
  const { firebaseUser } = useAuth();
  const [cardPosition, setCardPosition] = React.useState<CardPosition>({});

  const currentStepInfo = tourStep !== null ? TOUR_STEPS[tourStep - 1] : null;

  const updatePosition = React.useCallback(() => {
    if (tourStep === null) return;
    const target = getTargetElement(tourStep);
    if (!target) {
      setCardPosition({
        top: undefined,
        left: undefined,
        bottom: 120, // default offset above bottom navigation if no target is found
        arrowDirection: undefined
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const cardWidth = 380;
    const cardHeight = 220;
    const gap = 16;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Check if the target is part of the bottom navigation bar or near the bottom
    const isBottomNav = target.closest('nav') !== null || rect.bottom > vh - 120;

    let top: number | undefined = undefined;
    let left: number | undefined = undefined;
    let bottom: number | undefined = undefined;
    let arrowDirection: 'up' | 'down' | undefined = undefined;
    let arrowStyle: React.CSSProperties = {};

    if (isBottomNav) {
      // Position directly ABOVE the item
      bottom = (vh - rect.top) + gap;
      
      const targetCenterX = rect.left + rect.width / 2;
      left = targetCenterX - (Math.min(vw - 32, cardWidth) / 2);
      
      const padding = 16;
      left = Math.max(padding, Math.min(vw - Math.min(vw - 32, cardWidth) - padding, left));
      
      arrowDirection = 'down';
      const arrowLeft = targetCenterX - left;
      arrowStyle = {
        left: `${arrowLeft}px`,
        bottom: '-6px',
        transform: 'translateX(-50%) rotate(45deg)',
      };
    } else {
      // Position BELOW the item if it fits, else above
      const targetCenterX = rect.left + rect.width / 2;
      const targetBottomY = rect.bottom;

      if (targetBottomY + cardHeight + gap < vh - 16) {
        top = targetBottomY + gap;
        left = targetCenterX - (Math.min(vw - 32, cardWidth) / 2);
        
        const padding = 16;
        left = Math.max(padding, Math.min(vw - Math.min(vw - 32, cardWidth) - padding, left));

        arrowDirection = 'up';
        const arrowLeft = targetCenterX - left;
        arrowStyle = {
          left: `${arrowLeft}px`,
          top: '-6px',
          transform: 'translateX(-50%) rotate(45deg)',
        };
      } else {
        bottom = (vh - rect.top) + gap;
        left = targetCenterX - (Math.min(vw - 32, cardWidth) / 2);
        
        const padding = 16;
        left = Math.max(padding, Math.min(vw - Math.min(vw - 32, cardWidth) - padding, left));

        arrowDirection = 'down';
        const arrowLeft = targetCenterX - left;
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

  React.useEffect(() => {
    if (tourStep === null) return;
    updatePosition();

    window.addEventListener('resize', updatePosition);
    const interval = setInterval(updatePosition, 100);

    return () => {
      window.removeEventListener('resize', updatePosition);
      clearInterval(interval);
    };
  }, [tourStep, updatePosition]);

  if (tourStep === null || !firebaseUser || !currentStepInfo) return null;

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
        
        {/* Tour Dialog Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className="absolute bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-[28px] shadow-2xl pointer-events-auto space-y-4 transition-all duration-300"
          style={{
            top: cardPosition.top !== undefined ? `${cardPosition.top}px` : undefined,
            left: cardPosition.left !== undefined ? `${cardPosition.left}px` : '50%',
            bottom: cardPosition.bottom !== undefined ? `${cardPosition.bottom}px` : undefined,
            transform: cardPosition.left !== undefined ? undefined : 'translateX(-50%)',
            width: typeof window !== 'undefined' ? `${Math.min(window.innerWidth - 32, 380)}px` : '380px',
          }}
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
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
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
              {currentStepInfo.title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
              {currentStepInfo.description}
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
                      s === tourStep ? 'w-5 bg-emerald-500' : 'w-1.5 bg-zinc-200 dark:bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>
            <button
              onClick={nextTourStep}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
            >
              {tourStep === TOUR_STEPS.length ? "Finish" : "Next"} <ChevronRight size={12} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

