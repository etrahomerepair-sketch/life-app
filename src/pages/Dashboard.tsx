import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Droplets, Moon, Dumbbell, DollarSign, ChevronRight, CheckCircle2, Circle, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/Progress'
import { today, greet, getMoodEmoji, formatCurrency } from '../lib/utils'
import type { Profile, DailyCheckin, Habit, HabitLog, Goal } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [todayWater, setTodayWater] = useState(0)
  const [todaySpend, setTodaySpend] = useState(0)
  const [todayCalories, setTodayCalories] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const t = today()
    const [profileRes, checkinRes, habitsRes, habitLogsRes, goalsRes, waterRes, spendRes, mealsRes] = await Promise.all([
      supabase.from('profile').select('*').eq('id', 1).single(),
      supabase.from('daily_checkins').select('*').eq('date', t).single(),
      supabase.from('habits').select('*').eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('*').eq('date', t),
      supabase.from('goals').select('*').eq('status', 'active').limit(3),
      supabase.from('water_logs').select('amount').eq('date', t),
      supabase.from('expenses').select('amount').eq('date', t),
      supabase.from('meals').select('calories').eq('date', t),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (checkinRes.data) setCheckin(checkinRes.data)
    if (habitsRes.data) setHabits(habitsRes.data)
    if (habitLogsRes.data) setHabitLogs(habitLogsRes.data)
    if (goalsRes.data) setGoals(goalsRes.data)
    if (waterRes.data) setTodayWater(waterRes.data.reduce((s: number, r: any) => s + r.amount, 0))
    if (spendRes.data) setTodaySpend(spendRes.data.reduce((s: number, r: any) => s + r.amount, 0))
    if (mealsRes.data) setTodayCalories(mealsRes.data.reduce((s: number, r: any) => s + (r.calories || 0), 0))
    setLoading(false)
  }

  async function toggleHabit(habit: Habit) {
    const t = today()
    const existing = habitLogs.find(l => l.habit_id === habit.id)
    if (existing) {
      await supabase.from('habit_logs').delete().eq('id', existing.id)
      setHabitLogs(habitLogs.filter(l => l.id !== existing.id))
    } else {
      const { data } = await supabase.from('habit_logs').insert({ habit_id: habit.id, date: t, completed: true }).select().single()
      if (data) setHabitLogs([...habitLogs, data])
      // Update streak
      await supabase.from('habits').update({ streak: habit.streak + 1, best_streak: Math.max(habit.best_streak, habit.streak + 1) }).eq('id', habit.id)
      setHabits(habits.map(h => h.id === habit.id ? { ...h, streak: h.streak + 1, best_streak: Math.max(h.best_streak, h.streak + 1) } : h))
    }
  }

  const habitsCompletedToday = habitLogs.filter(l => l.completed).length
  const habitsTotal = habits.length

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
        {/* Greeting */}
        <div className="px-1">
          <h2 className="text-2xl font-black text-white">{greet(profile?.name || 'there')}</h2>
          <p className="text-muted text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            icon={<span className="text-2xl">{checkin ? getMoodEmoji(checkin.mood) : '—'}</span>}
            label="Mood"
            value={checkin ? `${checkin.mood}/10` : 'Log it'}
            onClick={() => navigate('/health')}
            color="purple"
          />
          <StatTile
            icon={<Droplets className="w-6 h-6 text-info" />}
            label="Water"
            value={todayWater > 0 ? `${(todayWater / 1000).toFixed(1)}L` : '0 L'}
            onClick={() => navigate('/health')}
            color="blue"
            sub={`of 2.5L goal`}
          />
          <StatTile
            icon={<Zap className="w-6 h-6 text-warning" />}
            label="Calories"
            value={todayCalories > 0 ? `${todayCalories}` : '—'}
            onClick={() => navigate('/health')}
            color="yellow"
            sub="kcal today"
          />
          <StatTile
            icon={<DollarSign className="w-6 h-6 text-success" />}
            label="Spent"
            value={todaySpend > 0 ? formatCurrency(todaySpend) : '$0'}
            onClick={() => navigate('/money')}
            color="green"
            sub="today"
          />
        </div>

        {/* Today's Habits */}
        {habits.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Today's Habits</h3>
              <span className="text-xs text-muted">{habitsCompletedToday}/{habitsTotal} done</span>
            </div>
            <ProgressBar value={habitsCompletedToday} max={Math.max(habitsTotal, 1)} className="mb-3" />
            <div className="flex flex-col gap-2">
              {habits.slice(0, 5).map(habit => {
                const done = habitLogs.some(l => l.habit_id === habit.id && l.completed)
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit)}
                    className="flex items-center gap-3 py-1.5 text-left"
                  >
                    {done
                      ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                      : <Circle className="w-5 h-5 text-border flex-shrink-0" />
                    }
                    <span className={`text-sm font-medium flex-1 ${done ? 'text-muted line-through' : 'text-white'}`}>
                      {habit.title}
                    </span>
                    {habit.streak > 1 && (
                      <span className="text-xs text-warning">{habit.streak}🔥</span>
                    )}
                  </button>
                )
              })}
            </div>
            {habits.length > 5 && (
              <button onClick={() => navigate('/goals')} className="mt-2 text-xs text-accent-light w-full text-center py-1">
                +{habits.length - 5} more habits
              </button>
            )}
          </Card>
        )}

        {/* Active Goals */}
        {goals.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Active Goals</h3>
              <button onClick={() => navigate('/goals')} className="text-xs text-accent-light flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {goals.map(goal => (
                <div key={goal.id} onClick={() => navigate('/goals')} className="cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate mr-2">{goal.title}</span>
                    <span className="text-xs text-muted flex-shrink-0">{goal.progress}%</span>
                  </div>
                  <ProgressBar value={goal.progress} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={<TrendingUp className="w-5 h-5" />} label="Log Mood" onClick={() => navigate('/health')} />
          <QuickAction icon={<Dumbbell className="w-5 h-5" />} label="Exercise" onClick={() => navigate('/health')} />
          <QuickAction icon={<Moon className="w-5 h-5" />} label="Sleep" onClick={() => navigate('/health')} />
        </div>

        {/* No data prompts */}
        {habits.length === 0 && goals.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-2xl mb-2">👋</p>
            <p className="font-bold text-white mb-1">Set up your life</p>
            <p className="text-muted text-sm mb-4">Start by adding goals and habits to track.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => navigate('/goals')} className="px-4 py-2 bg-accent/20 text-accent-light rounded-xl text-sm font-medium">Goals</button>
              <button onClick={() => navigate('/goals')} className="px-4 py-2 bg-bg-elevated border border-border rounded-xl text-sm font-medium text-muted">Habits</button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}

function StatTile({ icon, label, value, onClick, color, sub }: {
  icon: React.ReactNode; label: string; value: string; onClick: () => void; color: string; sub?: string
}) {
  const colors: Record<string, string> = {
    purple: 'bg-accent/10 border-accent/20',
    blue: 'bg-info/10 border-info/20',
    yellow: 'bg-warning/10 border-warning/20',
    green: 'bg-success/10 border-success/20',
  }
  return (
    <Card onClick={onClick} className={`p-4 border ${colors[color]}`}>
      <div className="flex items-start justify-between mb-2">
        {icon}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="text-xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </Card>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="p-3 flex flex-col items-center gap-1.5 text-center">
      <div className="text-muted">{icon}</div>
      <span className="text-xs text-muted font-medium">{label}</span>
    </Card>
  )
}
