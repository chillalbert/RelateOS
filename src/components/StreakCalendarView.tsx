import React from 'react';
import { Check, X, Zap, Calendar, Circle, Sparkles } from 'lucide-react';
import { StreakProgress } from '../types';
import { getLocalDateString, getLocalYesterdayString, getDailyActionLabel, getPhaseAwareTaskLabel, getCycleTaskPrefix } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export interface StreakCalendarViewProps {
  streakProgress?: StreakProgress | null;
  cycleLengthDays?: number;
  compact?: boolean;
  className?: string;
  showTitle?: boolean;
  dailyActionType?: string | null;
}

export function buildCycleDays(
  streakProgress?: StreakProgress | null,
  cycleLengthDays: number = 7
) {
  const today = getLocalDateString();
  const yesterday = getLocalYesterdayString();
  const currentCount = streakProgress?.currentCount || 0;
  const lastCompletedDate = streakProgress?.lastCompletedDate || null;

  let startYear: number, startMonth: number, startDay: number;

  if (streakProgress?.cycleStartDate) {
    const parts = streakProgress.cycleStartDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && parts[0] > 2000) {
      [startYear, startMonth, startDay] = parts;
    } else {
      const now = new Date();
      [startYear, startMonth, startDay] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    }
  } else if (lastCompletedDate) {
    const parts = lastCompletedDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      const completedObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const offset = Math.max(0, currentCount - 1);
      completedObj.setDate(completedObj.getDate() - offset);
      startYear = completedObj.getFullYear();
      startMonth = completedObj.getMonth() + 1;
      startDay = completedObj.getDate();
    } else {
      const now = new Date();
      [startYear, startMonth, startDay] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    }
  } else {
    const now = new Date();
    [startYear, startMonth, startDay] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  }

  const days: {
    dayNumber: number;
    dateStr: string;
    dayName: string;
    dateNum: number;
    status: 'completed' | 'missed' | 'today_pending' | 'upcoming';
    isToday: boolean;
  }[] = [];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < cycleLengthDays; i++) {
    const dateObj = new Date(startYear, startMonth - 1, startDay + i);
    const dateStr = getLocalDateString(dateObj);
    const dayName = dayNames[dateObj.getDay()];
    const dateNum = dateObj.getDate();
    const isToday = dateStr === today;

    let status: 'completed' | 'missed' | 'today_pending' | 'upcoming';

    if (dateStr < today) {
      // Past day
      if (i < currentCount || (lastCompletedDate && dateStr <= lastCompletedDate && i < currentCount)) {
        status = 'completed';
      } else {
        status = 'missed';
      }
    } else if (dateStr === today) {
      if (lastCompletedDate === today) {
        status = 'completed';
      } else {
        status = 'today_pending';
      }
    } else {
      status = 'upcoming';
    }

    days.push({
      dayNumber: i + 1,
      dateStr,
      dayName,
      dateNum,
      status,
      isToday
    });
  }

  return days;
}

export default function StreakCalendarView({
  streakProgress,
  cycleLengthDays = 7,
  compact = false,
  className = '',
  showTitle = true,
  dailyActionType
}: StreakCalendarViewProps) {
  const { user } = useAuth();
  const days = buildCycleDays(streakProgress, cycleLengthDays);
  const completedCount = days.filter(d => d.status === 'completed').length;
  const taskLabel = getPhaseAwareTaskLabel(user, dailyActionType);
  const taskPrefix = getCycleTaskPrefix(cycleLengthDays);

  return (
    <div className={`space-y-3 ${className}`}>
      {showTitle && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-200">
              <Calendar size={14} className="text-emerald-500 dark:text-emerald-400" />
              <span>Current Cycle Progress</span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700/50">
              {completedCount} / {cycleLengthDays} Days
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl">
            <Zap size={13} className="shrink-0 text-emerald-500 fill-emerald-500/20" />
            <span>{taskPrefix} <strong className="font-bold text-emerald-800 dark:text-emerald-200">{taskLabel}</strong></span>
          </div>
        </div>
      )}

      {/* Grid of days */}
      <div className={`grid grid-cols-7 gap-1.5 ${compact ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
        {days.map((day) => {
          let bgClasses = '';
          let icon = null;
          let titleText = `Day ${day.dayNumber} (${day.dayName} ${day.dateNum}): `;

          if (day.status === 'completed') {
            bgClasses = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-950/50';
            icon = <Check size={compact ? 12 : 14} className="stroke-[3]" />;
            titleText += 'Completed';
          } else if (day.status === 'missed') {
            bgClasses = 'bg-rose-500/10 text-rose-400/80 border-rose-500/20';
            icon = <X size={compact ? 12 : 14} className="stroke-[2.5]" />;
            titleText += 'Missed';
          } else if (day.status === 'today_pending') {
            bgClasses = 'bg-amber-500/15 text-amber-300 border-amber-400/80 ring-2 ring-amber-400/20 animate-pulse';
            icon = <Zap size={compact ? 12 : 14} className="fill-amber-400/30" />;
            titleText += 'Today (Pending)';
          } else {
            bgClasses = 'bg-zinc-800/40 text-zinc-500 border-zinc-700/40';
            icon = <Circle size={compact ? 8 : 10} className="text-zinc-600 fill-zinc-700/50" />;
            titleText += 'Upcoming';
          }

          return (
            <div
              key={day.dayNumber}
              title={titleText}
              className={`flex flex-col items-center justify-between rounded-xl border p-1.5 transition-all text-center select-none ${
                compact ? 'py-1 px-0.5' : 'py-2 px-1'
              } ${bgClasses}`}
            >
              <span className="text-[9px] font-mono uppercase tracking-tight text-zinc-400/80 leading-none mb-0.5">
                {day.dayName}
              </span>
              <div className="my-1 flex items-center justify-center">
                {icon}
              </div>
              <span className="text-[10px] font-bold font-mono leading-none">
                {day.dateNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center justify-around pt-1 text-[10px] text-zinc-400 border-t border-zinc-800/60 font-medium">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500/80 inline-block" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />
            <span>Upcoming</span>
          </div>
        </div>
      )}
    </div>
  );
}
