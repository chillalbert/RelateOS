export interface Person {
  id: string;
  name: string;
  nickname?: string;
  birthday: string;
  category: 'friend' | 'family' | 'partner' | 'coworker' | 'other';
  importance: number;
  notes?: string;
  ai_notes?: string;
  interests?: string;
  updated_at?: any;
  photo_url?: string;
  isCloseFriend?: boolean;
  user_id?: string;
  host_uid?: string;
  birthYearUnknown?: boolean;
  lastCheckIn?: { date: string; answer: 'yes' | 'no' };
  checkInHistory?: { date: string; answer: 'yes' | 'no' }[];
  reminder_settings?: {
    one_week_before: boolean;
    three_days_before: boolean;
    day_of: boolean;
  };
  tasks?: Task[];
  memories?: Memory[];
  gifts?: Gift[];
}

export interface StreakProgress {
  currentCount: number;
  lastCompletedDate: string | null;
  cycleStartDate: string | null;
  introShownForCycleStart?: string | null;
}

export interface UnlockItem {
  id: string;
  name: string;
  description: string;
}

export interface ShopCosts {
  streakFreeze: number;
  leaderboardFlair: number;
  customAccentColor: number;
  bonusEnrichment: number;
}

export const DEFAULT_SHOP_COSTS: ShopCosts = {
  streakFreeze: 20,
  leaderboardFlair: 50,
  customAccentColor: 30,
  bonusEnrichment: 40
};

export interface GamificationConfig {
  dailyActionType: 'check_in' | 'note_edit' | 'memory_added' | string;
  cycleLengthDays: number;
  auraPerDay: number;
  unlockSequence: UnlockItem[];
  currentUnlockIndex: number;
  shopCosts?: ShopCosts;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string;
}

export interface Memory {
  id: string;
  year: number;
  type: string;
  content: string;
  created_at: any;
}

export interface Gift {
  id: string;
  name: string;
  status: 'idea' | 'given';
  price?: number;
  date?: string;
  occasion?: string;
  notes?: string;
}
