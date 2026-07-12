import { createMockApiCore } from '@polycheck/shared/mock'
import type { User } from '@polycheck/shared'

const STORAGE_KEY = 'polycheck-user'
const TOKEN_KEY = 'polycheck-token'
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

function loadUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch { return null }
}

function saveUser(user: User | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* noop */ }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// Create shared core API instance for mock data / fallback auth
const coreApi = createMockApiCore()

// Destructure out auth methods we override, keep the rest as fallback
const {
  loginStudent: _loginStudent,
  loginFaculty: _loginFaculty,
  ...coreMethods
} = coreApi

let currentUser: User | null = loadUser()

// Try backend, fall back to mock if unreachable
async function tryBackendLogin<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    const result = await fn()
    return result
  } catch {
    return fallback()
  }
}

export const api = {
  async loginStudent(studentId: string, password?: string): Promise<User | null> {
    return tryBackendLogin(
      async () => {
        const res = await fetch(`${API_BASE}/auth/login/student`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, password: password ?? '' }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Login failed' }))
          throw new Error(err.message || 'Login failed')
        }
        const data = await res.json()
        currentUser = data.user as User
        saveUser(currentUser)
        setToken(data.token)
        return currentUser
      },
      () => {
        const user = _loginStudent(studentId, password)
        if (user) {
          currentUser = user
          saveUser(user)
          setToken('mock-token')
        }
        return user
      },
    )
  },

  async loginFaculty(email: string, password?: string): Promise<User | null> {
    return tryBackendLogin(
      async () => {
        const res = await fetch(`${API_BASE}/auth/login/faculty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: password ?? '' }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Login failed' }))
          throw new Error(err.message || 'Login failed')
        }
        const data = await res.json()
        currentUser = data.user as User
        saveUser(currentUser)
        setToken(data.token)
        return currentUser
      },
      () => {
        const user = _loginFaculty(email, password)
        if (user) {
          currentUser = user
          saveUser(user)
          setToken('mock-token')
        }
        return user
      },
    )
  },

  logout() {
    currentUser = null
    saveUser(null)
    setToken(null)
  },

  getCurrentUser(): User | null {
    if (!currentUser) currentUser = loadUser()
    return currentUser
  },

  getToken(): string | null {
    return getToken()
  },

  // Delegate all other methods to the shared core API
  ...coreMethods,
}
