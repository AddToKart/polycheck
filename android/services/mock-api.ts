import { Platform } from 'react-native'

const STORAGE_KEY = 'polycheck-user'
const TOKEN_KEY = 'polycheck-token'
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api'

let SecureStoreModule: typeof import('expo-secure-store') | null = null
if (Platform.OS !== 'web') {
  try {
    SecureStoreModule = require('expo-secure-store')
  } catch { /* noop */ }
}

async function loadUserFromStore(): Promise<User | null> {
  if (!SecureStoreModule) return null
  try {
    const raw = await SecureStoreModule.getItemAsync(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch { return null }
}

async function saveUserToStore(user: User | null) {
  if (!SecureStoreModule) return
  try {
    if (user) await SecureStoreModule.setItemAsync(STORAGE_KEY, JSON.stringify(user))
    else await SecureStoreModule.deleteItemAsync(STORAGE_KEY)
  } catch { /* noop */ }
}

async function getTokenFromStore(): Promise<string | null> {
  if (!SecureStoreModule) return null
  try {
    return await SecureStoreModule.getItemAsync(TOKEN_KEY)
  } catch { return null }
}

async function setTokenInStore(token: string | null) {
  if (!SecureStoreModule) return
  try {
    if (token) await SecureStoreModule.setItemAsync(TOKEN_KEY, token)
    else await SecureStoreModule.deleteItemAsync(TOKEN_KEY)
  } catch { /* noop */ }
}

import { createMockApiCore } from '@polycheck/shared/mock'
import type { User } from '@polycheck/shared'

let currentUser: User | null = null

// Create shared core API instance for mock data / fallback auth
const coreApi = createMockApiCore()

// Destructure out auth methods we override, keep the rest as fallback
const {
  loginStudent: _loginStudent,
  loginFaculty: _loginFaculty,
  ...coreMethods
} = coreApi

// Try backend, fall back to mock if unreachable
async function tryBackendLogin<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    const result = await fn()
    return result
  } catch {
    return fallback()
  }
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getTokenFromStore()
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
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
        saveUserToStore(currentUser)
        setTokenInStore(data.token)
        return currentUser
      },
      () => {
        const user = _loginStudent(studentId, password)
        if (user) {
          currentUser = user
          saveUserToStore(user)
          setTokenInStore('mock-token')
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
        saveUserToStore(currentUser)
        setTokenInStore(data.token)
        return currentUser
      },
      () => {
        const user = _loginFaculty(email, password)
        if (user) {
          currentUser = user
          saveUserToStore(user)
          setTokenInStore('mock-token')
        }
        return user
      },
    )
  },

  login(studentId: string): Promise<User | null> {
    return this.loginStudent(studentId)
  },

  async restoreSession(): Promise<User | null> {
    const u = await loadUserFromStore()
    if (u) currentUser = u
    return u
  },

  logout() {
    currentUser = null
    saveUserToStore(null)
    setTokenInStore(null)
  },

  getCurrentUser(): User | null {
    return currentUser
  },

  // Delegate all other methods to the shared core API
  ...coreMethods,
}
