export interface ChatReply {
  status: string
  conversation_id: string
  turn_id: string
  reply: string
  meta: Record<string, unknown>
  emotion: string
  stress: number
}

export interface EmotionResult {
  status: string
  emotion: string
  confidence: number
  stress?: number
  distribution: Record<string, number>
  transcript?: string
}

export interface MoodDoc {
  date: string
  mood: number
  mood_label: string
  note?: string
  emotion?: string
  stress?: number
  ts?: number
}

export interface MoodToday {
  date: string
  mood: number | null
  mood_label?: string
  note?: string
  recorded: boolean
}

export interface WaterEntry {
  id: string
  amount_ml: number
  date: string
  ts?: number
}

export interface WaterToday {
  date: string
  total_ml: number
  goal_ml?: number
  percent?: number
  remaining_ml?: number
  glasses: number
  entries: WaterEntry[]
  streak?: number
}

export interface WaterHistoryItem {
  date: string
  total_ml: number
  glasses: number
  entries: WaterEntry[]
  percent?: number
  goal_ml?: number
}

export interface HabitDef {
  id: string
  name: string
  category?: string
  priority?: number
  priority_label?: string
  description?: string
  frequency?: string
  created_at?: number
  streak?: number
  longest_streak?: number
  completed_days?: number
  completion_percent?: number
  completed_today?: boolean
}

export interface HabitDayItem {
  id: string
  name: string
  category?: string
  priority?: number
  description?: string
  frequency?: string
  completed: boolean
}

export interface HabitToday {
  date: string
  habits: HabitDayItem[]
  completed: number
  total: number
  percent: number
  recorded: boolean
}

export interface HabitDaySummary {
  date: string
  completed: number
  total: number
  percent: number
}

export interface HabitDoc {
  date: string
  exercise?: boolean
  meditation?: boolean
  reading?: boolean
  walking?: boolean
  completed?: number
}

export interface HabitToday extends HabitDoc {
  recorded: boolean
}

export interface SleepDoc {
  date: string
  hours: number
  quality: number
  quality_label?: string
  ts?: number
}

export interface SleepToday {
  date: string
  hours: number | null
  quality: number | null
  quality_label?: string
  recorded: boolean
}

export interface JournalDoc {
  id: string
  title: string
  content: string
  mood_tag?: string
  section?: 'today' | 'tomorrow_story'
  date: string
  created_at?: number
  updated_at?: number
}

export interface DailyQuote {
  quote: string
  author: string
  theme: string
  date: string
}

export interface DayDetail {
  date: string
  stress_series: { ts: number; stress: number }[]
  emotion_counts: Record<string, number>
  emotion_percent: Record<string, number>
  sessions: {
    ts?: number
    stress: number | null
    emotion: string | null
    confidence?: number
    modalities?: string[]
    transcript?: string
    ai_reply?: string
  }[]
  mood: number | null
  mood_note?: string
  journals: { id: string; title: string; mood_tag?: string; section?: string }[]
  habits: { completed: number; total: number; percent: number } | null
  water: { total_ml: number; goal_ml: number; percent: number }
  sleep: { hours: number; quality: number } | null
}

export interface EmotionsResponse {
  period: string
  buckets: { bucket: string; counts: Record<string, number>; distribution: Record<string, number> }[]
  total_counts: Record<string, number>
  distribution: Record<string, number>
}

export interface Insight {
  title: string
  statement: string
  level: 'strong' | 'moderate' | 'weak' | 'none'
  samples: number
}

export interface InsightsResponse {
  insights: Insight[]
  count: number
}

export interface WellnessScore {
  overall: number | null
  level: string
  subscores: {
    emotion: number
    stress_relief: number
    sleep: number
    hydration: number
    habits: number
    mood: number
  }
}

export interface BurnoutMetric {
  score: number | null
  level: string
  samples?: number
}

export interface Overview {
  wellness: WellnessScore
  burnout: {
    stress: BurnoutMetric
    fatigue: BurnoutMetric
    burnout: BurnoutMetric
    isolation: BurnoutMetric
  }
  counts: {
    interactions: number
    journals: number
    moods: number
    active_days: number
  }
}

export interface Trends {
  period: string
  buckets: string[]
  stress: (number | null)[]
  emotions: Record<string, unknown>[]
  mood: (number | null)[]
  habits: (number | null)[]
}

export interface CalendarDay {
  date: string
  emotion: string | null
  stress: number | null
  mood: number | null
  journal: { id: string; title: string; mood_tag?: string } | null
}

export interface Calendar {
  month: string
  days: CalendarDay[]
}

export interface Conversation {
  conversation_id: string
  created_at?: number
  updated_at?: number
}

export interface ConversationTurn {
  turn_id: string
  question: string
  answer: string
  emotion?: string
  stress?: number
  ts?: number
}

export interface ConversationDetail {
  conversation: Conversation
  turns: ConversationTurn[]
}
