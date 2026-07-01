import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  // Parse YYYY-MM-DD as local date
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getDaysUntil(birthday: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [year, month, day] = birthday.split('-').map(Number);
  const bday = new Date(today.getFullYear(), month - 1, day);
  
  if (bday < today) {
    bday.setFullYear(today.getFullYear() + 1);
  }
  
  const diffTime = bday.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getAge(birthday: string) {
  const today = new Date();
  const [year, month, day] = birthday.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getTurningAge(birthday: string) {
  const today = new Date();
  const [year, month, day] = birthday.split('-').map(Number);
  const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
  
  let turningYear = today.getFullYear();
  if (bdayThisYear < today) {
    turningYear++;
  }
  
  return turningYear - year;
}

export function getPreciseCountdown(birthday: string) {
  const today = new Date();
  const [year, month, day] = birthday.split('-').map(Number);
  let bday = new Date(today.getFullYear(), month - 1, day);
  
  if (bday < today) {
    bday.setFullYear(today.getFullYear() + 1);
  }
  
  const diff = bday.getTime() - today.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds };
}

export function getConnectionScore(person: any) {
  let score = 0;
  if (person.importance) score += person.importance * 10;
  if (person.memories?.length) score += person.memories.length * 5;
  if (person.tasks?.length) {
    const completed = person.tasks.filter((t: any) => t.completed).length;
    score += completed * 15;
  }
  const friendshipScore = person.friendshipScore ?? person.relationshipScore;
  if (friendshipScore) score += friendshipScore;
  return Math.min(score, 100);
}

export function getDisplayName(user?: { name?: string; nameDisplayPreference?: 'full' | 'first' } | null) {
  if (!user || !user.name) return '';
  if (user.nameDisplayPreference === 'first') {
    return user.name.split(' ')[0] || user.name;
  }
  return user.name;
}

export interface AIAccentClasses {
  text: string;
  textMuted: string;
  bgLight: string;
  border: string;
  borderLight: string;
  bgSolid: string;
  bgSolidHover: string;
  ring: string;
  focusRing: string;
  gradientFrom: string;
  gradientTo: string;
  badge: string;
  iconBg: string;
  iconText: string;
}

export function getAIAccent(color?: 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | null): AIAccentClasses {
  const c = color || 'violet';
  switch (c) {
    case 'emerald':
      return {
        text: 'text-emerald-600 dark:text-emerald-400',
        textMuted: 'text-emerald-500 dark:text-emerald-500',
        bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        borderLight: 'border-emerald-100 dark:border-emerald-900/40',
        bgSolid: 'bg-emerald-500 dark:bg-emerald-600',
        bgSolidHover: 'hover:bg-emerald-600 dark:hover:bg-emerald-700',
        ring: 'ring-emerald-500/20',
        focusRing: 'focus:ring-emerald-500',
        gradientFrom: 'from-emerald-500/20 dark:from-emerald-950/30',
        gradientTo: 'to-teal-500/10 dark:to-teal-950/10',
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40',
        iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
        iconText: 'text-emerald-600 dark:text-emerald-400'
      };
    case 'amber':
      return {
        text: 'text-amber-600 dark:text-amber-400',
        textMuted: 'text-amber-500 dark:text-amber-500',
        bgLight: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800/60',
        borderLight: 'border-amber-100 dark:border-amber-900/40',
        bgSolid: 'bg-amber-500 dark:bg-amber-600',
        bgSolidHover: 'hover:bg-amber-600 dark:hover:bg-amber-700',
        ring: 'ring-amber-500/20',
        focusRing: 'focus:ring-amber-500',
        gradientFrom: 'from-amber-500/20 dark:from-amber-950/30',
        gradientTo: 'to-orange-500/10 dark:to-orange-950/10',
        badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40',
        iconBg: 'bg-amber-100 dark:bg-amber-950/60',
        iconText: 'text-amber-600 dark:text-amber-400'
      };
    case 'sky':
      return {
        text: 'text-sky-600 dark:text-sky-400',
        textMuted: 'text-sky-500 dark:text-sky-500',
        bgLight: 'bg-sky-50 dark:bg-sky-950/40',
        border: 'border-sky-200 dark:border-sky-800/60',
        borderLight: 'border-sky-100 dark:border-sky-900/40',
        bgSolid: 'bg-sky-500 dark:bg-sky-600',
        bgSolidHover: 'hover:bg-sky-600 dark:hover:bg-sky-700',
        ring: 'ring-sky-500/20',
        focusRing: 'focus:ring-sky-500',
        gradientFrom: 'from-sky-500/20 dark:from-sky-950/30',
        gradientTo: 'to-blue-500/10 dark:to-blue-950/10',
        badge: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40',
        iconBg: 'bg-sky-100 dark:bg-sky-950/60',
        iconText: 'text-sky-600 dark:text-sky-400'
      };
    case 'rose':
      return {
        text: 'text-rose-600 dark:text-rose-400',
        textMuted: 'text-rose-500 dark:text-rose-500',
        bgLight: 'bg-rose-50 dark:bg-rose-950/40',
        border: 'border-rose-200 dark:border-rose-800/60',
        borderLight: 'border-rose-100 dark:border-rose-900/40',
        bgSolid: 'bg-rose-500 dark:bg-rose-600',
        bgSolidHover: 'hover:bg-rose-600 dark:hover:bg-rose-700',
        ring: 'ring-rose-500/20',
        focusRing: 'focus:ring-rose-500',
        gradientFrom: 'from-rose-500/20 dark:from-rose-950/30',
        gradientTo: 'to-pink-500/10 dark:to-pink-950/10',
        badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40',
        iconBg: 'bg-rose-100 dark:bg-rose-950/60',
        iconText: 'text-rose-600 dark:text-rose-400'
      };
    case 'violet':
    default:
      return {
        text: 'text-violet-600 dark:text-violet-400',
        textMuted: 'text-violet-500 dark:text-violet-500',
        bgLight: 'bg-violet-50 dark:bg-violet-950/40',
        border: 'border-violet-200 dark:border-violet-800/60',
        borderLight: 'border-violet-100 dark:border-violet-900/40',
        bgSolid: 'bg-violet-500 dark:bg-violet-600',
        bgSolidHover: 'hover:bg-violet-600 dark:hover:bg-violet-700',
        ring: 'ring-violet-500/20',
        focusRing: 'focus:ring-violet-500',
        gradientFrom: 'from-violet-500/20 dark:from-violet-950/30',
        gradientTo: 'to-purple-500/10 dark:to-purple-950/10',
        badge: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/40',
        iconBg: 'bg-violet-100 dark:bg-violet-950/60',
        iconText: 'text-violet-600 dark:text-violet-400'
      };
  }
}

