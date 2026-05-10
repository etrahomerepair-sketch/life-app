import { useState } from 'react'
import { ChevronRight, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'

interface OnboardingProps {
  onComplete: () => void
}

const steps = ['welcome', 'name', 'values', 'struggles', 'ideal'] as const
type Step = typeof steps[number]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [values, setValues] = useState<string[]>([])
  const [newValue, setNewValue] = useState('')
  const [struggles, setStruggles] = useState<string[]>([])
  const [newStruggle, setNewStruggle] = useState('')
  const [idealSelf, setIdealSelf] = useState('')
  const [saving, setSaving] = useState(false)

  function next() {
    const idx = steps.indexOf(step)
    if (idx < steps.length - 1) setStep(steps[idx + 1])
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

  async function finish() {
    setSaving(true)
    await supabase.from('profile').upsert({
      id: 1,
      name: name || 'You',
      age: age ? parseInt(age) : null,
      values,
      struggles,
      ideal_self: idealSelf,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    onComplete()
  }

  const progressIdx = steps.indexOf(step)

  return (
    <div className="flex flex-col h-full bg-bg safe-top safe-bottom">
      {/* Progress */}
      {step !== 'welcome' && (
        <div className="flex gap-1.5 px-5 pt-5">
          {steps.slice(1).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                i < progressIdx ? 'bg-accent' : i === progressIdx - 1 ? 'bg-accent' : 'bg-border'
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex-1 scroll-area px-6 py-8">
        {step === 'welcome' && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-accent/20 border border-accent/30 flex items-center justify-center">
              <span className="text-4xl font-black text-accent-light">L</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white mb-3">Welcome to Life</h1>
              <p className="text-muted text-base leading-relaxed max-w-xs mx-auto">
                Your personal AI life coach. Track everything, understand your patterns, become your ideal self.
              </p>
            </div>
            <Button onClick={next} size="lg" className="w-full max-w-xs">
              Get Started <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}

        {step === 'name' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">What's your name?</h2>
              <p className="text-muted">Let's personalise your experience.</p>
            </div>
            <Input
              label="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
            <Input
              label="Age (optional)"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="Your age"
              type="number"
              inputMode="numeric"
            />
            <Button onClick={next} disabled={!name.trim()} fullWidth>
              Continue <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}

        {step === 'values' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Your core values</h2>
              <p className="text-muted">What matters most to you? (health, family, growth, etc.)</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="Add a value..."
                onKeyDown={e => e.key === 'Enter' && addValue()}
                className="flex-1"
              />
              <button onClick={addValue} className="p-3 bg-accent rounded-xl flex-shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {values.map(v => (
                <span key={v} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 text-accent-light rounded-xl text-sm font-medium">
                  {v}
                  <button onClick={() => setValues(values.filter(x => x !== v))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            {values.length === 0 && (
              <p className="text-muted/50 text-sm text-center py-4">No values added yet</p>
            )}
            <Button onClick={next} fullWidth variant={values.length === 0 ? 'secondary' : 'primary'}>
              {values.length === 0 ? 'Skip for now' : 'Continue'} <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}

        {step === 'struggles' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">What are you struggling with?</h2>
              <p className="text-muted">Be honest — this helps your AI coach give better advice.</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={newStruggle}
                onChange={e => setNewStruggle(e.target.value)}
                placeholder="Add a struggle..."
                onKeyDown={e => e.key === 'Enter' && addStruggle()}
                className="flex-1"
              />
              <button onClick={addStruggle} className="p-3 bg-accent rounded-xl flex-shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {struggles.map(s => (
                <span key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/20 text-danger rounded-xl text-sm font-medium">
                  {s}
                  <button onClick={() => setStruggles(struggles.filter(x => x !== s))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <Button onClick={next} fullWidth variant={struggles.length === 0 ? 'secondary' : 'primary'}>
              {struggles.length === 0 ? 'Skip for now' : 'Continue'} <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}

        {step === 'ideal' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Describe your ideal self</h2>
              <p className="text-muted">Who do you want to become? What does your best life look like?</p>
            </div>
            <Textarea
              value={idealSelf}
              onChange={e => setIdealSelf(e.target.value)}
              placeholder="I want to be someone who..."
              rows={6}
            />
            <Button onClick={finish} disabled={saving} fullWidth>
              {saving ? 'Setting up...' : "Let's go! 🚀"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
