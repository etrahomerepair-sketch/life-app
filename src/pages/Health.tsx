import { useEffect, useState } from 'react'
import { Plus, Droplets, Moon, Dumbbell, Trash2, Scale } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { ProgressBar } from '../components/ui/Progress'
import { today, getMoodEmoji, formatDate } from '../lib/utils'
import type { DailyCheckin, Meal, WaterLog, SleepLog, ExerciseLog } from '../types'

const tabs = ['checkin', 'meals', 'water', 'sleep', 'exercise'] as const
type Tab = typeof tabs[number]

const mealTypes = [
  { value: 'breakfast', label: '🌅 Breakfast' }, { value: 'lunch', label: '☀️ Lunch' },
  { value: 'dinner', label: '🌙 Dinner' }, { value: 'snack', label: '🍎 Snack' },
]
const intensities = [
  { value: 'low', label: '🟢 Low' }, { value: 'medium', label: '🟡 Medium' }, { value: 'high', label: '🔴 High' },
]

export function Health() {
  const [tab, setTab] = useState<Tab>('checkin')
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [water, setWater] = useState<WaterLog[]>([])
  const [sleep, setSleep] = useState<SleepLog | null>(null)
  const [exercises, setExercises] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)

  // Checkin form
  const [mood, setMood] = useState(7)
  const [energy, setEnergy] = useState(7)
  const [stress, setStress] = useState(4)
  const [checkinNotes, setCheckinNotes] = useState('')

  // Meal form
  const [mealOpen, setMealOpen] = useState(false)
  const [mealType, setMealType] = useState('breakfast')
  const [mealDesc, setMealDesc] = useState('')
  const [mealCal, setMealCal] = useState('')
  const [mealProtein, setMealProtein] = useState('')
  const [mealCarbs, setMealCarbs] = useState('')
  const [mealFats, setMealFats] = useState('')

  // Water
  const WATER_GOAL = 2500

  // Sleep form
  const [sleepOpen, setSleepOpen] = useState(false)
  const [bedtime, setBedtime] = useState('22:30')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [sleepQuality, setSleepQuality] = useState(7)
  const [sleepNotes, setSleepNotes] = useState('')

  // Exercise form
  const [exOpen, setExOpen] = useState(false)
  const [exType, setExType] = useState('')
  const [exDuration, setExDuration] = useState('')
  const [exIntensity, setExIntensity] = useState('medium')
  const [exNotes, setExNotes] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const t = today()
    const [ciRes, mealsRes, waterRes, sleepRes, exRes] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('date', t).single(),
      supabase.from('meals').select('*').eq('date', t).order('created_at', { ascending: false }),
      supabase.from('water_logs').select('*').eq('date', t).order('logged_at', { ascending: false }),
      supabase.from('sleep_logs').select('*').eq('date', t).single(),
      supabase.from('exercise_logs').select('*').eq('date', t).order('created_at', { ascending: false }),
    ])
    if (ciRes.data) { setCheckin(ciRes.data); setMood(ciRes.data.mood); setEnergy(ciRes.data.energy); setStress(ciRes.data.stress); setCheckinNotes(ciRes.data.notes || '') }
    if (mealsRes.data) setMeals(mealsRes.data)
    if (waterRes.data) setWater(waterRes.data)
    if (sleepRes.data) { setSleep(sleepRes.data); setBedtime(sleepRes.data.bedtime); setWakeTime(sleepRes.data.wake_time); setSleepQuality(sleepRes.data.quality); setSleepNotes(sleepRes.data.notes || '') }
    if (exRes.data) setExercises(exRes.data)
    setLoading(false)
  }

  async function saveCheckin() {
    setSaving(true)
    const t = today()
    const payload = { date: t, mood, energy, stress, notes: checkinNotes }
    if (checkin) {
      const { data } = await supabase.from('daily_checkins').update(payload).eq('id', checkin.id).select().single()
      if (data) setCheckin(data)
    } else {
      const { data } = await supabase.from('daily_checkins').insert(payload).select().single()
      if (data) setCheckin(data)
    }
    setSaving(false)
  }

  async function addMeal() {
    setSaving(true)
    const { data } = await supabase.from('meals').insert({
      date: today(), meal_type: mealType, description: mealDesc,
      calories: mealCal ? parseInt(mealCal) : null,
      protein: mealProtein ? parseFloat(mealProtein) : null,
      carbs: mealCarbs ? parseFloat(mealCarbs) : null,
      fats: mealFats ? parseFloat(mealFats) : null,
    }).select().single()
    if (data) setMeals([data, ...meals])
    setSaving(false)
    setMealOpen(false)
    setMealDesc(''); setMealCal(''); setMealProtein(''); setMealCarbs(''); setMealFats('')
  }

  async function addWater(amount: number) {
    const { data } = await supabase.from('water_logs').insert({ date: today(), amount }).select().single()
    if (data) setWater([data, ...water])
  }

  async function saveSleep() {
    setSaving(true)
    const payload = { date: today(), bedtime, wake_time: wakeTime, quality: sleepQuality, notes: sleepNotes }
    if (sleep) {
      const { data } = await supabase.from('sleep_logs').update(payload).eq('id', sleep.id).select().single()
      if (data) setSleep(data)
    } else {
      const { data } = await supabase.from('sleep_logs').insert(payload).select().single()
      if (data) setSleep(data)
    }
    setSaving(false)
    setSleepOpen(false)
  }

  async function addExercise() {
    setSaving(true)
    const { data } = await supabase.from('exercise_logs').insert({
      date: today(), type: exType, duration: parseInt(exDuration), intensity: exIntensity, notes: exNotes,
    }).select().single()
    if (data) setExercises([data, ...exercises])
    setSaving(false)
    setExOpen(false)
    setExType(''); setExDuration(''); setExNotes('')
  }

  async function deleteItem(table: string, id: string, setter: any, list: any[]) {
    await supabase.from(table).delete().eq('id', id)
    setter(list.filter((i: any) => i.id !== id))
  }

  const totalWater = water.reduce((s, w) => s + w.amount, 0)
  const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0)

  function getSleepHours() {
    if (!sleep) return null
    const [bh, bm] = sleep.bedtime.split(':').map(Number)
    const [wh, wm] = sleep.wake_time.split(':').map(Number)
    let diff = (wh * 60 + wm) - (bh * 60 + bm)
    if (diff < 0) diff += 24 * 60
    return (diff / 60).toFixed(1)
  }

  const tabLabels: Record<Tab, string> = { checkin: '😊', meals: '🍽️', water: '💧', sleep: '🌙', exercise: '💪' }

  return (
    <Layout title="Health">
      {/* Tab bar */}
      <div className="flex mx-4 mt-4 gap-1 p-1 bg-bg-card border border-border rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-accent text-white' : 'text-muted'}`}
          >
            {tabLabels[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* CHECK IN */}
            {tab === 'checkin' && (
              <div className="flex flex-col gap-4">
                <Card className="p-4">
                  <h3 className="font-bold text-white mb-4">How are you feeling today?</h3>
                  <SliderRow label="Mood" emoji={getMoodEmoji(mood)} value={mood} onChange={setMood} />
                  <SliderRow label="Energy" emoji={energy >= 7 ? '⚡' : energy >= 4 ? '🔋' : '😴'} value={energy} onChange={setEnergy} />
                  <SliderRow label="Stress" emoji={stress >= 7 ? '😰' : stress >= 4 ? '😬' : '😌'} value={stress} onChange={setStress} invert />
                  <Textarea value={checkinNotes} onChange={e => setCheckinNotes(e.target.value)} placeholder="Any notes for today?" rows={2} />
                  <Button onClick={saveCheckin} disabled={saving} fullWidth className="mt-3">
                    {checkin ? 'Update Check-in' : 'Save Check-in'}
                  </Button>
                  {checkin && (
                    <p className="text-center text-xs text-success mt-2">✓ Logged today</p>
                  )}
                </Card>
              </div>
            )}

            {/* MEALS */}
            {tab === 'meals' && (
              <div className="flex flex-col gap-3">
                {totalCal > 0 && (
                  <Card className="p-4 flex items-center gap-3">
                    <div className="text-2xl">🔥</div>
                    <div>
                      <p className="text-2xl font-black text-white">{totalCal} <span className="text-sm text-muted font-normal">kcal</span></p>
                      <p className="text-xs text-muted">consumed today</p>
                    </div>
                  </Card>
                )}
                {meals.map(m => (
                  <Card key={m.id} className="p-4 flex items-start gap-3">
                    <span className="text-xl">{mealTypes.find(t => t.value === m.meal_type)?.label.split(' ')[0]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{m.description}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted">
                        {m.calories && <span>🔥 {m.calories} kcal</span>}
                        {m.protein && <span>💪 {m.protein}g protein</span>}
                        {m.carbs && <span>🌾 {m.carbs}g carbs</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteItem('meals', m.id, setMeals, meals)} className="text-muted hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Card>
                ))}
                <Button onClick={() => setMealOpen(true)} fullWidth variant="secondary">
                  <Plus className="w-5 h-5 mr-2" /> Log Meal
                </Button>
              </div>
            )}

            {/* WATER */}
            {tab === 'water' && (
              <div className="flex flex-col gap-4">
                <Card className="p-6 flex flex-col items-center gap-3">
                  <Droplets className="w-10 h-10 text-info" />
                  <div className="text-center">
                    <p className="text-3xl font-black text-white">{(totalWater / 1000).toFixed(2)}L</p>
                    <p className="text-muted text-sm">of {(WATER_GOAL / 1000).toFixed(1)}L goal</p>
                  </div>
                  <ProgressBar value={totalWater} max={WATER_GOAL} color="bg-info" className="w-full" height="h-3" />
                </Card>
                <div className="grid grid-cols-3 gap-3">
                  {[150, 250, 350, 500, 750, 1000].map(ml => (
                    <button key={ml} onClick={() => addWater(ml)}
                      className="py-3 bg-bg-card border border-border rounded-xl text-sm font-semibold text-white hover:border-info/40 hover:bg-info/10 transition-colors"
                    >
                      +{ml}ml
                    </button>
                  ))}
                </div>
                {water.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {water.map(w => (
                      <div key={w.id} className="flex items-center justify-between px-4 py-2 bg-bg-card rounded-xl border border-border">
                        <span className="text-sm text-white">💧 {w.amount}ml</span>
                        <button onClick={() => deleteItem('water_logs', w.id, setWater, water)} className="text-muted hover:text-danger">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SLEEP */}
            {tab === 'sleep' && (
              <div className="flex flex-col gap-4">
                {sleep ? (
                  <Card className="p-5 text-center">
                    <Moon className="w-10 h-10 text-accent-light mx-auto mb-2" />
                    <p className="text-3xl font-black text-white mb-1">{getSleepHours()}h</p>
                    <p className="text-muted text-sm mb-1">{sleep.bedtime} → {sleep.wake_time}</p>
                    <p className="text-sm text-muted">Quality: <span className="text-white font-semibold">{sleep.quality}/10</span></p>
                    <button onClick={() => setSleepOpen(true)} className="mt-3 text-sm text-accent-light">Edit</button>
                  </Card>
                ) : (
                  <Card className="p-6 text-center">
                    <Moon className="w-10 h-10 text-border mx-auto mb-3" />
                    <p className="text-muted mb-4">No sleep logged today</p>
                  </Card>
                )}
                <Button onClick={() => setSleepOpen(true)} fullWidth variant={sleep ? 'secondary' : 'primary'}>
                  <Moon className="w-5 h-5 mr-2" /> {sleep ? 'Edit Sleep' : 'Log Sleep'}
                </Button>
              </div>
            )}

            {/* EXERCISE */}
            {tab === 'exercise' && (
              <div className="flex flex-col gap-3">
                {exercises.length === 0 && (
                  <Card className="p-6 text-center">
                    <Dumbbell className="w-10 h-10 text-border mx-auto mb-3" />
                    <p className="text-muted">No exercise logged today</p>
                  </Card>
                )}
                {exercises.map(ex => (
                  <Card key={ex.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Dumbbell className="w-5 h-5 text-accent-light" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">{ex.type}</p>
                      <p className="text-xs text-muted">{ex.duration} min · {ex.intensity} intensity</p>
                    </div>
                    <button onClick={() => deleteItem('exercise_logs', ex.id, setExercises, exercises)} className="text-muted hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Card>
                ))}
                <Button onClick={() => setExOpen(true)} fullWidth variant="secondary">
                  <Plus className="w-5 h-5 mr-2" /> Log Exercise
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Meal Modal */}
      <Modal open={mealOpen} onClose={() => setMealOpen(false)} title="Log Meal">
        <div className="p-5 flex flex-col gap-4">
          <Select label="Meal type" value={mealType} onChange={e => setMealType(e.target.value)} options={mealTypes} />
          <Input label="What did you eat?" value={mealDesc} onChange={e => setMealDesc(e.target.value)} placeholder="e.g. Chicken salad with avocado" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Calories" value={mealCal} onChange={e => setMealCal(e.target.value)} type="number" inputMode="numeric" placeholder="kcal" />
            <Input label="Protein (g)" value={mealProtein} onChange={e => setMealProtein(e.target.value)} type="number" inputMode="decimal" placeholder="g" />
            <Input label="Carbs (g)" value={mealCarbs} onChange={e => setMealCarbs(e.target.value)} type="number" inputMode="decimal" placeholder="g" />
            <Input label="Fats (g)" value={mealFats} onChange={e => setMealFats(e.target.value)} type="number" inputMode="decimal" placeholder="g" />
          </div>
          <Button onClick={addMeal} disabled={!mealDesc.trim() || saving} fullWidth>Save Meal</Button>
        </div>
      </Modal>

      {/* Sleep Modal */}
      <Modal open={sleepOpen} onClose={() => setSleepOpen(false)} title="Log Sleep">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Bedtime" value={bedtime} onChange={e => setBedtime(e.target.value)} type="time" />
          <Input label="Wake time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} type="time" />
          <SliderRow label="Sleep quality" emoji={sleepQuality >= 7 ? '😴' : sleepQuality >= 4 ? '🥱' : '😣'} value={sleepQuality} onChange={setSleepQuality} />
          <Textarea label="Notes" value={sleepNotes} onChange={e => setSleepNotes(e.target.value)} placeholder="How did you sleep?" rows={2} />
          <Button onClick={saveSleep} disabled={saving} fullWidth>Save Sleep</Button>
        </div>
      </Modal>

      {/* Exercise Modal */}
      <Modal open={exOpen} onClose={() => setExOpen(false)} title="Log Exercise">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Exercise type" value={exType} onChange={e => setExType(e.target.value)} placeholder="e.g. Running, Gym, Yoga" autoFocus />
          <Input label="Duration (minutes)" value={exDuration} onChange={e => setExDuration(e.target.value)} type="number" inputMode="numeric" placeholder="30" />
          <Select label="Intensity" value={exIntensity} onChange={e => setExIntensity(e.target.value)} options={intensities} />
          <Textarea label="Notes" value={exNotes} onChange={e => setExNotes(e.target.value)} placeholder="How was it?" rows={2} />
          <Button onClick={addExercise} disabled={!exType.trim() || !exDuration || saving} fullWidth>Save Exercise</Button>
        </div>
      </Modal>
    </Layout>
  )
}

function SliderRow({ label, emoji, value, onChange, invert }: { label: string; emoji: string; value: number; onChange: (v: number) => void; invert?: boolean }) {
  const color = invert
    ? value <= 3 ? 'text-success' : value <= 6 ? 'text-warning' : 'text-danger'
    : value >= 7 ? 'text-success' : value >= 4 ? 'text-warning' : 'text-danger'
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className={`text-sm font-bold ${color}`}>{emoji} {value}/10</span>
      </div>
      <input type="range" min="1" max="10" value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full" />
    </div>
  )
}
