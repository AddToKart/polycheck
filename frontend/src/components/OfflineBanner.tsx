'use client'

import { useEffect, useState } from 'react'
import { PWA_OFFLINE_ENABLED } from '@/lib/pwa/register-sw'

/**
 * Slim persistent banner shown while the browser is offline. Offline-capable
 * actions queue locally and sync when connectivity returns.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!mounted || !PWA_OFFLINE_ENABLED || online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-golden/40 bg-maroon px-4 py-2 text-center text-xs font-semibold text-white dark:bg-maroon-deep dark:text-golden"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-golden" aria-hidden="true" />
      Offline — attendance actions are saved on this device and will sync when you reconnect.
    </div>
  )
}
