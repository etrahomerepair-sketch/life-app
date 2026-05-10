import { cn } from '../../lib/utils'
import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  fullWidth?: boolean
}

export function Button({ variant = 'primary', size = 'md', children, fullWidth, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 disabled:opacity-40',
        variant === 'primary' && 'bg-accent hover:bg-accent-hover text-white',
        variant === 'secondary' && 'bg-bg-elevated border border-border text-white hover:bg-border',
        variant === 'ghost' && 'bg-transparent text-muted hover:text-white hover:bg-bg-elevated',
        variant === 'danger' && 'bg-danger/20 text-danger hover:bg-danger/30',
        size === 'sm' && 'text-sm px-3 py-2 min-h-[36px]',
        size === 'md' && 'text-base px-4 py-3 min-h-[48px]',
        size === 'lg' && 'text-lg px-6 py-4 min-h-[56px]',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
