import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div
        className={cn(
          'relative w-full max-w-lg bg-bg-card border border-border rounded-t-3xl animate-slide-up',
          'max-h-[90vh] flex flex-col',
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-elevated transition-colors">
              <X className="w-5 h-5 text-muted" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scroll-area">
          {children}
        </div>
      </div>
    </div>
  )
}
