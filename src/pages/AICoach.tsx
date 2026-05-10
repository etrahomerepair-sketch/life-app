import { useEffect, useRef, useState } from 'react'
import { Send, Bot, User, Sparkles, RefreshCw, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { today } from '../lib/utils'
import type { ChatMessage } from '../types'

const STORAGE_KEY = 'life_app_chat'

const starterPrompts = [
  'What should I focus on improving this week?',
  'Analyze my mood and energy patterns',
  'Am I on track with my goals?',
  'What bad habits should I tackle first?',
  'Give me a weekly plan based on my data',
]

export function AICoach() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [context, setContext] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { buildContext() }, [])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  async function buildContext() {
    const t = today()
    const [profileRes, goalsRes, habitsRes, checkinRes, recentExpenses, recentIncome, sleepRes, exerciseRes] = await Promise.all([
      supabase.from('profile').select('*').eq('id', 1).single(),
      supabase.from('goals').select('*').eq('status', 'active').limit(10),
      supabase.from('habits').select('*').eq('active', true).limit(20),
      supabase.from('daily_checkins').select('*').order('date', { ascending: false }).limit(7),
      supabase.from('expenses').select('*').order('date', { ascending: false }).limit(20),
      supabase.from('income').select('*').order('date', { ascending: false }).limit(10),
      supabase.from('sleep_logs').select('*').order('date', { ascending: false }).limit(7),
      supabase.from('exercise_logs').select('*').order('date', { ascending: false }).limit(7),
    ])

    if (profileRes.data) setProfile(profileRes.data)

    const p = profileRes.data
    const contextStr = `
You are a personal AI life coach. You know everything about this person and your job is to give specific, actionable, honest advice to help them become their ideal self.

USER PROFILE:
- Name: ${p?.name || 'Unknown'}
- Age: ${p?.age || 'Not specified'}
- Core values: ${(p?.values || []).join(', ') || 'Not specified'}
- Current struggles: ${(p?.struggles || []).join(', ') || 'Not specified'}
- Ideal self: ${p?.ideal_self || 'Not specified'}

ACTIVE GOALS (${goalsRes.data?.length || 0}):
${goalsRes.data?.map(g => `- ${g.title} (${g.progress}% complete, category: ${g.category})`).join('\n') || 'No active goals'}

HABITS (${habitsRes.data?.length || 0}):
${habitsRes.data?.map(h => `- ${h.title} (${h.type}, streak: ${h.streak} days)`).join('\n') || 'No habits tracked'}

RECENT MOOD/ENERGY (last 7 days):
${checkinRes.data?.map(c => `- ${c.date}: mood ${c.mood}/10, energy ${c.energy}/10, stress ${c.stress}/10`).join('\n') || 'No check-ins'}

RECENT SLEEP (last 7 days):
${sleepRes.data?.map(s => `- ${s.date}: ${s.bedtime}–${s.wake_time}, quality ${s.quality}/10`).join('\n') || 'No sleep data'}

RECENT EXERCISE:
${exerciseRes.data?.map(e => `- ${e.date}: ${e.type}, ${e.duration} min, ${e.intensity} intensity`).join('\n') || 'No exercise data'}

RECENT EXPENSES:
${recentExpenses.data?.map(e => `- $${e.amount} on ${e.category} (${e.description})`).join('\n') || 'No expense data'}

RECENT INCOME:
${recentIncome.data?.map(i => `- $${i.amount} from ${i.category} (${i.description})`).join('\n') || 'No income data'}

Today's date: ${t}

Give specific, direct advice. Reference their actual data. Don't be generic. Be honest even if it's hard to hear. Give actionable steps.
`.trim()

    setContext(contextStr)
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/.netlify/functions/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          systemContext: context,
        }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages([...newMessages, { role: 'assistant', content: data.message }])
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble connecting. Make sure the ANTHROPIC_API_KEY is set in your Netlify environment variables.' }])
    }
    setLoading(false)
  }

  async function generateWeeklyReport() {
    const prompt = `Generate a comprehensive weekly life report for me. Include:
1. Overall assessment of this week based on my data
2. What's going well (specific things from my data)
3. What needs immediate attention (biggest risks or gaps)
4. Top 3 specific actions for next week
5. One honest, direct observation about a pattern you notice

Be specific, reference my actual numbers, and don't sugarcoat things.`
    await sendMessage(prompt)
  }

  function clearChat() {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <Layout title="AI Coach">
      <div className="flex flex-col h-full">
        {/* Header actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <button onClick={generateWeeklyReport} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent/20 text-accent-light rounded-xl text-xs font-semibold hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" /> Weekly Report
          </button>
          <button onClick={clearChat} className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scroll-area px-4 py-4 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                <Bot className="w-8 h-8 text-accent-light" />
              </div>
              <div className="text-center">
                <h2 className="font-bold text-white text-lg mb-1">Your AI Life Coach</h2>
                <p className="text-muted text-sm max-w-xs">
                  I know your goals, habits, health, finances, and more. Ask me anything about your life.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                {starterPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="px-4 py-3 bg-bg-card border border-border rounded-xl text-sm text-left text-muted hover:text-white hover:border-accent/40 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' ? 'bg-accent/30' : 'bg-bg-elevated border border-border'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-accent-light" /> : <Bot className="w-4 h-4 text-muted" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-tr-md'
                  : 'bg-bg-card border border-border text-white rounded-tl-md'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-muted" />
              </div>
              <div className="bg-bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 safe-bottom bg-bg-card">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Ask your coach anything..."
              rows={1}
              className="flex-1 bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent resize-none transition-colors"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
