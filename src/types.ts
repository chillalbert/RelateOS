export interface Person {
  id: string;
  name: string;
  nickname?: string;
  birthday: string;
  category: 'friend' | 'family' | 'partner' | 'coworker' | 'other';
  importance: number;
  notes?: string;
  photo_url?: string;
  reminder_settings?: {
    one_week_before: boolean;
    three_days_before: boolean;
    day_of: boolean;
  };
  tasks?: Task[];
  memories?: Memory[];
  gifts?: Gift[];
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
