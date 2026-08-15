'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/lib/hooks'

type DashboardArea = 'faculty' | 'student'
type GuardState = 'checking' | 'ready' | 'unavailable'
const SESSION_REVALIDATION_INTERVAL_MS = 60_000

const canAccess = (user: User, area: DashboardArea) =>
  area === 'student'
    ? user.role === 'student'
    : user.role === 'teacher' || user.role === 'super_admin'

export function SessionGuard({
  area,
  children,
}: {
  area: DashboardArea
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<GuardState>('checking')
  const verificationInFlightRef = useRef(false)

  const verifySession = useCallback(async (background = false) => {
    if (verificationInFlightRef.current) return
    verificationInFlightRef.current = true
    if (!background) setState('checking')
    try {
      const user = await api.restoreSession()
      if (!user || !canAccess(user, area)) {
        setState('checking')
        router.replace('/')
        return
      }
      setState('ready')
    } catch {
      // A background network failure is not proof that auth was revoked. Keep
      // already-verified content mounted and retry on the next bounded check.
      if (!background) setState('unavailable')
    } finally {
      verificationInFlightRef.current = false
    }
  }, [area, router])

  useEffect(() => {
    void verifySession()
  }, [verifySession])

  useEffect(() => {
    // WebSocket auth replacement events are best-effort because some proxies
    // block upgrades. Periodic HTTP verification bounds that gap without using
    // Socket.IO polling, which requires replica stickiness. Returning to the
    // tab/window revalidates immediately.
    const revalidate = () => { void verifySession(true) }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidate()
    }
    const interval = window.setInterval(revalidate, SESSION_REVALIDATION_INTERVAL_MS)
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [verifySession])

  // Any later 401 (e.g. a cockpit refresh) clears the cached user and emits
  // polycheck-auth-changed. React immediately so protected content — including
  // a rendered QR code — never stays visible after the session is rejected.
  // Note: saveUser also dispatches this event on successful restores, so the
  // listener must only act when the cached user was actually cleared.
  useEffect(() => {
    const onAuthChanged = () => {
      if (!api.getCurrentUser()) {
        // Unmount protected content immediately and let the login flow take over.
        setState('checking')
        router.replace('/')
      }
    }
    window.addEventListener('polycheck-auth-changed', onAuthChanged)
    return () => window.removeEventListener('polycheck-auth-changed', onAuthChanged)
  }, [router])

  if (state === 'checking') {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-100 px-6 text-center dark:bg-pup-black"
        role="status"
        aria-live="polite"
      >
        <LoadingSpinner size="lg" />
        <p className="text-sm font-semibold text-maroon-dark dark:text-golden">Verifying your session…</p>
      </main>
    )
  }

  if (state === 'unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 dark:bg-pup-black">
        <section
          className="w-full max-w-md border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-golden/15 dark:bg-surface-dark"
          role="alert"
          aria-labelledby="session-unavailable-title"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden">Connection unavailable</p>
          <h1 id="session-unavailable-title" className="font-heading text-2xl font-bold text-maroon-dark dark:text-white">
            We couldn’t verify your session
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Your saved profile is still on this device. Check your connection and try again.
          </p>
          <Button className="mt-6" onClick={() => void verifySession()}>
            Retry
          </Button>
        </section>
      </main>
    )
  }

  return <>{children}</>
}
