export interface Profile {
  id: number
  name: string
  age?: number
  values: string[]
  struggles: string[]
  ideal_self: string
  weight_unit: string
  currency: string
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  title: string
  description?: string
  category: 'health' | 'career' | 'finance' | 'relationships' | 'personal' | 'other'
  target_date?: string
  status: 'active' | 'completed' | 'paused'
  progress: number
  milestones: Milestone[]
  created_at: string
}

export interface Milestone {
  id: string
  title: string
  completed: boolean
  completed_at?: string
}

export interface Habit {
  id: string
  title: string
  type: 'build' | 'break'
  category: string
  frequency: 'daily' | 'weekly'
  streak: number
  best_streak: number
  active: boolean
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  date: string
  completed: boolean
  notes?: string
}

export interface DailyCheckin {
  id: string
  date: string
  mood: number
  energy: number
  stress: number
  notes?: string
}

export interface Meal {
  id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description: string
  calories?: number
  protein?: number
  carbs?: number
  fats?: number
}

export interface WaterLog {
  id: string
  date: string
  amount: number
  logged_at: string
}

export interface SleepLog {
  id: string
  date: string
  bedtime: string
  wake_time: string
  quality: number
  notes?: string
}

export interface ExerciseLog {
  id: string
  date: string
  type: string
  duration: number
  intensity: 'low' | 'medium' | 'high'
  notes?: string
  created_at: string
}

export interface BodyMetric {
  id: string
  date: string
  weight?: number
  notes?: string
}

export interface IncomeEntry {
  id: string
  date: string
  amount: number
  category: string
  description: string
  recurring: boolean
  created_at: string
}

export interface ExpenseEntry {
  id: string
  date: string
  amount: number
  category: string
  description: string
  recurring: boolean
  created_at: string
}

export interface SavingsGoal {
  id: string
  title: string
  target_amount: number
  current_amount: number
  target_date?: string
  created_at: string
}

export interface JournalEntry {
  id: string
  date: string
  type: 'journal' | 'brain_dump' | 'gratitude' | 'idea' | 'problem'
  title?: string
  content: string
  tags: string[]
  created_at: string
}

export interface Routine {
  id: string
  type: 'morning' | 'evening'
  title: string
  steps: RoutineStep[]
  active: boolean
  created_at: string
}

export interface RoutineStep {
  id: string
  title: string
  duration?: number
  order: number
}

export interface RoutineLog {
  id: string
  routine_id: string
  date: string
  completed_steps: string[]
}

export interface LearningItem {
  id: string
  type: 'book' | 'course' | 'skill'
  title: string
  author?: string
  status: 'want' | 'in_progress' | 'completed'
  progress: number
  notes?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface Relationship {
  id: string
  name: string
  type: 'family' | 'friend' | 'romantic' | 'professional' | 'other'
  importance: number
  last_contact?: string
  notes?: string
  created_at: string
}

export interface RelationshipLog {
  id: string
  relationship_id: string
  date: string
  type: string
  notes?: string
  created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
