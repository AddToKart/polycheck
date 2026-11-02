'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/lib/notifications'
import { PWA_UPDATE_EVENT, registerServiceWorker } from '@/lib/pwa/register-sw'
import { api } from '@/lib/api-client'

/**
 * App-wide PWA bootstrap: registers the service worker and surfaces an update
 * notification. Rendered once from the root layout.
 */
export function PwaBoot() {
  const { addNotification } = useNotifications()

  useEffect(() => {
    void registerServiceWorker()
  }, [])

  useEffect(() => {
    const refreshClock = () => {
      if (api.getCurrentUser()) void api.refreshServerClockOffset().catch(() => undefined)
    }
    refreshClock()
    window.addEventListener('online', refreshClock)
    return () => window.removeEventListener('online', refreshClock)
  }, [])

  useEffect(() => {
    const onUpdate = () => {
      addNotification(
        'info',
        'Update ready',
        'Reload the page to use the latest version of Polycheck.',
      )
    }
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate)
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate)
  }, [addNotification])

  return null
}
