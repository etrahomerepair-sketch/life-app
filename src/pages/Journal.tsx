import { useEffect, useState } from 'react'
import { Plus, Trash2, BookOpen, Lightbulb, AlertCircle, Heart, Brain } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { today, formatDate } from '../lib/utils'
import type { JournalEntry } from '../types'

const entryTypes = [
  { value: 'journal', label: 'Journal', icon: BookOpen, color: 'purple' as const, emoji: '📓' },
  { value: 'gratitude', label: 'Gratitude', icon: Heart, color: 'red' as const, emoji: '🙏' },
  { value: 'brain_dump', label: 'Brain Dump', icon: Brain, color: 'blue' as const, emoji: '🧠' },
  { value: 'idea', label: 'Idea', icon: Lightbulb, color: 'yellow' as const, emoji: '💡' },
  { value: 'problem', label: 'Problem', icon: AlertCircle, color: 'gray' as const, emoji: '🔧' },
]

const journalPrompts = [
  'What are 3 things I\'m grateful for today?',
  'What did I accomplish today, no matter how small?',
  'What challenged me today and what did I learn?',
  'How am I feeling right now and why?',
  'What do I want to let go of today?',
  'What\'s one thing I could do differently tomorrow?',
]

export function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)

  const [eType, setEType] = useState('journal')
  const [eTitle, setETitle] = useState('')
  const [eContent, setEContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) setEntries(data)
    setLoading(false)
  }

  function openAdd(type?: string) {
    if (type) setEType(type)
    setAddOpen(true)
  }

  function usePrompt() {
    const prompt = journalPrompts[Math.floor(Math.random() * journalPrompts.length)]
    setEContent(prompt + '\n\n')
  }

  async function saveEntry() {
    if (!eContent.trim()) return
    setSaving(true)
    const { data } = await supabase.from('journal_entries').insert({
      date: today(), type: eType, title: eTitle.trim() || null, content: eContent.trim(), tags: [],
    }).select().single()
    if (data) setEntries([data, ...entries])
    setSaving(false)
    setAddOpen(false)
    setETitle(''); setEContent(''); setEType('journal')
  }

  async function deleteEntry(id: string) {
    await supabase.from('journal_entries').delete().eq('id', id)
    setEntries(entries.filter(e => e.id !== id))
    setViewEntry(null)
  }

  const filtered = filterType === 'all' ? entries : entries.filter(e => e.type === filterType)

  function getTypeInfo(type: string) {
    return entryTypes.find(t => t.value === type) || entryTypes[0]
  }

  return (
    <Layout title="Journal & Mind">
      {/* Quick add type buttons */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {entryTypes.map(t => (
            <button
              key={t.value}
              onClick={() => openAdd(t.value)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-bg-card border border-border rounded-xl text-sm font-medium text-muted hover:text-white hover:border-accent/40 transition-colors"
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mx-4 mt-3 p-1 bg-bg-card border border-border rounded-xl overflow-x-auto">
        <button
          onClick={() => setFilterType('all')}
          className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${filterType === 'all' ? 'bg-accent text-white' : 'text-muted'}`}
        >All</button>
        {entryTypes.map(t => (
          <button key={t.value} onClick={() => setFilterType(t.value)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${filterType === t.value ? 'bg-accent text-white' : 'text-muted'}`}
          >{t.emoji}</button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-border mx-auto mb-3" />
            <p className="font-bold text-white mb-1">Nothing here yet</p>
            <p className="text-muted text-sm mb-4">Start writing to track your thoughts, ideas, and reflections.</p>
            <button onClick={() => setAddOpen(true)} className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold">New Entry</button>
          </div>
        ) : (
          filtered.map(entry => {
            const info = getTypeInfo(entry.type)
            return (
              <Card key={entry.id} onClick={() => setViewEntry(entry)} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{info.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={info.color}>{info.label}</Badge>
                      <span className="text-xs text-muted">{formatDate(entry.date)}</span>
                    </div>
                    {entry.title && <p className="font-semibold text-white text-sm mb-1">{entry.title}</p>}
                    <p className="text-muted text-sm line-clamp-2">{entry.content}</p>
                  </div>
                </div>
              </Card>
            )
          })
        )}

        <Button onClick={() => setAddOpen(true)} fullWidth variant="secondary">
          <Plus className="w-5 h-5 mr-2" /> New Entry
        </Button>
      </div>

      {/* Add Entry Modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setETitle(''); setEContent('') }} title="New Entry">
        <div className="p-5 flex flex-col gap-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-muted block mb-2">Type</label>
            <div className="flex gap-2 flex-wrap">
              {entryTypes.map(t => (
                <button
                  key={t.value}
                  onClick={() => setEType(t.value)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    eType === t.value ? 'bg-accent/20 border-accent/40 text-accent-light' : 'border-border text-muted'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Title (optional)" value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="Give this entry a title..." />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-muted">Content</label>
              {eType === 'journal' && (
                <button onClick={usePrompt} className="text-xs text-accent-light hover:underline">💡 Prompt</button>
              )}
            </div>
            <Textarea
              value={eContent}
              onChange={e => setEContent(e.target.value)}
              placeholder={
                eType === 'gratitude' ? 'I\'m grateful for...' :
                eType === 'brain_dump' ? 'Get everything out of your head...' :
                eType === 'idea' ? 'Describe your idea...' :
                eType === 'problem' ? 'What\'s the problem and possible solutions...' :
                'Write your thoughts...'
              }
              rows={8}
            />
          </div>

          <Button onClick={saveEntry} disabled={!eContent.trim() || saving} fullWidth>
            {saving ? 'Saving...' : 'Save Entry'}
          </Button>
        </div>
      </Modal>

      {/* View Entry Modal */}
      <Modal open={!!viewEntry} onClose={() => setViewEntry(null)} title={viewEntry ? getTypeInfo(viewEntry.type).label : ''}>
        {viewEntry && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getTypeInfo(viewEntry.type).emoji}</span>
                <span className="text-xs text-muted">{formatDate(viewEntry.date)}</span>
              </div>
              <button onClick={() => deleteEntry(viewEntry.id)} className="text-muted hover:text-danger transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {viewEntry.title && <h2 className="text-lg font-bold text-white mb-3">{viewEntry.title}</h2>}
            <p className="text-white leading-relaxed whitespace-pre-wrap text-sm">{viewEntry.content}</p>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
