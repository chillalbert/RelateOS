import { Person } from '../types';

export interface HealthScoreInput {
  person: Person | any;
  memories?: any[];
  reflections?: any[];
  photos?: any[];
  gifts?: any[];
  rooms?: any[];
}

export interface HealthScoreResult {
  score: number; // 0-100 integer
  label: 'Thriving' | 'Stable' | 'Fading' | 'Dormant';
  reason: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    dot: string;
    badgeBg: string;
    barColor: string;
  };
  breakdown: {
    recencyScore: number;
    frequencyScore: number;
    depthScore: number;
    trendScore: number;
    daysSince: number | null;
    actualCount90: number;
    expectedCount90: number;
    halflifeDays: number;
  };
}

/**
 * Safely converts any Firestore timestamp, Date, ISO string, or number to a JS Date.
 */
function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        return isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000);
    }
  }
  return null;
}

/**
 * Computes the Relationship Health Score (0-100) per person.
 */
export function calculateRelationshipHealthScore(input: HealthScoreInput): HealthScoreResult {
  const { person, memories = [], reflections = [], photos = [], gifts = [], rooms = [] } = input;

  const now = new Date();
  const nowMs = now.getTime();

  // 1. Collect all interaction timestamps
  const timestamps: number[] = [];

  function addTimestamp(val: any) {
    const d = parseDate(val);
    if (d) {
      const ms = d.getTime();
      // Ignore future timestamps (e.g. future birthday events)
      if (ms <= nowMs) {
        timestamps.push(ms);
      }
    }
  }

  // Source: lastCheckIn & checkInHistory
  if (person?.lastCheckIn?.date) {
    addTimestamp(person.lastCheckIn.date);
  }
  if (Array.isArray(person?.checkInHistory)) {
    person.checkInHistory.forEach((h: any) => {
      if (h?.date) addTimestamp(h.date);
    });
  }

  // Source: updated_at (reflects last notes/ai_notes edit)
  if (person?.updated_at) {
    addTimestamp(person.updated_at);
  }

  // Source: memories created_at
  if (Array.isArray(memories)) {
    memories.forEach((m: any) => {
      addTimestamp(m.created_at || m.date);
    });
  }

  // Source: reflections created_at
  if (Array.isArray(reflections)) {
    reflections.forEach((r: any) => {
      addTimestamp(r.created_at || r.date);
    });
  }

  // Source: photos uploaded_at
  if (Array.isArray(photos)) {
    photos.forEach((p: any) => {
      addTimestamp(p.uploadedAt || p.uploaded_at || p.created_at);
    });
  }

  // Source: gifts date (only entries with status "given")
  if (Array.isArray(gifts)) {
    gifts.forEach((g: any) => {
      if (g.status === 'given') {
        addTimestamp(g.date || g.created_at);
      }
    });
  }

  // Source: Party room co-attendance created_at
  if (Array.isArray(rooms)) {
    rooms.forEach((rm: any) => {
      addTimestamp(rm.created_at);
    });
  }

  // Find lastInteractionDate
  let lastInteractionMs: number | null = null;
  if (timestamps.length > 0) {
    lastInteractionMs = Math.max(...timestamps);
  }

  let daysSince: number | null = null;
  if (lastInteractionMs !== null) {
    daysSince = Math.max(0, (nowMs - lastInteractionMs) / (1000 * 60 * 60 * 24));
  }

  // Importance level scaling (1=Casual, 5=VIP)
  const importanceRaw = Number(person?.importance);
  const importance = [1, 2, 3, 4, 5].includes(importanceRaw) ? importanceRaw : 3;

  // 2. RECENCY SCORE (40% weight): exponential decay score = 100 * e^(-daysSince / halflife)
  const halflifeMap: Record<number, number> = {
    5: 10, // VIP gets short halflife ~10 days
    4: 20,
    3: 30,
    2: 45,
    1: 60  // Casual gets ~60 days
  };
  const halflifeDays = halflifeMap[importance] || 30;

  let recencyScore = 0;
  if (daysSince !== null) {
    recencyScore = 100 * Math.exp(-daysSince / halflifeDays);
  }
  recencyScore = Math.min(100, Math.max(0, recencyScore));

  // 3. FREQUENCY SCORE (30% weight): events in last 90 days vs expected count
  const msIn90Days = 90 * 24 * 60 * 60 * 1000;
  const cutoff90Ms = nowMs - msIn90Days;
  const eventsInLast90Days = timestamps.filter(t => t >= cutoff90Ms && t <= nowMs).length;

  const expectedEventsMap: Record<number, number> = {
    5: 13,   // VIP expects ~1 per week (~13 in 90 days)
    4: 7,    // ~1 every 2 weeks
    3: 4.5,  // ~1 every 3 weeks
    2: 2.5,  // ~1 per month
    1: 1.5   // Casual expects ~1 per 2 months
  };
  const expectedCount90 = expectedEventsMap[importance] || 4.5;
  let frequencyScore = (eventsInLast90Days / expectedCount90) * 100;
  frequencyScore = Math.min(100, Math.max(0, frequencyScore));

  // 4. DEPTH SCORE (20% weight): total count of memories + reflections + photos + gifts given + rooms
  const totalGivenGifts = Array.isArray(gifts) ? gifts.filter((g: any) => g.status === 'given').length : 0;
  const totalDepthItems = (memories?.length || 0) + (reflections?.length || 0) + (photos?.length || 0) + totalGivenGifts + (rooms?.length || 0);

  let depthScore = 0;
  if (totalDepthItems > 0) {
    // Diminishing returns via log2 scale
    depthScore = Math.log2(totalDepthItems + 1) * 25;
  }
  depthScore = Math.min(100, Math.max(0, depthScore));

  // 5. TREND SCORE (10% weight): compare last 30 days vs prior 30 days (days 31-60)
  const msIn30Days = 30 * 24 * 60 * 60 * 1000;
  const cutoff30Ms = nowMs - msIn30Days;
  const cutoff60Ms = nowMs - (2 * msIn30Days);

  const count30 = timestamps.filter(t => t >= cutoff30Ms && t <= nowMs).length;
  const prior30 = timestamps.filter(t => t >= cutoff60Ms && t < cutoff30Ms).length;

  let trendScore = 50;
  if (count30 > prior30) {
    trendScore = 50 + Math.min(50, (count30 - prior30) * 25);
  } else if (count30 < prior30) {
    trendScore = Math.max(0, 50 - (prior30 - count30) * 20);
  }
  trendScore = Math.min(100, Math.max(0, trendScore));

  // OVERALL WEIGHTED SCORE
  const weightedSum = (recencyScore * 0.40) + (frequencyScore * 0.30) + (depthScore * 0.20) + (trendScore * 0.10);
  const score = Math.min(100, Math.max(0, Math.round(weightedSum)));

  // LABEL MAPPING
  let label: 'Thriving' | 'Stable' | 'Fading' | 'Dormant' = 'Dormant';
  if (score >= 80) label = 'Thriving';
  else if (score >= 55) label = 'Stable';
  else if (score >= 30) label = 'Fading';
  else label = 'Dormant';

  // BADGE STYLING
  let badgeStyle = {
    bg: 'bg-zinc-500/10 dark:bg-zinc-800/80',
    text: 'text-zinc-600 dark:text-zinc-300',
    border: 'border-zinc-300 dark:border-zinc-700',
    dot: 'bg-zinc-400',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800',
    barColor: 'bg-zinc-500'
  };

  if (label === 'Thriving') {
    badgeStyle = {
      bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-500/30 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      barColor: 'bg-emerald-500'
    };
  } else if (label === 'Stable') {
    badgeStyle = {
      bg: 'bg-blue-500/10 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-500/30 dark:border-blue-800/60',
      dot: 'bg-blue-500',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/30',
      barColor: 'bg-blue-500'
    };
  } else if (label === 'Fading') {
    badgeStyle = {
      bg: 'bg-amber-500/10 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-500/30 dark:border-amber-800/60',
      dot: 'bg-amber-500',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/30',
      barColor: 'bg-amber-500'
    };
  }

  // REASON STRING GENERATION
  const impLabels: Record<number, string> = {
    5: 'a VIP',
    4: 'a Very Important',
    3: 'an Important',
    2: 'a Moderate',
    1: 'a Casual'
  };
  const impText = impLabels[importance] || 'an Important';

  let reason = '';
  if (daysSince === null) {
    reason = `No recent activity logged for this person.`;
  } else {
    const roundedDays = Math.round(daysSince);
    if (roundedDays === 0) {
      reason = `Recent contact today — target is every ~${halflifeDays} days for ${impText} relationship.`;
    } else if (roundedDays > halflifeDays) {
      reason = `Last contact ${roundedDays} days ago — expected every ~${halflifeDays} days for ${impText} relationship.`;
    } else {
      reason = `Last contact ${roundedDays} days ago — on track for ~${halflifeDays} day target for ${impText} relationship.`;
    }
  }

  return {
    score,
    label,
    reason,
    badgeStyle,
    breakdown: {
      recencyScore: Math.round(recencyScore),
      frequencyScore: Math.round(frequencyScore),
      depthScore: Math.round(depthScore),
      trendScore: Math.round(trendScore),
      daysSince,
      actualCount90: eventsInLast90Days,
      expectedCount90,
      halflifeDays
    }
  };
}
