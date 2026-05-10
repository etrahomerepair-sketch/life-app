import { hashPin } from '../lib/utils'

const PIN_HASH_KEY = 'life_app_pin_hash'
const SESSION_KEY = 'life_app_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export const authStore = {
  isPinSet(): boolean {
    return !!localStorage.getItem(PIN_HASH_KEY)
  },

  async setPin(pin: string): Promise<void> {
    const hash = await hashPin(pin)
    localStorage.setItem(PIN_HASH_KEY, hash)
    this.createSession()
  },

  async verifyPin(pin: string): Promise<boolean> {
    const stored = localStorage.getItem(PIN_HASH_KEY)
    if (!stored) return false
    const hash = await hashPin(pin)
    if (hash === stored) {
      this.createSession()
      return true
    }
    return false
  },

  createSession(): void {
    localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_DURATION))
  },

  isSessionValid(): boolean {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (!expiry) return false
    return Date.now() < parseInt(expiry)
  },

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY)
  },

  resetAll(): void {
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(SESSION_KEY)
  },
}
