import { createMockApiCore } from '@polycheck/shared/mock'
import type { User } from '@polycheck/shared'

const STORAGE_KEY = 'polycheck-user'

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

let currentUser: User | null = loadUser()

// Create shared core API instance
const coreApi = createMockApiCore()

// Destructure out methods we override, keep the rest as fallback
const {
  loginStudent: _loginStudent,
  loginFaculty: _loginFaculty,
  ...coreMethods
} = coreApi

export const api = {
  loginStudent(studentId: string, password?: string): User | null {
    const user = _loginStudent(studentId, password)
    if (user) {
      currentUser = user
      saveUser(user)
    }
    return user
  },

  loginFaculty(email: string, password?: string): User | null {
    const user = _loginFaculty(email, password)
    if (user) {
      currentUser = user
      saveUser(user)
    }
    return user
  },

  logout() {
    currentUser = null
    saveUser(null)
  },

  getCurrentUser(): User | null {
    if (!currentUser) currentUser = loadUser()
    return currentUser
  },

  // Delegate all other methods to the shared core API
  ...coreMethods,
}
