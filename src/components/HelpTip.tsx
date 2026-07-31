import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface HelpTipProps {
  content: string | React.ReactNode;
  title?: string;
  className?: string;
  iconSize?: number;
}

export default function HelpTip({ content, title, className, iconSize = 14 }: HelpTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
  });
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({
    left: '50%',
    transform: 'translateX(-50%)',
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!containerRef.current || !popoverRef.current) return;

      const btnRect = containerRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 12;

      // If trigger button is scrolled completely offscreen, hide popover
      if (
        btnRect.bottom < 0 ||
        btnRect.top > viewportHeight ||
        btnRect.right < 0 ||
        btnRect.left > viewportWidth
      ) {
        setIsOpen(false);
        return;
      }

      const popoverWidth = popoverRect.width;
      const popoverHeight = popoverRect.height;
      const btnCenter = btnRect.left + btnRect.width / 2;

      // Vertical placement calculation
      let currentPlacement: 'top' | 'bottom' = 'top';
      let top = btnRect.top - popoverHeight - 8;

      if (top < padding) {
        // Not enough space above trigger, flip to bottom
        currentPlacement = 'bottom';
        top = btnRect.bottom + 8;
      }

      // Horizontal placement calculation
      const idealLeft = btnCenter - popoverWidth / 2;
      const left = Math.max(padding, Math.min(idealLeft, viewportWidth - padding - popoverWidth));

      // Arrow alignment relative to popover box
      const arrowRelativeLeft = btnCenter - left;
      const arrowClampedLeft = Math.max(16, Math.min(arrowRelativeLeft, popoverWidth - 16));

      setPlacement(currentPlacement);
      setPopoverStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
      });

      setArrowStyle({
        left: `${arrowClampedLeft}px`,
        transform: 'translateX(-50%)',
      });
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("inline-flex items-center relative", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 text-zinc-400 hover:text-emerald-500 transition-colors rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
        title="Tap for help"
        aria-label="Help info"
      >
        <HelpCircle size={iconSize} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          onClick={(e) => e.stopPropagation()}
          className="w-64 max-w-[calc(100vw-24px)] p-3 bg-zinc-900 text-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 text-xs rounded-2xl shadow-xl border border-zinc-700/50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between font-bold text-[11px] text-emerald-400">
            <span>{title || 'Quick Info'}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
          <div className="text-zinc-300 font-sans leading-relaxed text-[11px]">
            {content}
          </div>
          <div
            style={arrowStyle}
            className={cn(
              "absolute border-4 border-transparent",
              placement === 'top'
                ? "top-full -mt-1 border-t-zinc-900 dark:border-t-zinc-800"
                : "bottom-full -mb-1 border-b-zinc-900 dark:border-b-zinc-800"
            )}
          />
        </div>
      )}
    </div>
  );
}
