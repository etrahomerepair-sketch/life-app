import { cn } from '../../lib/utils'
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-muted">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted/50',
          'focus:outline-none focus:border-accent transition-colors',
          error && 'border-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-muted">{label}</label>}
      <textarea
        className={cn(
          'w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted/50',
          'focus:outline-none focus:border-accent transition-colors resize-none',
          className
        )}
        {...props}
      />
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-muted">{label}</label>}
      <select
        className={cn(
          'w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-white',
          'focus:outline-none focus:border-accent transition-colors appearance-none',
          className
        )}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-bg-elevated">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
