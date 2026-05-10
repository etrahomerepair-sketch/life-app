import { useEffect, useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Trash2, PiggyBank, DollarSign } from 'lucide-react'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { ProgressBar } from '../components/ui/Progress'
import { formatCurrency, today } from '../lib/utils'
import type { IncomeEntry, ExpenseEntry, SavingsGoal } from '../types'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const expenseCategories = [
  { value: 'food', label: '🍔 Food & Dining' }, { value: 'transport', label: '🚗 Transport' },
  { value: 'shopping', label: '🛍️ Shopping' }, { value: 'entertainment', label: '🎬 Entertainment' },
  { value: 'health', label: '🏥 Health' }, { value: 'bills', label: '⚡ Bills & Utilities' },
  { value: 'housing', label: '🏠 Housing' }, { value: 'education', label: '📚 Education' },
  { value: 'savings', label: '🐷 Savings' }, { value: 'other', label: '💸 Other' },
]

const incomeCategories = [
  { value: 'salary', label: '💼 Salary' }, { value: 'freelance', label: '💻 Freelance' },
  { value: 'business', label: '🏢 Business' }, { value: 'investment', label: '📈 Investment' },
  { value: 'gift', label: '🎁 Gift' }, { value: 'other', label: '💰 Other' },
]

type Tab = 'overview' | 'income' | 'expenses' | 'savings'

export function Money() {
  const [tab, setTab] = useState<Tab>('overview')
  const [income, setIncome] = useState<IncomeEntry[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)

  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [savingsOpen, setSavingsOpen] = useState(false)

  // Income form
  const [iAmount, setIAmount] = useState('')
  const [iCategory, setICategory] = useState('salary')
  const [iDesc, setIDesc] = useState('')
  const [iDate, setIDate] = useState(today())

  // Expense form
  const [eAmount, setEAmount] = useState('')
  const [eCategory, setECategory] = useState('food')
  const [eDesc, setEDesc] = useState('')
  const [eDate, setEDate] = useState(today())

  // Savings form
  const [sTitle, setSTitle] = useState('')
  const [sTarget, setSTarget] = useState('')
  const [sCurrent, setSCurrent] = useState('')
  const [sDate, setSDate] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const [iRes, eRes, sRes] = await Promise.all([
      supabase.from('income').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('expenses').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: false }),
    ])
    if (iRes.data) setIncome(iRes.data)
    if (eRes.data) setExpenses(eRes.data)
    if (sRes.data) setSavingsGoals(sRes.data)
    setLoading(false)
  }

  async function addIncome() {
    setSaving(true)
    const { data } = await supabase.from('income').insert({ date: iDate, amount: parseFloat(iAmount), category: iCategory, description: iDesc, recurring: false }).select().single()
    if (data) setIncome([data, ...income])
    setSaving(false); setIncomeOpen(false); setIAmount(''); setIDesc('')
  }

  async function addExpense() {
    setSaving(true)
    const { data } = await supabase.from('expenses').insert({ date: eDate, amount: parseFloat(eAmount), category: eCategory, description: eDesc, recurring: false }).select().single()
    if (data) setExpenses([data, ...expenses])
    setSaving(false); setExpenseOpen(false); setEAmount(''); setEDesc('')
  }

  async function addSavingsGoal() {
    setSaving(true)
    const { data } = await supabase.from('savings_goals').insert({ title: sTitle, target_amount: parseFloat(sTarget), current_amount: parseFloat(sCurrent) || 0, target_date: sDate || null }).select().single()
    if (data) setSavingsGoals([data, ...savingsGoals])
    setSaving(false); setSavingsOpen(false); setSTitle(''); setSTarget(''); setSCurrent(''); setSDate('')
  }

  async function updateSavings(goal: SavingsGoal, amount: number) {
    const newAmount = Math.max(0, goal.current_amount + amount)
    await supabase.from('savings_goals').update({ current_amount: newAmount }).eq('id', goal.id)
    setSavingsGoals(savingsGoals.map(g => g.id === goal.id ? { ...g, current_amount: newAmount } : g))
  }

  async function deleteIncome(id: string) {
    await supabase.from('income').delete().eq('id', id)
    setIncome(income.filter(i => i.id !== id))
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(expenses.filter(e => e.id !== id))
  }

  async function deleteSavingsGoal(id: string) {
    await supabase.from('savings_goals').delete().eq('id', id)
    setSavingsGoals(savingsGoals.filter(g => g.id !== id))
  }

  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const net = totalIncome - totalExpenses

  // Group expenses by category for chart
  const expenseByCategory = expenseCategories.map(c => ({
    name: c.label.split(' ')[1] || c.value,
    value: expenses.filter(e => e.category === c.value).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.value > 0)

  const month = format(new Date(), 'MMMM yyyy')

  return (
    <Layout title="Money">
      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-4 p-1 bg-bg-card border border-border rounded-xl">
        {(['overview', 'income', 'expenses', 'savings'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${tab === t ? 'bg-accent text-white' : 'text-muted'}`}
          >{t}</button>
        ))}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="flex flex-col gap-4">
                <div className="text-xs text-muted px-1">{month}</div>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 border-success/20 bg-success/5">
                    <p className="text-xs text-muted mb-1">Income</p>
                    <p className="font-black text-success text-base">{formatCurrency(totalIncome)}</p>
                  </Card>
                  <Card className="p-3 border-danger/20 bg-danger/5">
                    <p className="text-xs text-muted mb-1">Expenses</p>
                    <p className="font-black text-danger text-base">{formatCurrency(totalExpenses)}</p>
                  </Card>
                  <Card className={`p-3 ${net >= 0 ? 'border-info/20 bg-info/5' : 'border-warning/20 bg-warning/5'}`}>
                    <p className="text-xs text-muted mb-1">Net</p>
                    <p className={`font-black text-base ${net >= 0 ? 'text-info' : 'text-warning'}`}>{formatCurrency(net)}</p>
                  </Card>
                </div>

                {expenseByCategory.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-bold text-white mb-3 text-sm">Spending by Category</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={expenseByCategory} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: '#8B92A5', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#141620', border: '1px solid #252736', borderRadius: 12 }}
                          labelStyle={{ color: '#F1F5F9' }}
                          formatter={(v: number) => [formatCurrency(v), 'Amount']}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {expenseByCategory.map((_, i) => (
                            <Cell key={i} fill={`hsl(${(i * 47) % 360}, 70%, 60%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                <div className="flex gap-3">
                  <Button onClick={() => setIncomeOpen(true)} fullWidth variant="secondary" size="sm">
                    <TrendingUp className="w-4 h-4 mr-1.5 text-success" /> Add Income
                  </Button>
                  <Button onClick={() => setExpenseOpen(true)} fullWidth variant="secondary" size="sm">
                    <TrendingDown className="w-4 h-4 mr-1.5 text-danger" /> Add Expense
                  </Button>
                </div>
              </div>
            )}

            {/* INCOME */}
            {tab === 'income' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-muted text-sm">{month}</span>
                  <span className="font-bold text-success">{formatCurrency(totalIncome)}</span>
                </div>
                {income.length === 0 && <EmptyMoney label="No income logged this month" />}
                {income.map(i => (
                  <Card key={i.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{i.description}</p>
                      <p className="text-xs text-muted">{incomeCategories.find(c => c.value === i.category)?.label} · {format(parseISO(i.date), 'MMM d')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-success">{formatCurrency(i.amount)}</span>
                      <button onClick={() => deleteIncome(i.id)} className="text-muted hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Card>
                ))}
                <Button onClick={() => setIncomeOpen(true)} fullWidth variant="secondary">
                  <Plus className="w-5 h-5 mr-2" /> Add Income
                </Button>
              </div>
            )}

            {/* EXPENSES */}
            {tab === 'expenses' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-muted text-sm">{month}</span>
                  <span className="font-bold text-danger">{formatCurrency(totalExpenses)}</span>
                </div>
                {expenses.length === 0 && <EmptyMoney label="No expenses logged this month" />}
                {expenses.map(e => (
                  <Card key={e.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-danger/20 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="w-5 h-5 text-danger" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{e.description}</p>
                      <p className="text-xs text-muted">{expenseCategories.find(c => c.value === e.category)?.label} · {format(parseISO(e.date), 'MMM d')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-danger">{formatCurrency(e.amount)}</span>
                      <button onClick={() => deleteExpense(e.id)} className="text-muted hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Card>
                ))}
                <Button onClick={() => setExpenseOpen(true)} fullWidth variant="secondary">
                  <Plus className="w-5 h-5 mr-2" /> Add Expense
                </Button>
              </div>
            )}

            {/* SAVINGS */}
            {tab === 'savings' && (
              <div className="flex flex-col gap-3">
                {savingsGoals.length === 0 && <EmptyMoney label="No savings goals yet" />}
                {savingsGoals.map(g => (
                  <Card key={g.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white">{g.title}</h3>
                        <p className="text-muted text-sm mt-0.5">
                          {formatCurrency(g.current_amount)} of {formatCurrency(g.target_amount)}
                        </p>
                      </div>
                      <button onClick={() => deleteSavingsGoal(g.id)} className="text-muted hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <ProgressBar value={g.current_amount} max={g.target_amount} color="bg-success" height="h-2.5" className="mb-3" />
                    <p className="text-xs text-muted mb-2">{Math.round((g.current_amount / g.target_amount) * 100)}% saved</p>
                    <div className="flex gap-2">
                      {[10, 50, 100, 500].map(amt => (
                        <button key={amt} onClick={() => updateSavings(g, amt)}
                          className="flex-1 py-2 bg-success/20 text-success rounded-lg text-xs font-semibold hover:bg-success/30 transition-colors"
                        >+${amt}</button>
                      ))}
                    </div>
                  </Card>
                ))}
                <Button onClick={() => setSavingsOpen(true)} fullWidth variant="secondary">
                  <Plus className="w-5 h-5 mr-2" /> Add Savings Goal
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Income Modal */}
      <Modal open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Add Income">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Amount" value={iAmount} onChange={e => setIAmount(e.target.value)} type="number" inputMode="decimal" placeholder="0.00" />
          <Input label="Description" value={iDesc} onChange={e => setIDesc(e.target.value)} placeholder="e.g. Monthly salary" />
          <Select label="Category" value={iCategory} onChange={e => setICategory(e.target.value)} options={incomeCategories} />
          <Input label="Date" value={iDate} onChange={e => setIDate(e.target.value)} type="date" />
          <Button onClick={addIncome} disabled={!iAmount || !iDesc || saving} fullWidth>Save Income</Button>
        </div>
      </Modal>

      {/* Expense Modal */}
      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Add Expense">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Amount" value={eAmount} onChange={e => setEAmount(e.target.value)} type="number" inputMode="decimal" placeholder="0.00" />
          <Input label="Description" value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="e.g. Groceries" />
          <Select label="Category" value={eCategory} onChange={e => setECategory(e.target.value)} options={expenseCategories} />
          <Input label="Date" value={eDate} onChange={e => setEDate(e.target.value)} type="date" />
          <Button onClick={addExpense} disabled={!eAmount || !eDesc || saving} fullWidth>Save Expense</Button>
        </div>
      </Modal>

      {/* Savings Modal */}
      <Modal open={savingsOpen} onClose={() => setSavingsOpen(false)} title="New Savings Goal">
        <div className="p-5 flex flex-col gap-4">
          <Input label="Goal name" value={sTitle} onChange={e => setSTitle(e.target.value)} placeholder="e.g. Emergency fund" />
          <Input label="Target amount" value={sTarget} onChange={e => setSTarget(e.target.value)} type="number" inputMode="decimal" placeholder="0.00" />
          <Input label="Current amount (optional)" value={sCurrent} onChange={e => setSCurrent(e.target.value)} type="number" inputMode="decimal" placeholder="0.00" />
          <Input label="Target date (optional)" value={sDate} onChange={e => setSDate(e.target.value)} type="date" />
          <Button onClick={addSavingsGoal} disabled={!sTitle || !sTarget || saving} fullWidth>Save Goal</Button>
        </div>
      </Modal>
    </Layout>
  )
}

function EmptyMoney({ label }: { label: string }) {
  return (
    <div className="text-center py-10">
      <DollarSign className="w-10 h-10 text-border mx-auto mb-3" />
      <p className="text-muted text-sm">{label}</p>
    </div>
  )
}
