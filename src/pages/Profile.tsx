import { useEffect, useState } from 'react'
import { Plus, X, Lock, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { authStore } from '../store/authStore'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import type { Profile } from '../types'

export function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [values, setValues] = useState<string[]>([])
  const [struggles, setStruggles] = useState<string[]>([])
  const [idealSelf, setIdealSelf] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newStruggle, setNewStruggle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // PIN change
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('profile').select('*').eq('id', 1).single()
    if (data) {
      setProfile(data)
      setName(data.name || '')
      setAge(data.age?.toString() || '')
      setValues(data.values || [])
      setStruggles(data.struggles || [])
      setIdealSelf(data.ideal_self || '')
    }
  }

  async function save() {
    setSaving(true)
    const payload = { id: 1, name, age: age ? parseInt(age) : null, values, struggles, ideal_self: idealSelf, updated_at: new Date().toISOString() }
    await supabase.from('profile').upsert(payload)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function changePin() {
    setPinError('')
    const ok = await authStore.verifyPin(oldPin)
    if (!ok) { setPinError('Current PIN is incorrect'); return }
    if (newPin.length !== 4) { setPinError('New PIN must be 4 digits'); return }
    if (newPin !== confirmNewPin) { setPinError('PINs don\'t match'); return }
    await authStore.setPin(newPin)
    setChangePinOpen(false)
    setOldPin(''); setNewPin(''); setConfirmNewPin(''); setPinError('')
  }

  function addValue() {
    if (newValue.trim() && !values.includes(newValue.trim())) {
      setValues([...values, newValue.trim()])
      setNewValue('')
    }
  }

  function addStruggle() {
    if (newStruggle.trim() && !struggles.includes(newStruggle.trim())) {
      setStruggles([...struggles, newStruggle.trim()])
      setNewStruggle('')
    }
  }

  return (
    <Layout title="Profile & Settings">
      <div className="px-4 pt-4 pb-6 flex flex-col gap-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-3xl font-black text-accent-light">
            {name ? name[0].toUpperCase() : '?'}
          </div>
          <div className="text-center">
            <p className="font-bold text-white text-lg">{name || 'Set your name'}</p>
            {age && <p className="text-muted text-sm">{age} years old</p>}
          </div>
        </div>

        {/* Basic Info */}
        <Card className="p-4 flex flex-col gap-4">
          <h3 className="font-bold text-white">Basic Info</h3>
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          <Input label="Age" value={age} onChange={e => setAge(e.target.value)} type="number" inputMode="numeric" placeholder="Your age" />
        </Card>

        {/* Values */}
        <Card className="p-4 flex flex-col gap-3">
          <h3 className="font-bold text-white">Core Values</h3>
          <p className="text-muted text-xs">What matters most to you in life?</p>
          <div className="flex gap-2">
            <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Add a value..." onKeyDown={e => e.key === 'Enter' && addValue()} className="flex-1" />
            <button onClick={addValue} className="px-3 py-2 bg-accent rounded-xl text-white text-sm font-medium flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {values.map(v => (
              <span key={v} className="flex items-center gap-1 px-3 py-1.5 bg-accent/20 text-accent-light rounded-xl text-sm">
                {v}
                <button onClick={() => setValues(values.filter(x => x !== v))} className="ml-1"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {values.length === 0 && <p className="text-muted/50 text-xs">No values yet</p>}
          </div>
        </Card>

        {/* Struggles */}
        <Card className="p-4 flex flex-col gap-3">
          <h3 className="font-bold text-white">Current Struggles</h3>
          <p className="text-muted text-xs">What are you actively working on or struggling with?</p>
          <div className="flex gap-2">
            <Input value={newStruggle} onChange={e => setNewStruggle(e.target.value)} placeholder="Add a struggle..." onKeyDown={e => e.key === 'Enter' && addStruggle()} className="flex-1" />
            <button onClick={addStruggle} className="px-3 py-2 bg-accent rounded-xl text-white text-sm font-medium flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {struggles.map(s => (
              <span key={s} className="flex items-center gap-1 px-3 py-1.5 bg-danger/20 text-danger rounded-xl text-sm">
                {s}
                <button onClick={() => setStruggles(struggles.filter(x => x !== s))}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {struggles.length === 0 && <p className="text-muted/50 text-xs">No struggles listed</p>}
          </div>
        </Card>

        {/* Ideal Self */}
        <Card className="p-4 flex flex-col gap-3">
          <h3 className="font-bold text-white">Your Ideal Self</h3>
          <p className="text-muted text-xs">Describe the person you want to become.</p>
          <Textarea value={idealSelf} onChange={e => setIdealSelf(e.target.value)} placeholder="I want to be someone who..." rows={5} />
        </Card>

        <Button onClick={save} disabled={saving} fullWidth>
          {saved ? '✓ Saved!' : saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
        </Button>

        {/* Security */}
        <Card className="p-4">
          <h3 className="font-bold text-white mb-3">Security</h3>
          <Button onClick={() => setChangePinOpen(true)} variant="secondary" fullWidth>
            <Lock className="w-4 h-4 mr-2" /> Change PIN
          </Button>
        </Card>

        {/* Danger Zone */}
        <Card className="p-4 border-danger/20">
          <h3 className="font-bold text-danger mb-3">Danger Zone</h3>
          <button
            onClick={() => { if (confirm('Lock app? You\'ll need to re-enter your PIN.')) { authStore.clearSession(); window.location.reload() } }}
            className="w-full py-3 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/10 transition-colors"
          >
            Lock App
          </button>
        </Card>
      </div>

      {/* Change PIN Modal */}
      {changePinOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end" onClick={() => setChangePinOpen(false)}>
          <div className="w-full bg-bg-card border border-border rounded-t-3xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Change PIN</h2>
            <div className="flex flex-col gap-3">
              <Input label="Current PIN" value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" placeholder="••••" />
              <Input label="New PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" placeholder="••••" />
              <Input label="Confirm new PIN" value={confirmNewPin} onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" placeholder="••••" />
              {pinError && <p className="text-danger text-sm">{pinError}</p>}
              <Button onClick={changePin} fullWidth>Update PIN</Button>
              <Button onClick={() => setChangePinOpen(false)} variant="ghost" fullWidth>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
