'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isMaintenanceExempt, type MaintenanceStatus } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { MaintenanceOverlay } from './MaintenanceOverlay'

interface MaintenanceContextValue {
  /** Active maintenance snapshot, or null when the system is open. */
  status: MaintenanceStatus | null
  /** Whether the cached actor is exempt (super admin / IT coordinator). */
  exempt: boolean
  refresh: () => Promise<void>
}

const MaintenanceContext = createContext<MaintenanceContextValue>({
  status: null,
  exempt: false,
  refresh: async () => {},
})

export function useMaintenance(): MaintenanceContextValue {
  return useContext(MaintenanceContext)
}

const POLL_INTERVAL_MS = 30_000

/**
 * Global maintenance state host.
 *
 * Sources: the public `/maintenance/status` probe (pre-login / app boot) and
 * the `polycheck-maintenance` window event emitted by the API client on any
 * 503 `system_maintenance`. While active it re-probes every 30 s so the wall
 * disappears as soon as an exempt operator reopens the system.
 */
export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null)
  const [exempt, setExempt] = useState(false)
  const [hasUser, setHasUser] = useState(() => Boolean(api.getCurrentUser()))

  const resolveExemption = useCallback(() => {
    const current = api.getCurrentUser()
    setHasUser(Boolean(current))
    setExempt(isMaintenanceExempt(current))
  }, [])

  const refresh = useCallback(async () => {
    const next = await api.getMaintenanceStatus()
    setStatus(next.enabled ? next : null)
    if (next.enabled) resolveExemption()
    else {
      setExempt(false)
      setHasUser(Boolean(api.getCurrentUser()))
    }
  }, [resolveExemption])

  useEffect(() => {
    void refresh()

    const onMaintenance = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; estimatedEnd?: string } | null>).detail
      setStatus({
        enabled: true,
        ...(detail?.message ? { message: detail.message } : {}),
        ...(detail?.estimatedEnd ? { estimatedEnd: detail.estimatedEnd } : {}),
      })
      resolveExemption()
    }
    // Login/logout and session replacement must update the exemption state:
    // the wall only belongs over an authenticated non-exempt surface. Logged-
    // out visitors see the login pages' own maintenance notice instead.
    const onAuthChanged = () => resolveExemption()
    window.addEventListener('polycheck-maintenance', onMaintenance)
    window.addEventListener('polycheck-auth-changed', onAuthChanged)
    return () => {
      window.removeEventListener('polycheck-maintenance', onMaintenance)
      window.removeEventListener('polycheck-auth-changed', onAuthChanged)
    }
  }, [refresh, resolveExemption])

  useEffect(() => {
    if (!status) return
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [status, refresh])

  const blocking = status !== null && hasUser && !exempt

  return (
    <MaintenanceContext.Provider value={{ status, exempt, refresh }}>
      {children}
      {blocking && status ? <MaintenanceOverlay status={status} /> : null}
      {status && exempt ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 whitespace-nowrap border border-golden bg-maroon px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-golden shadow-lg dark:bg-surface-dark"
        >
          Maintenance mode is active — you are exempt
        </div>
      ) : null}
    </MaintenanceContext.Provider>
  )
}
