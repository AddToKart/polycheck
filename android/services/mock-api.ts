import { Platform } from 'react-native'

const STORAGE_KEY = 'polycheck-user'

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

import { createMockApiCore } from '@polycheck/shared/mock'
import type { User } from '@polycheck/shared'

let currentUser: User | null = null

// Create shared core API instance
const coreApi = createMockApiCore()

export const api = {
  async restoreSession(): Promise<User | null> {
    const u = await loadUserFromStore()
    if (u) currentUser = u
    return u
  },

  loginStudent(studentId: string, password?: string): User | null {
    const user = coreApi.loginStudent(studentId, password)
    if (user) {
      currentUser = user
      saveUserToStore(user)
    }
    return user
  },

  loginFaculty(email: string, password?: string): User | null {
    const user = coreApi.loginFaculty(email, password)
    if (user) {
      currentUser = user
      saveUserToStore(user)
    }
    return user
  },

  login(studentId: string): User | null {
    return this.loginStudent(studentId)
  },

  logout() {
    currentUser = null
    saveUserToStore(null)
  },

  getCurrentUser(): User | null {
    return currentUser
  },

  // Delegate all other methods to the shared core API
  ...coreApi,
