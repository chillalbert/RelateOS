import React, { useState, useRef, useEffect } from 'react';
import { HeartPulse, Info, X, TrendingUp, Calendar, Zap, Award } from 'lucide-react';
import { HealthScoreInput, HealthScoreResult, calculateRelationshipHealthScore } from '../lib/healthScore';
import { cn } from '../lib/utils';

interface HealthScoreBadgeProps {
  input: HealthScoreInput;
  size?: 'sm' | 'md' | 'lg';
  showDetailsOnHover?: boolean;
  className?: string;
}

export const HealthScoreBadge: React.FC<HealthScoreBadgeProps> = ({
  input,
  size = 'md',
  showDetailsOnHover = true,
  className
}) => {
  const result: HealthScoreResult = calculateRelationshipHealthScore(input);
  const { score, label, reason, badgeStyle, breakdown } = result;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5 rounded-full',
    md: 'text-xs px-2.5 py-1 gap-2 rounded-full',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5 rounded-full'
  };

  const iconSizes = {
    sm: 11,
    md: 13,
    lg: 16
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => showDetailsOnHover && setIsOpen(true)}
        className={cn(
          "inline-flex items-center font-bold tracking-wide border transition-all cursor-pointer select-none active:scale-95 shadow-xs",
          badgeStyle.bg,
          badgeStyle.text,
          badgeStyle.border,
          sizeClasses[size],
          className
        )}
        title={reason}
        aria-expanded={isOpen}
        aria-label={`Relationship health score: ${score}/100, ${label}. ${reason}`}
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0 animate-pulse", badgeStyle.dot)} />
        <HeartPulse size={iconSizes[size]} className="shrink-0 opacity-80" />
        <span className="font-extrabold">{label}</span>
        <span className={cn("px-1.5 py-0.2 rounded-md font-black text-[10px] tracking-tight border", badgeStyle.badgeBg, badgeStyle.border)}>
          {score}
        </span>
      </button>

      {/* Popover / Tooltip modal with health score breakdown */}
      {isOpen && (
        <div
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 p-4 rounded-2xl bg-zinc-900/95 text-white border border-zinc-700 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
          onMouseLeave={() => showDetailsOnHover && setIsOpen(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg border", badgeStyle.bg, badgeStyle.border, badgeStyle.text)}>
                <HeartPulse size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-200">Relationship Health</h4>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", badgeStyle.bg, badgeStyle.text, badgeStyle.border)}>
                    {score}/100
                  </span>
                </div>
                <p className="text-[10px] font-extrabold text-zinc-400">{label} status</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close details"
            >
              <X size={14} />
            </button>
          </div>

          {/* Reason string */}
          <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-start gap-2">
            <Info size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-zinc-200 leading-snug">{reason}</p>
          </div>

          {/* Factor Breakdown Bars */}
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Factor Breakdown</p>
            
            {/* Recency */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-300">
                <span className="flex items-center gap-1"><Calendar size={11} className="text-zinc-400" /> Recency (40%)</span>
                <span className="font-mono font-bold text-zinc-200">{breakdown.recencyScore}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", badgeStyle.barColor)}
                  style={{ width: `${breakdown.recencyScore}%` }}
                />
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-300">
                <span className="flex items-center gap-1"><Zap size={11} className="text-zinc-400" /> Frequency (30%)</span>
                <span className="font-mono font-bold text-zinc-200">{breakdown.frequencyScore}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", badgeStyle.barColor)}
                  style={{ width: `${breakdown.frequencyScore}%` }}
                />
              </div>
            </div>

            {/* History Depth */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-300">
                <span className="flex items-center gap-1"><Award size={11} className="text-zinc-400" /> Shared History (20%)</span>
                <span className="font-mono font-bold text-zinc-200">{breakdown.depthScore}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", badgeStyle.barColor)}
                  style={{ width: `${breakdown.depthScore}%` }}
                />
              </div>
            </div>

            {/* Trend */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-zinc-300">
                <span className="flex items-center gap-1"><TrendingUp size={11} className="text-zinc-400" /> 30-Day Momentum (10%)</span>
                <span className="font-mono font-bold text-zinc-200">{breakdown.trendScore}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", badgeStyle.barColor)}
                  style={{ width: `${breakdown.trendScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface HealthScoreCompactBadgeProps {
  input: HealthScoreInput;
  className?: string;
}

export const HealthScoreCompactBadge: React.FC<HealthScoreCompactBadgeProps> = ({ input, className }) => {
  const result = calculateRelationshipHealthScore(input);
  const { score, label, reason, badgeStyle } = result;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 transition-transform hover:scale-105 cursor-help",
        badgeStyle.bg,
        badgeStyle.text,
        badgeStyle.border,
        className
      )}
      title={reason}
      aria-label={`Relationship score: ${score} (${label}). ${reason}`}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", badgeStyle.dot)} />
      <span>{score}</span>
    </span>
  );
};
