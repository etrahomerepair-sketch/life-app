import { useState } from 'react'
import { Delete } from 'lucide-react'
import { authStore } from '../store/authStore'
import { cn } from '../lib/utils'

interface AuthProps {
  onSuccess: () => void
}

export function Auth({ onSuccess }: AuthProps) {
  const isPinSet = authStore.isPinSet()
  const [step, setStep] = useState<'enter' | 'create' | 'confirm'>(isPinSet ? 'enter' : 'create')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const currentPin = step === 'confirm' ? confirmPin : pin
  const setCurrentPin = step === 'confirm' ? setConfirmPin : setPin

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  async function handleDigit(d: string) {
    if (currentPin.length >= 4) return
    const next = currentPin + d
    setCurrentPin(next)
    setError('')

    if (next.length === 4) {
      await handleComplete(next)
    }
  }

  function handleDelete() {
    if (currentPin.length === 0) return
    setCurrentPin(currentPin.slice(0, -1))
    setError('')
  }

  async function handleComplete(value: string) {
    if (step === 'enter') {
      const ok = await authStore.verifyPin(value)
      if (ok) {
        onSuccess()
      } else {
        setError('Wrong PIN. Try again.')
        triggerShake()
        setTimeout(() => setPin(''), 400)
      }
    } else if (step === 'create') {
      setStep('confirm')
    } else if (step === 'confirm') {
      if (value === pin) {
        await authStore.setPin(pin)
        onSuccess()
      } else {
        setError('PINs don\'t match. Start over.')
        triggerShake()
        setTimeout(() => {
          setPin('')
          setConfirmPin('')
          setStep('create')
        }, 400)
      }
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="flex flex-col items-center justify-center h-full bg-bg safe-top safe-bottom px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-black text-accent-light">L</span>
        </div>
        <h1 className="text-2xl font-black text-white">Life App</h1>
        <p className="text-muted text-sm mt-1">
          {step === 'enter' && 'Enter your PIN'}
          {step === 'create' && 'Create a 4-digit PIN'}
          {step === 'confirm' && 'Confirm your PIN'}
        </p>
      </div>

      {/* PIN dots */}
      <div className={cn('flex gap-4 mb-8', shake && 'animate-bounce')}>
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={cn(
              'w-4 h-4 rounded-full border-2 transition-all duration-200',
              currentPin.length > i
                ? 'bg-accent border-accent scale-110'
                : 'bg-transparent border-border'
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-danger text-sm mb-4 animate-fade-in">{error}</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                className="numpad-btn h-16 rounded-2xl flex items-center justify-center text-muted hover:text-white transition-colors"
              >
                <Delete className="w-6 h-6" />
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="numpad-btn h-16 rounded-2xl bg-bg-card border border-border text-2xl font-semibold text-white transition-all duration-150"
            >
              {d}
            </button>
          )
        })}
      </div>

      {step === 'confirm' && (
        <button
          onClick={() => { setStep('create'); setPin(''); setConfirmPin(''); setError('') }}
          className="mt-6 text-sm text-muted hover:text-white transition-colors"
        >
          ← Back
        </button>
      )}
    </div>
  )
}
