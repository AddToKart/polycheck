'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api-client'
import { monitorAuthSession } from '@/lib/realtime'
import { useNotifications } from '@/lib/notifications'

const REPLACEMENT_NOTICE_KEY = 'polycheck-session-replaced'

export function AuthSessionMonitor() {
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (sessionStorage.getItem(REPLACEMENT_NOTICE_KEY)) {
      sessionStorage.removeItem(REPLACEMENT_NOTICE_KEY)
      addNotification('warning', 'Session ended', 'Your session was replaced or revoked. Please sign in again.')
    }

    return monitorAuthSession(() => {
      sessionStorage.setItem(REPLACEMENT_NOTICE_KEY, 'true')
      void api.logout()
      window.location.assign('/')
    })
  }, [addNotification])

  return null
}
