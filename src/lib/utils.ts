import { format, isToday, isYesterday, parseISO } from 'date-fns'

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + 'life-app-salt-2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(date: string): string {
  const d = parseISO(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function getMoodEmoji(score: number): string {
  if (score >= 9) return '😄'
  if (score >= 7) return '🙂'
  if (score >= 5) return '😐'
  if (score >= 3) return '😕'
  return '😞'
}

export function getEnergyLabel(score: number): string {
  if (score >= 8) return 'High'
  if (score >= 5) return 'Medium'
  return 'Low'
}

export function getStreakEmoji(streak: number): string {
  if (streak >= 30) return '🔥🔥🔥'
  if (streak >= 14) return '🔥🔥'
  if (streak >= 7) return '🔥'
  if (streak >= 3) return '⚡'
  return ''
}

export function greet(name: string): string {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

export function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
