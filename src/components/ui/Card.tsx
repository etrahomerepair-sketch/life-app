import { cn } from '../../lib/utils'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  elevated?: boolean
}

export function Card({ children, className, onClick, elevated }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-border',
        elevated ? 'bg-bg-elevated' : 'bg-bg-card',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className
      )}
    >
      {children}
    </div>
  )
}
