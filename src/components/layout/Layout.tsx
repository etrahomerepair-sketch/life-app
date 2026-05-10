import { ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import { Header } from './Header'

interface LayoutProps {
  children: ReactNode
  title?: string
  headerRight?: ReactNode
  hideNav?: boolean
}

export function Layout({ children, title, headerRight, hideNav }: LayoutProps) {
  return (
    <div className="flex flex-col h-full bg-bg">
      <Header title={title} right={headerRight} />
      <main className="flex-1 overflow-hidden">
        <div className="h-full scroll-area">
          {children}
        </div>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}
