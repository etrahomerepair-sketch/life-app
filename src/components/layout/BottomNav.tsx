import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Target, HeartPulse, DollarSign, Bot } from 'lucide-react'
import { cn } from '../../lib/utils'

const tabs = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/goals', icon: Target, label: 'Goals' },
  { path: '/health', icon: HeartPulse, label: 'Health' },
  { path: '/money', icon: DollarSign, label: 'Money' },
  { path: '/coach', icon: Bot, label: 'Coach' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="flex-shrink-0 bg-bg-card border-t border-border safe-bottom">
      <div className="flex items-center">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-all duration-150',
                active ? 'text-accent-light' : 'text-muted'
              )}
            >
              <Icon className={cn('w-6 h-6', active && 'drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]')} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
