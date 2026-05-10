import { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Circle, Trash2, Sun, Moon, GripVertical, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { ProgressBar } from '../components/ui/Progress'
import { today } from '../lib/utils'
import type { Routine, RoutineStep, RoutineLog } from '../types'

export function Routines() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [logs, setLogs] = useState<RoutineLog[]>([])
  const [tab, setTab] = useState<'morning' | 'evening'>('morning')
  const [addOpen, setAddOpen] = useState(false)
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null)
  const [loading, setLoading] = useState(true)

  const [rTitle, setRTitle] = useState('')
  const [rSteps, setRSteps] = useState<RoutineStep[]>([])
  const [newStep, setNewStep] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const t = today()
    const [rRes, lRes] = await Promise.all([
      supabase.from('routines').select('*').eq('active', true).order('created_at'),
      supabase.from('routine_logs').select('*').eq('date', t),
    ])
    if (rRes.data) setRoutines(rRes.data.map(r => ({ ...r, steps: r.steps || [] })))
    if (lRes.data) setLogs(lRes.data.map(l => ({ ...l, completed_steps: l.completed_steps || [] })))
    setLoading(false)
  }

  async function toggleStep(routine: Routine, step: RoutineStep) {
    const t = today()
    const log = logs.find(l => l.routine_id === routine.id)
    const currentSteps = log?.completed_steps || []
    const isCompleted = currentSteps.includes(step.id)
    const newSteps = isCompleted ? currentSteps.filter(s => s !== step.id) : [...currentSteps, step.id]

    if (log) {
      const { data } = await supabase.from('routine_logs').update({ completed_steps: newSteps }).eq('id', log.id).select().single()
      if (data) setLogs(logs.map(l => l.id === log.id ? { ...l, completed_steps: newSteps } : l))
    } else {
      const { data } = await supabase.from('routine_logs').insert({ routine_id: routine.id, date: t, completed_steps: newSteps }).select().single()
      if (data) setLogs([...logs, data])
    }
  }

  function addStep() {
    if (!newStep.trim()) return
    setRSteps([...rSteps, { id: crypto.randomUUID(), title: newStep.trim(), order: rSteps.length }])
    setNewStep('')
  }

  async function saveRoutine() {
    setSaving(true)
    if (editRoutine) {
      const { data } = await supabase.from('routines').update({ title: rTitle, steps: rSteps }).eq('id', editRoutine.id).select().single()
      if (data) setRoutines(routines.map(r => r.id === editRoutine.id ? { ...data, steps: data.steps || [] } : r))
    } else {
      const { data } = await supabase.from('routines').insert({
        type: tab, title: rTitle || `${tab === 'morning' ? 'Morning' : 'Evening'} Routine`, steps: rSteps, active: true,
      }).select().single()
      if (data) setRoutines([...routines, { ...data, steps: data.steps || [] }])
    }
    setSaving(false)
    setAddOpen(false)
    setEditRoutine(null)
    setRTitle(''); setRSteps([])
  }

  async function deleteRoutine(id: string) {
    await supabase.from('routines').update({ active: false }).eq('id', id)
    setRoutines(routines.filter(r => r.id !== id))
  }

  function openEdit(r: Routine) {
    setEditRoutine(r)
    setRTitle(r.title)
    setRSteps(r.steps)
    setAddOpen(true)
  }

  const tabRoutines = routines.filter(r => r.type === tab)

  function getCompletedSteps(routine: Routine) {
    const log = logs.find(l => l.routine_id === routine.id)
    return log?.completed_steps || []
  }

  return (
    <Layout title="Routines">
      <div className="flex gap-2 mx-4 mt-4">
        <button
          onClick={() => setTab('morning')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-colors ${
            tab === 'morning' ? 'bg-warning/20 border-warning/40 text-warning' : 'border-border text-muted'
          }`}
        >
          <Sun className="w-4 h-4" /> Morning
        </button>
        <button
          onClick={() => setTab('evening')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-colors ${
            tab === 'evening' ? 'bg-accent/20 border-accent/40 text-accent-light' : 'border-border text-muted'
          }`}
        >
          <Moon className="w-4 h-4" /> Evening
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : tabRoutines.length === 0 ? (
          <div className="text-center py-12">
            {tab === 'morning' ? <Sun className="w-12 h-12 text-border mx-auto mb-3" /> : <Moon className="w-12 h-12 text-border mx-auto mb-3" />}
            <p className="font-bold text-white mb-1">No {tab} routine</p>
            <p className="text-muted text-sm mb-4">Build a {tab} routine to start your day right.</p>
          </div>
        ) : (
          tabRoutines.map(routine => {
            const completed = getCompletedSteps(routine)
            const pct = routine.steps.length > 0 ? Math.round((completed.length / routine.steps.length) * 100) : 0
            return (
              <Card key={routine.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white">{routine.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{pct}%</span>
                    <button onClick={() => openEdit(routine)} className="text-muted hover:text-white transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteRoutine(routine.id)} className="text-muted hover:text-danger transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <ProgressBar value={completed.length} max={Math.max(routine.steps.length, 1)} className="mb-3" />
                <div className="flex flex-col gap-2">
                  {routine.steps.sort((a, b) => a.order - b.order).map(step => {
                    const done = completed.includes(step.id)
                    return (
                      <button key={step.id} onClick={() => toggleStep(routine, step)} className="flex items-center gap-3 py-1.5 text-left">
                        {done
                          ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                          : <Circle className="w-5 h-5 text-border flex-shrink-0" />
                        }
                        <span className={`text-sm font-medium ${done ? 'text-muted line-through' : 'text-white'}`}>{step.title}</span>
                        {step.duration && <span className="text-xs text-muted ml-auto">{step.duration}m</span>}
                      </button>
                    )
                  })}
                </div>
                {pct === 100 && (
                  <p className="text-center text-success text-sm font-semibold mt-3">🎉 Routine complete!</p>
                )}
              </Card>
            )
          })
        )}

        <Button onClick={() => { setEditRoutine(null); setRTitle(''); setRSteps([]); setAddOpen(true) }} fullWidth variant="secondary">
          <Plus className="w-5 h-5 mr-2" /> Create Routine
        </Button>
      </div>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setEditRoutine(null) }} title={editRoutine ? 'Edit Routine' : 'New Routine'}>
        <div className="p-5 flex flex-col gap-4">
          <Input label="Routine name" value={rTitle} onChange={e => setRTitle(e.target.value)} placeholder={`${tab === 'morning' ? 'Morning' : 'Evening'} Routine`} />

          <div>
            <label className="text-sm font-medium text-muted block mb-2">Steps</label>
            <div className="flex gap-2 mb-3">
              <Input value={newStep} onChange={e => setNewStep(e.target.value)} placeholder="Add a step..." onKeyDown={e => e.key === 'Enter' && addStep()} className="flex-1" />
              <button onClick={addStep} className="px-3 py-2 bg-accent rounded-xl text-white text-sm font-medium flex-shrink-0">Add</button>
            </div>
            <div className="flex flex-col gap-2">
              {rSteps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-2 p-3 bg-bg-elevated rounded-xl border border-border">
                  <GripVertical className="w-4 h-4 text-muted flex-shrink-0" />
                  <span className="flex-1 text-sm text-white">{step.title}</span>
                  <button onClick={() => setRSteps(rSteps.filter(s => s.id !== step.id))} className="text-muted hover:text-danger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveRoutine} disabled={saving || rSteps.length === 0} fullWidth>
            {saving ? 'Saving...' : editRoutine ? 'Update Routine' : 'Create Routine'}
          </Button>
        </div>
      </Modal>
    </Layout>
  )
}
