'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api-client'
import { monitorAuthSession } from '@/lib/realtime'
import { useNotifications } from '@/lib/notifications'

const REPLACEMENT_NOTICE_KEY = 'polycheck-session-replaced'

export function AuthSessionMonitor() {
  const { addNotification } = useNotifications()

  useEffect(() => {
    let hasReplacementNotice = false
    try {
      hasReplacementNotice = sessionStorage.getItem(REPLACEMENT_NOTICE_KEY) === 'true'
      if (hasReplacementNotice) sessionStorage.removeItem(REPLACEMENT_NOTICE_KEY)
    } catch {
      // Storage restrictions must not prevent the in-memory auth monitor from
      // connecting. The notice is best-effort; session enforcement is not.
    }
    if (hasReplacementNotice) {
      addNotification('warning', 'Session ended', 'Your session was replaced or revoked. Please sign in again.')
    }

    return monitorAuthSession(() => {
      try { sessionStorage.setItem(REPLACEMENT_NOTICE_KEY, 'true') } catch { /* Best-effort notice persistence. */ }
      void api.logout()
      window.location.assign('/')
    })
  }, [addNotification])

  return null
}
