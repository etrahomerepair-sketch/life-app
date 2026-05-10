import { useEffect, useState } from 'react'
import { Plus, Target, CheckCircle2, Circle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { ProgressBar, ProgressRing } from '../components/ui/Progress'
import type { Goal, Milestone } from '../types'
import { formatDate } from '../lib/utils'

const categories = [
  { value: 'health', label: '💪 Health' },
  { value: 'career', label: '💼 Career' },
  { value: 'finance', label: '💰 Finance' },
  { value: 'relationships', label: '❤️ Relationships' },
  { value: 'personal', label: '🌱 Personal Growth' },
  { value: 'other', label: '✨ Other' },
]

const categoryColors: Record<string, 'purple' | 'green' | 'yellow' | 'blue' | 'red' | 'gray'> = {
  health: 'green', career: 'blue', finance: 'yellow', relationships: 'red', personal: 'purple', other: 'gray',
}

export function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('personal')
  const [targetDate, setTargetDate] = useState('')
  const [newMilestone, setNewMilestone] = useState('')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
    if (data) setGoals(data.map(g => ({ ...g, milestones: g.milestones || [] })))
    setLoading(false)
  }

  function resetForm() {
    setTitle(''); setDescription(''); setCategory('personal'); setTargetDate(''); setMilestones([])
  }

  async function saveGoal() {
    if (!title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('goals').insert({
      title: title.trim(), description: description.trim(), category, target_date: targetDate || null,
      status: 'active', progress: 0, milestones,
    }).select().single()
    if (data) setGoals([{ ...data, milestones: data.milestones || [] }, ...goals])
    setSaving(false)
    setAddOpen(false)
    resetForm()
  }

  async function toggleMilestone(goal: Goal, milestone: Milestone) {
    const updated = goal.milestones.map(m =>
      m.id === milestone.id ? { ...m, completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : undefined } : m
    )
    const progress = Math.round((updated.filter(m => m.completed).length / updated.length) * 100)
    await supabase.from('goals').update({ milestones: updated, progress }).eq('id', goal.id)
    setGoals(goals.map(g => g.id === goal.id ? { ...g, milestones: updated, progress } : g))
  }

  async function completeGoal(goal: Goal) {
    await supabase.from('goals').update({ status: 'completed', progress: 100 }).eq('id', goal.id)
    setGoals(goals.map(g => g.id === goal.id ? { ...g, status: 'completed', progress: 100 } : g))
  }

  async function deleteGoal(id: string) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(goals.filter(g => g.id !== id))
  }

  async function updateProgress(goal: Goal, value: number) {
    await supabase.from('goals').update({ progress: value }).eq('id', goal.id)
    setGoals(goals.map(g => g.id === goal.id ? { ...g, progress: value } : g))
  }

  function addMilestone() {
    if (!newMilestone.trim()) return
    setMilestones([...milestones, { id: crypto.randomUUID(), title: newMilestone.trim(), completed: false }])
    setNewMilestone('')
  }

  const filtered = goals.filter(g => g.status === tab)

  return (
    <Layout title="Goals & Habits">
      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-4 p-1 bg-bg-card rounded-xl border border-border">
        {(['active', 'completed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? 'bg-accent text-white' : 'text-muted'
            }`}
          >
            {t === 'active' ? 'Active' : 'Completed'} ({goals.filter(g => g.status === t).length})
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Target className="w-12 h-12 text-border mx-auto mb-3" />
            <p className="font-bold text-white mb-1">{tab === 'active' ? 'No active goals' : 'No completed goals'}</p>
            <p className="text-muted text-sm">
              {tab === 'active' ? 'Set a goal to start working towards your ideal self.' : 'Complete your first goal to see it here.'}
            </p>
          </div>
        ) : (
          filtered.map(goal => (
            <Card key={goal.id} className="p-4">
              <div className="flex items-start gap-3">
                <ProgressRing value={goal.progress} size={52} strokeWidth={5}>
                  <span className="text-[10px] font-bold text-white">{goal.progress}%</span>
                </ProgressRing>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white leading-tight">{goal.title}</h3>
                    <button onClick={() => deleteGoal(goal.id)} className="text-muted hover:text-danger transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge color={categoryColors[goal.category] || 'gray'}>
                      {categories.find(c => c.value === goal.category)?.label || goal.category}
                    </Badge>
                    {goal.target_date && (
                      <span className="text-xs text-muted">{formatDate(goal.target_date)}</span>
                    )}
                  </div>
                </div>
              </div>

              {goal.description && (
                <p className="text-sm text-muted mt-2">{goal.description}</p>
              )}

              {/* Progress slider */}
              {goal.milestones.length === 0 && goal.status === 'active' && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Progress</span><span>{goal.progress}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={goal.progress}
                    onChange={e => updateProgress(goal, parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              {/* Milestones */}
              {goal.milestones.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setExpanded(expanded === goal.id ? null : goal.id)}
                    className="flex items-center gap-1 text-xs text-muted mb-2"
                  >
                    {expanded === goal.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Milestones ({goal.milestones.filter(m => m.completed).length}/{goal.milestones.length})
                  </button>
                  {expanded === goal.id && (
                    <div className="flex flex-col gap-2">
                      {goal.milestones.map(m => (
                        <button
                          key={m.id}
                          onClick={() => toggleMilestone(goal, m)}
                          className="flex items-center gap-2.5 text-left"
                        >
                          {m.completed
                            ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                            : <Circle className="w-4 h-4 text-border flex-shrink-0" />
                          }
                          <span className={`text-sm ${m.completed ? 'text-muted line-through' : 'text-white'}`}>{m.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {goal.status === 'active' && (
                <button
                  onClick={() => completeGoal(goal)}
                  className="mt-3 w-full py-2 rounded-xl border border-success/30 text-success text-sm font-medium hover:bg-success/10 transition-colors"
                >
                  Mark Complete ✓
                </button>
              )}
            </Card>
          ))
        )}

        <Button onClick={() => setAddOpen(true)} fullWidth variant="secondary">
          <Plus className="w-5 h-5 mr-2" /> Add Goal
        </Button>
      </div>

      {/* Add Goal Modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); resetForm() }} title="New Goal">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Goal title" value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to achieve?" />
          <Textarea label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Why does this matter to you?" rows={3} />
          <Select label="Category" value={category} onChange={e => setCategory(e.target.value)} options={categories} />
          <Input label="Target date (optional)" value={targetDate} onChange={e => setTargetDate(e.target.value)} type="date" />

          {/* Milestones */}
          <div>
            <label className="text-sm font-medium text-muted block mb-1.5">Milestones (optional)</label>
            <div className="flex gap-2 mb-2">
              <Input value={newMilestone} onChange={e => setNewMilestone(e.target.value)} placeholder="Add a milestone..." onKeyDown={e => e.key === 'Enter' && addMilestone()} className="flex-1" />
              <button onClick={addMilestone} className="px-3 py-2 bg-accent rounded-xl text-white text-sm font-medium flex-shrink-0">Add</button>
            </div>
            {milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 py-1.5">
                <Circle className="w-4 h-4 text-border flex-shrink-0" />
                <span className="text-sm text-white flex-1">{m.title}</span>
                <button onClick={() => setMilestones(milestones.filter(x => x.id !== m.id))} className="text-muted hover:text-danger">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button onClick={saveGoal} disabled={!title.trim() || saving} fullWidth>
            {saving ? 'Saving...' : 'Save Goal'}
          </Button>
        </div>
      </Modal>
    </Layout>
  )
}
