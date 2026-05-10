import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { authStore } from './store/authStore'
import { supabase } from './lib/supabase'
import { Auth } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Goals } from './pages/Goals'
import { Habits } from './pages/Habits'
import { Health } from './pages/Health'
import { Money } from './pages/Money'
import { Journal } from './pages/Journal'
import { Routines } from './pages/Routines'
import { Learning } from './pages/Learning'
import { Relationships } from './pages/Relationships'
import { AICoach } from './pages/AICoach'
import { Profile } from './pages/Profile'

type AppState = 'loading' | 'auth' | 'onboarding' | 'app'

export default function App() {
  const [state, setState] = useState<AppState>('loading')

  useEffect(() => { init() }, [])

  async function init() {
    if (!authStore.isPinSet()) {
      setState('auth')
      return
    }
    if (!authStore.isSessionValid()) {
      setState('auth')
      return
    }
    // Check if profile exists
    const { data } = await supabase.from('profile').select('id').eq('id', 1).single()
    if (!data) {
      setState('onboarding')
    } else {
      setState('app')
    }
  }

  async function onAuthSuccess() {
    const { data } = await supabase.from('profile').select('id').eq('id', 1).single()
    if (!data) {
      setState('onboarding')
    } else {
      setState('app')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state === 'auth') {
    return <Auth onSuccess={onAuthSuccess} />
  }

  if (state === 'onboarding') {
    return <Onboarding onComplete={() => setState('app')} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/health" element={<Health />} />
        <Route path="/money" element={<Money />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/relationships" element={<Relationships />} />
        <Route path="/coach" element={<AICoach />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  )
}
