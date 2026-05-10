import { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Circle, Flame, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { today, getStreakEmoji } from '../lib/utils'
import type { Habit, HabitLog } from '../types'

const categories = [
  { value: 'health', label: '💪 Health' }, { value: 'fitness', label: '🏃 Fitness' },
  { value: 'mental', label: '🧠 Mental' }, { value: 'social', label: '👥 Social' },
  { value: 'finance', label: '💰 Finance' }, { value: 'productivity', label: '⚡ Productivity' },
  { value: 'other', label: '✨ Other' },
]

export function Habits() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [tab, setTab] = useState<'today' | 'build' | 'break'>('today')
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [hTitle, setHTitle] = useState('')
  const [hType, setHType] = useState<'build' | 'break'>('build')
  const [hCategory, setHCategory] = useState('health')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const t = today()
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('*').eq('date', t),
    ])
    if (habitsRes.data) setHabits(habitsRes.data)
    if (logsRes.data) setLogs(logsRes.data)
    setLoading(false)
  }

  async function toggleHabit(habit: Habit) {
    const t = today()
    const existing = logs.find(l => l.habit_id === habit.id)
    if (existing) {
      await supabase.from('habit_logs').delete().eq('id', existing.id)
      setLogs(logs.filter(l => l.id !== existing.id))
      await supabase.from('habits').update({ streak: Math.max(0, habit.streak - 1) }).eq('id', habit.id)
      setHabits(habits.map(h => h.id === habit.id ? { ...h, streak: Math.max(0, h.streak - 1) } : h))
    } else {
      const { data } = await supabase.from('habit_logs').insert({ habit_id: habit.id, date: t, completed: true }).select().single()
      if (data) setLogs([...logs, data])
      const newStreak = habit.streak + 1
      await supabase.from('habits').update({ streak: newStreak, best_streak: Math.max(habit.best_streak, newStreak) }).eq('id', habit.id)
      setHabits(habits.map(h => h.id === habit.id ? { ...h, streak: newStreak, best_streak: Math.max(h.best_streak, newStreak) } : h))
    }
  }

  async function deleteHabit(id: string) {
    await supabase.from('habits').update({ active: false }).eq('id', id)
    setHabits(habits.filter(h => h.id !== id))
  }

  async function saveHabit() {
    if (!hTitle.trim()) return
    setSaving(true)
    const { data } = await supabase.from('habits').insert({
      title: hTitle.trim(), type: hType, category: hCategory, frequency: 'daily', streak: 0, best_streak: 0, active: true,
    }).select().single()
    if (data) setHabits([...habits, data])
    setSaving(false)
    setAddOpen(false)
    setHTitle('')
  }

  const isDone = (h: Habit) => logs.some(l => l.habit_id === h.id && l.completed)
  const todayHabits = habits
  const buildHabits = habits.filter(h => h.type === 'build')
  const breakHabits = habits.filter(h => h.type === 'break')

  const doneCount = logs.filter(l => l.completed).length
  const allDone = habits.length > 0 && doneCount === habits.length

  return (
    <Layout title="Habits">
      {/* Summary */}
      <div className="px-4 pt-4">
        <Card className={`p-4 flex items-center gap-4 ${allDone ? 'border-success/40 bg-success/5' : ''}`}>
          <div className="relative">
            <svg className="w-14 h-14 -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#252736" strokeWidth="5" />
              <circle
                cx="28" cy="28" r="22" fill="none" stroke={allDone ? '#10B981' : '#7C3AED'} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - (habits.length > 0 ? doneCount / habits.length : 0))}`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Flame className={`w-5 h-5 ${allDone ? 'text-success' : 'text-accent-light'}`} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{doneCount}<span className="text-muted font-normal text-lg">/{habits.length}</span></p>
            <p className="text-muted text-sm">{allDone ? '🎉 All done today!' : 'habits done today'}</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-4 p-1 bg-bg-card rounded-xl border border-border">
        {[['today', 'Today'], ['build', 'Building'], ['break', 'Breaking']] .map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-accent text-white' : 'text-muted'}`}
          >{label}</button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'today' && (
              todayHabits.length === 0 ? (
                <EmptyHabits onAdd={() => setAddOpen(true)} />
              ) : (
                todayHabits.map(h => <HabitRow key={h.id} habit={h} done={isDone(h)} onToggle={() => toggleHabit(h)} onDelete={() => deleteHabit(h.id)} />)
              )
            )}
            {tab === 'build' && (
              buildHabits.length === 0 ? <EmptyHabits type="build" onAdd={() => { setHType('build'); setAddOpen(true) }} />
              : buildHabits.map(h => <HabitRow key={h.id} habit={h} done={isDone(h)} onToggle={() => toggleHabit(h)} onDelete={() => deleteHabit(h.id)} />)
            )}
            {tab === 'break' && (
              breakHabits.length === 0 ? <EmptyHabits type="break" onAdd={() => { setHType('break'); setAddOpen(true) }} />
              : breakHabits.map(h => <HabitRow key={h.id} habit={h} done={isDone(h)} onToggle={() => toggleHabit(h)} onDelete={() => deleteHabit(h.id)} />)
            )}
          </>
        )}

        <Button onClick={() => setAddOpen(true)} fullWidth variant="secondary" className="mt-2">
          <Plus className="w-5 h-5 mr-2" /> Add Habit
        </Button>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Habit">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Habit name" value={hTitle} onChange={e => setHTitle(e.target.value)} placeholder="e.g. Read for 20 minutes" autoFocus />

          <div>
            <label className="text-sm font-medium text-muted block mb-2">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setHType('build')}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 border transition-colors font-medium text-sm ${
                  hType === 'build' ? 'bg-success/20 border-success/40 text-success' : 'border-border text-muted'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Build
              </button>
              <button
                onClick={() => setHType('break')}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 border transition-colors font-medium text-sm ${
                  hType === 'break' ? 'bg-danger/20 border-danger/40 text-danger' : 'border-border text-muted'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Break
              </button>
            </div>
          </div>

          <Select label="Category" value={hCategory} onChange={e => setHCategory(e.target.value)} options={categories} />

          <Button onClick={saveHabit} disabled={!hTitle.trim() || saving} fullWidth>
            {saving ? 'Saving...' : 'Add Habit'}
          </Button>
        </div>
      </Modal>
    </Layout>
  )
}

function HabitRow({ habit, done, onToggle, onDelete }: { habit: Habit; done: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <Card className={`px-4 py-3 flex items-center gap-3 ${done ? 'opacity-80' : ''}`}>
      <button onClick={onToggle}>
        {done
          ? <CheckCircle2 className="w-6 h-6 text-success" />
          : <Circle className="w-6 h-6 text-border" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${done ? 'text-muted line-through' : 'text-white'}`}>{habit.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge color={habit.type === 'build' ? 'green' : 'red'} className="text-[10px]">
            {habit.type === 'build' ? '📈 Build' : '🚫 Break'}
          </Badge>
          {habit.streak > 0 && (
            <span className="text-xs text-warning font-medium">{habit.streak} day streak {getStreakEmoji(habit.streak)}</span>
          )}
        </div>
      </div>
      <button onClick={onDelete} className="text-muted hover:text-danger transition-colors p-1">
        <Trash2 className="w-4 h-4" />
      </button>
    </Card>
  )
}

function EmptyHabits({ type, onAdd }: { type?: string; onAdd: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-3xl mb-2">{type === 'break' ? '🚫' : '⚡'}</p>
      <p className="font-bold text-white mb-1">
        {type === 'break' ? 'No habits to break' : type === 'build' ? 'No habits to build' : 'No habits yet'}
      </p>
      <p className="text-muted text-sm mb-4">
        {type === 'break' ? 'Track a bad habit you want to quit.' : 'Add a habit you want to build.'}
      </p>
      <button onClick={onAdd} className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold">Add Habit</button>
    </div>
  )
}
