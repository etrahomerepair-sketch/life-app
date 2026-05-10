import { cn } from '../../lib/utils'
import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: 'purple' | 'green' | 'yellow' | 'red' | 'blue' | 'gray'
  className?: string
}

const colors = {
  purple: 'bg-accent/20 text-accent-light',
  green: 'bg-success/20 text-success',
  yellow: 'bg-warning/20 text-warning',
  red: 'bg-danger/20 text-danger',
  blue: 'bg-info/20 text-info',
  gray: 'bg-bg-elevated text-muted',
}

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold', colors[color], className)}>
      {children}
    </span>
  )
}
