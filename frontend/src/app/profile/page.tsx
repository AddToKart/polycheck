'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { LoadingSpinner } from '@/lib/hooks'
import { PendingPasswordChange } from '@/components/auth/PendingPasswordChange'
import { ProfilePage } from '@/components/profile/ProfilePage'

/**
 * Universal profile route for students, teachers, and super admins. Restores
 * the session, enforces the forced-rotation gate, and reuses the sidebar shell
 * so the route behaves like the rest of the dashboard.
 */
export default function ProfileRoute() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [pendingUser, setPendingUser] = useState<User | null>(null)
  const [state, setState] = useState<'checking' | 'ready' | 'unavailable'>('checking')

  const load = useCallback(async () => {
    try {
      const current = await api.restoreSession()
      if (!current) {
        router.replace('/')
        return
      }
      if (current.mustChangePassword) {
        setPendingUser(current)
        setState('ready')
        return
      }
      setPendingUser(null)
      setUser(current)
      setState('ready')
    } catch {
      setState('unavailable')
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onAuthChanged = () => {
      if (!api.getCurrentUser()) router.replace('/')
    }
    window.addEventListener('polycheck-auth-changed', onAuthChanged)
    return () => window.removeEventListener('polycheck-auth-changed', onAuthChanged)
  }, [router])

  const logout = () => {
    void api.logout()
    router.push('/')
  }

  if (pendingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-pup-black">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
          <PendingPasswordChange
            user={pendingUser}
            onDone={(updated) => {
              setPendingUser(null)
              setUser(updated)
            }}
            onCancel={logout}
          />
        </div>
      </div>
    )
  }

  if (state === 'unavailable') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6 dark:bg-pup-black">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">We could not verify your session.</p>
        <button
          type="button"
          className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!user || state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-pup-black">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <ProfilePage
      user={user}
      onUpdated={(updated) => setUser(updated)}
      onLogout={logout}
    />
  )
}
