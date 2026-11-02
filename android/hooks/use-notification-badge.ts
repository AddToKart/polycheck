import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from '../services/api-client'
import { subscribeToNotifications } from '../services/realtime'

const POLL_INTERVAL_MS = 30_000

/**
 * Unread notification count for the dashboard bell. Refetches on focus, keeps
 * a 30-second polling fallback, and increments immediately when the gateway
 * pushes `notifications:new`. Duplicate deliveries are ignored by id.
 */
export function useNotificationBadge(enabled = true) {
  const [count, setCount] = useState(0)
  const seenRef = useRef(new Set<string>())
  const userId = api.getCurrentUser()?.id ?? null

  const refresh = useCallback(async () => {
    if (!enabled || !userId) {
      setCount(0)
      return
    }
    try {
      const next = await api.getUnreadNotificationCount()
      if (typeof next === 'number' && Number.isFinite(next)) setCount(Math.max(0, next))
    } catch {
      // Offline or unavailable: keep the last known badge.
    }
  }, [enabled, userId])

  useFocusEffect(useCallback(() => {
    if (!enabled || !userId) {
      setCount(0)
      return
    }
    let active = true
    void refresh()
    const interval = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    const unsubscribe = subscribeToNotifications((notification) => {
      if (!active || seenRef.current.has(notification.id)) return
      seenRef.current.add(notification.id)
      if (!notification.readAt) setCount((current) => current + 1)
    })
    return () => {
      active = false
      clearInterval(interval)
      unsubscribe()
    }
  }, [enabled, refresh, userId]))

  return { count, refresh }
}
