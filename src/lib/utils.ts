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

export function getRelationshipScore(person: any) {
  let score = 0;
  if (person.importance) score += person.importance * 10;
  if (person.memories?.length) score += person.memories.length * 5;
  if (person.tasks?.length) {
    const completed = person.tasks.filter((t: any) => t.completed).length;
    score += completed * 15;
  }
  return Math.min(score, 100);
}
