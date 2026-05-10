import { useEffect, useState } from 'react'
import { Plus, Users, Heart, Trash2, Star, Phone } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { today } from '../lib/utils'
import type { Relationship, RelationshipLog } from '../types'

const types = [
  { value: 'family', label: '👨‍👩‍👧 Family' }, { value: 'friend', label: '👫 Friend' },
  { value: 'romantic', label: '❤️ Romantic' }, { value: 'professional', label: '💼 Professional' },
  { value: 'other', label: '✨ Other' },
]

const typeColors: Record<string, 'red' | 'purple' | 'blue' | 'yellow' | 'gray'> = {
  family: 'red', friend: 'purple', romantic: 'red', professional: 'blue', other: 'gray',
}

const contactTypes = [
  { value: 'call', label: '📞 Call' }, { value: 'message', label: '💬 Message' },
  { value: 'meetup', label: '🤝 Met up' }, { value: 'video', label: '📹 Video call' }, { value: 'other', label: '✨ Other' },
]

export function Relationships() {
  const [people, setPeople] = useState<Relationship[]>([])
  const [logs, setLogs] = useState<RelationshipLog[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [logOpen, setLogOpen] = useState<Relationship | null>(null)
  const [loading, setLoading] = useState(true)

  const [rName, setRName] = useState('')
  const [rType, setRType] = useState('friend')
  const [rImportance, setRImportance] = useState(3)
  const [rNotes, setRNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [lType, setLType] = useState('call')
  const [lNotes, setLNotes] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [pRes, lRes] = await Promise.all([
      supabase.from('relationships').select('*').order('importance', { ascending: false }),
      supabase.from('relationship_logs').select('*').order('date', { ascending: false }).limit(50),
    ])
    if (pRes.data) setPeople(pRes.data)
    if (lRes.data) setLogs(lRes.data)
    setLoading(false)
  }

  async function savePerson() {
    setSaving(true)
    const { data } = await supabase.from('relationships').insert({
      name: rName, type: rType, importance: rImportance, notes: rNotes || null,
    }).select().single()
    if (data) setPeople([data, ...people].sort((a, b) => b.importance - a.importance))
    setSaving(false); setAddOpen(false)
    setRName(''); setRNotes(''); setRImportance(3)
  }

  async function logContact(person: Relationship) {
    const t = today()
    const { data } = await supabase.from('relationship_logs').insert({
      relationship_id: person.id, date: t, type: lType, notes: lNotes || null,
    }).select().single()
    if (data) setLogs([data, ...logs])
    // Update last_contact
    await supabase.from('relationships').update({ last_contact: t }).eq('id', person.id)
    setPeople(people.map(p => p.id === person.id ? { ...p, last_contact: t } : p))
    setLogOpen(null); setLNotes('')
  }

  async function deletePerson(id: string) {
    await supabase.from('relationships').delete().eq('id', id)
    setPeople(people.filter(p => p.id !== id))
  }

  function getDaysAgo(date?: string) {
    if (!date) return null
    const days = differenceInDays(new Date(), parseISO(date))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  function getContactUrgency(person: Relationship) {
    if (!person.last_contact) return 'red'
    const days = differenceInDays(new Date(), parseISO(person.last_contact))
    const threshold = person.importance >= 4 ? 7 : person.importance >= 3 ? 14 : 30
    if (days > threshold * 2) return 'red'
    if (days > threshold) return 'yellow'
    return 'green'
  }

  return (
    <Layout title="Relationships">
      <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : people.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-border mx-auto mb-3" />
            <p className="font-bold text-white mb-1">No people tracked</p>
            <p className="text-muted text-sm mb-4">Add the important people in your life to stay connected.</p>
          </div>
        ) : (
          people.map(person => {
            const urgency = getContactUrgency(person)
            const recentLogs = logs.filter(l => l.relationship_id === person.id).slice(0, 2)
            return (
              <Card key={person.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-lg font-bold text-accent-light">
                    {person.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-white">{person.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge color={typeColors[person.type] || 'gray'}>
                            {types.find(t => t.value === person.type)?.label}
                          </Badge>
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < person.importance ? 'text-warning fill-warning' : 'text-border'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deletePerson(person.id)} className="text-muted hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 bg-${urgency === 'red' ? 'danger' : urgency === 'yellow' ? 'warning' : 'success'}`} />
                      <span className="text-xs text-muted">
                        {person.last_contact ? `Last contact: ${getDaysAgo(person.last_contact)}` : 'Never contacted'}
                      </span>
                    </div>

                    {recentLogs.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {recentLogs.map(l => (
                          <p key={l.id} className="text-xs text-muted">
                            {contactTypes.find(c => c.value === l.type)?.label} · {format(parseISO(l.date), 'MMM d')}
                            {l.notes && ` · ${l.notes}`}
                          </p>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setLogOpen(person)}
                      className="mt-3 flex items-center gap-1.5 px-3 py-2 bg-accent/20 text-accent-light rounded-xl text-xs font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5" /> Log Contact
                    </button>
                  </div>
                </div>
              </Card>
            )
          })
        )}

        <Button onClick={() => setAddOpen(true)} fullWidth variant="secondary">
          <Plus className="w-5 h-5 mr-2" /> Add Person
        </Button>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Person">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Name" value={rName} onChange={e => setRName(e.target.value)} placeholder="Their name" autoFocus />
          <Select label="Relationship type" value={rType} onChange={e => setRType(e.target.value)} options={types} />
          <div>
            <label className="text-sm font-medium text-muted block mb-2">Importance (1-5)</label>
            <div className="flex gap-2 justify-center">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRImportance(n)}
                  className={`w-10 h-10 rounded-xl border text-sm font-bold transition-colors ${
                    n <= rImportance ? 'bg-warning/20 border-warning/40 text-warning' : 'border-border text-muted'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>
          <Textarea label="Notes (optional)" value={rNotes} onChange={e => setRNotes(e.target.value)} placeholder="How do you know them? What's important to remember?" rows={3} />
          <Button onClick={savePerson} disabled={!rName.trim() || saving} fullWidth>Add Person</Button>
        </div>
      </Modal>

      <Modal open={!!logOpen} onClose={() => { setLogOpen(null); setLNotes('') }} title={`Log Contact — ${logOpen?.name}`}>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-muted block mb-2">Type of contact</label>
            <div className="grid grid-cols-3 gap-2">
              {contactTypes.map(t => (
                <button key={t.value} onClick={() => setLType(t.value)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    lType === t.value ? 'bg-accent/20 border-accent/40 text-accent-light' : 'border-border text-muted'
                  }`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <Textarea label="Notes (optional)" value={lNotes} onChange={e => setLNotes(e.target.value)} placeholder="How was it?" rows={3} />
          <Button onClick={() => logOpen && logContact(logOpen)} fullWidth>Log Contact</Button>
        </div>
      </Modal>
    </Layout>
  )
}
