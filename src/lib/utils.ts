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

export function getRelationshipScore(person: any) {
  // Simple algorithm: Importance (1-5) * 15 + (Notes count * 10) + (Memories count * 5)
  let score = (person.importance || 3) * 15;
  if (person.notes) score += 10;
  
  const memoryCount = person.memory_count ?? (person.memories?.length || 0);
  score += memoryCount * 5;
  
  return Math.min(score, 100);
}
