'use client'

import { useEffect } from 'react'
import { api, isOwnLoginInFlight } from '@/lib/api-client'
import { monitorAuthSession } from '@/lib/realtime'
import { useNotifications } from '@/lib/notifications'

const REPLACEMENT_NOTICE_KEY = 'polycheck-session-replaced'

/**
 * The server broadcasts `auth:session-replaced` to the whole user room —
 * including the browser that just performed the replacement login, whose
 * WebSocket event can beat the login's HTTP response (so even a fresh
 * /auth/me probe can still carry the pre-login cookie). The guard therefore
 * mutes the destructive path only while this device has a login IN FLIGHT
 * (pre-cookie); once the login response completed, the fresh cookie is
 * applied and a probe is authoritative — so a cross-device replacement right
 * after this device's own login resolves through the probe. A
 * genuinely replaced device fails it (null) and takes the destructive path
 * exactly as before. Network failures are never proof of revocation either
 * way.
 */
async function terminateOnAuthoritativeReplacement() {
  if (isOwnLoginInFlight()) return
  try {
    const user = await api.restoreSession()
    if (user) return
  } catch {
    return
  }
  try {
    sessionStorage.setItem(REPLACEMENT_NOTICE_KEY, 'true')
  } catch {
    // Best-effort notice persistence.
  }
  // A replacement/revocation is not a user logout: never arm the student
  // device cooldown from this programmatic termination.
  void api.logout({ armDeviceCooldown: false })
  // A full reload is deliberate: it clears all in-memory state after the
  // session was revoked. `replace` also keeps the revoked page out of
  // history so the back button cannot restore protected content.
  window.location.replace('/')
}

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
      void terminateOnAuthoritativeReplacement()
    })
  }, [addNotification])

  return null
}
