import { ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, BookOpen, Users, RotateCcw, GraduationCap, User, LogOut } from 'lucide-react'
import { authStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

interface HeaderProps {
  title?: string
  right?: ReactNode
}

const drawerLinks = [
  { path: '/journal', icon: BookOpen, label: 'Journal & Mind' },
  { path: '/routines', icon: RotateCcw, label: 'Routines' },
  { path: '/learning', icon: GraduationCap, label: 'Learning' },
  { path: '/relationships', icon: Users, label: 'Relationships' },
  { path: '/profile', icon: User, label: 'Profile & Settings' },
]

export function Header({ title, right }: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  function go(path: string) {
    setDrawerOpen(false)
    navigate(path)
  }

  function logout() {
    authStore.clearSession()
    window.location.reload()
  }

  return (
    <>
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-4 bg-bg border-b border-border safe-top">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 -ml-1.5 rounded-xl text-muted hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {title && <h1 className="text-base font-bold text-white">{title}</h1>}
        {!title && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-accent-light font-bold text-lg tracking-tight">LIFE</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {right}
        </div>
      </header>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative w-72 bg-bg-card border-r border-border h-full flex flex-col animate-slide-up safe-top"
            style={{ animation: 'slideIn 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <style>{`@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>

            <div className="flex items-center justify-between p-5 border-b border-border">
              <span className="text-accent-light font-bold text-xl tracking-tight">LIFE</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg hover:bg-bg-elevated">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            <nav className="flex-1 p-4 flex flex-col gap-1">
              {drawerLinks.map(({ path, icon: Icon, label }) => (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium transition-colors',
                    location.pathname === path
                      ? 'bg-accent/20 text-accent-light'
                      : 'text-muted hover:text-white hover:bg-bg-elevated'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-border">
              <button
                onClick={logout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium text-muted hover:text-danger hover:bg-danger/10 w-full transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Lock App
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
