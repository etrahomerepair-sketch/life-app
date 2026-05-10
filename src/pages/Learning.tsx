import { useEffect, useState } from 'react'
import { Plus, BookOpen, GraduationCap, Zap, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/Progress'
import type { LearningItem } from '../types'

const typeIcons = { book: BookOpen, course: GraduationCap, skill: Zap }
const typeColors = { book: 'blue' as const, course: 'yellow' as const, skill: 'green' as const }
const typeEmojis = { book: '📚', course: '🎓', skill: '⚡' }

export function Learning() {
  const [items, setItems] = useState<LearningItem[]>([])
  const [tab, setTab] = useState<'in_progress' | 'want' | 'completed'>('in_progress')
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [lType, setLType] = useState<'book' | 'course' | 'skill'>('book')
  const [lTitle, setLTitle] = useState('')
  const [lAuthor, setLAuthor] = useState('')
  const [lNotes, setLNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('learning_items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  async function saveItem() {
    setSaving(true)
    const { data } = await supabase.from('learning_items').insert({
      type: lType, title: lTitle, author: lAuthor || null, notes: lNotes || null, status: 'want', progress: 0,
    }).select().single()
    if (data) setItems([data, ...items])
    setSaving(false); setAddOpen(false)
    setLTitle(''); setLAuthor(''); setLNotes('')
  }

  async function updateStatus(item: LearningItem, status: LearningItem['status']) {
    const updates: Partial<LearningItem> = { status }
    if (status === 'in_progress' && !item.started_at) updates.started_at = new Date().toISOString().split('T')[0]
    if (status === 'completed') { updates.progress = 100; updates.completed_at = new Date().toISOString().split('T')[0] }
    await supabase.from('learning_items').update(updates).eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, ...updates } : i))
  }

  async function updateProgress(item: LearningItem, progress: number) {
    await supabase.from('learning_items').update({ progress }).eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, progress } : i))
  }

  async function deleteItem(id: string) {
    await supabase.from('learning_items').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => i.status === tab)
  const Icon = (type: string) => typeIcons[type as keyof typeof typeIcons] || BookOpen

  return (
    <Layout title="Learning">
      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-4 p-1 bg-bg-card border border-border rounded-xl">
        {([['in_progress', '📖 Active'], ['want', '🎯 Want'], ['completed', '✅ Done']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-accent text-white' : 'text-muted'}`}
          >{label} ({items.filter(i => i.status === t).length})</button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-border mx-auto mb-3" />
            <p className="font-bold text-white mb-1">
              {tab === 'in_progress' ? 'Nothing in progress' : tab === 'want' ? 'Nothing on your list' : 'Nothing completed yet'}
            </p>
            <p className="text-muted text-sm">Add books, courses, or skills you want to learn.</p>
          </div>
        ) : (
          filtered.map(item => {
            const IconEl = Icon(item.type)
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-${typeColors[item.type as keyof typeof typeColors]}/20`}>
                    <IconEl className={`w-5 h-5 text-${typeColors[item.type as keyof typeof typeColors]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white text-sm">{item.title}</p>
                        {item.author && <p className="text-xs text-muted mt-0.5">by {item.author}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={typeColors[item.type as keyof typeof typeColors]}>
                          {typeEmojis[item.type as keyof typeof typeEmojis]} {item.type}
                        </Badge>
                        <button onClick={() => deleteItem(item.id)} className="text-muted hover:text-danger">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {item.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted mb-1">
                          <span>Progress</span><span>{item.progress}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={item.progress}
                          onChange={e => updateProgress(item, parseInt(e.target.value))} className="w-full" />
                      </div>
                    )}

                    {item.notes && <p className="text-xs text-muted mt-2">{item.notes}</p>}

                    <div className="flex gap-2 mt-3">
                      {item.status === 'want' && (
                        <button onClick={() => updateStatus(item, 'in_progress')}
                          className="text-xs px-3 py-1.5 bg-accent/20 text-accent-light rounded-lg font-medium">Start →</button>
                      )}
                      {item.status === 'in_progress' && (
                        <button onClick={() => updateStatus(item, 'completed')}
                          className="text-xs px-3 py-1.5 bg-success/20 text-success rounded-lg font-medium">Mark Done ✓</button>
                      )}
                      {item.status === 'completed' && (
                        <span className="text-xs text-success flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}

        <Button onClick={() => setAddOpen(true)} fullWidth variant="secondary">
          <Plus className="w-5 h-5 mr-2" /> Add to Learning List
        </Button>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add to Learning List">
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-muted block mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['book', 'course', 'skill'] as const).map(t => (
                <button key={t} onClick={() => setLType(t)}
                  className={`py-3 rounded-xl border flex flex-col items-center gap-1 transition-colors text-sm font-medium ${
                    lType === t ? 'bg-accent/20 border-accent/40 text-accent-light' : 'border-border text-muted'
                  }`}
                >
                  <span className="text-lg">{typeEmojis[t]}</span>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Input label={lType === 'book' ? 'Book title' : lType === 'course' ? 'Course name' : 'Skill name'}
            value={lTitle} onChange={e => setLTitle(e.target.value)} placeholder={`Enter ${lType} name...`} autoFocus />
          {lType === 'book' && (
            <Input label="Author (optional)" value={lAuthor} onChange={e => setLAuthor(e.target.value)} placeholder="Author name" />
          )}
          <Textarea label="Notes (optional)" value={lNotes} onChange={e => setLNotes(e.target.value)} placeholder="Why do you want to learn this?" rows={3} />
          <Button onClick={saveItem} disabled={!lTitle.trim() || saving} fullWidth>Add to List</Button>
        </div>
      </Modal>
    </Layout>
  )
}
