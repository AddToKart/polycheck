'use client'

import { useCallback, useEffect, useReducer } from 'react'
import type { AppNotification } from '@polycheck/shared'
import { api, isAuthRejection } from '../api-client'
import { subscribeToNotifications } from '../realtime'
import {
  initialNotificationCenterState,
  notificationCenterReducer,
} from '../notification-center'

const COUNT_POLL_MS = 30_000
const LIST_LIMIT = 30

/**
 * In-app notification centre state. The unread count is polled on mount and
 * every 30 s as a fallback; realtime `notifications:new` events update it
 * immediately. The list is loaded when the bell is opened.
 */
export function useNotificationCenter(userId?: string) {
  const [state, dispatch] = useReducer(notificationCenterReducer, initialNotificationCenterState)

  const refresh = useCallback(async () => {
    dispatch({ type: 'loading' })
    try {
      const [notifications, unreadCount] = await Promise.all([
        api.getNotifications({ limit: LIST_LIMIT }),
        api.getUnreadNotificationCount(),
      ])
      dispatch({ type: 'loaded', notifications, unreadCount })
    } catch (error) {
      if (!isAuthRejection(error)) {
        dispatch({ type: 'failed', error: 'Notifications could not load. Try again.' })
      }
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true

    const pollCount = async () => {
      try {
        const unreadCount = await api.getUnreadNotificationCount()
        if (active) dispatch({ type: 'count', unreadCount })
      } catch {
        // The badge is best-effort; SessionGuard owns auth/network failures.
      }
    }

    void pollCount()
    const timer = window.setInterval(() => void pollCount(), COUNT_POLL_MS)
    const unsubscribe = subscribeToNotifications((notification) => {
      if (active) dispatch({ type: 'received', notification })
    })

    return () => {
      active = false
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [userId])

  const markRead = useCallback(async (notification: AppNotification) => {
    if (notification.readAt) return
    dispatch({ type: 'marked', ids: [notification.id], readAt: new Date().toISOString() })
    try {
      const unreadCount = await api.markNotificationsRead({ ids: [notification.id] })
      dispatch({ type: 'count', unreadCount })
    } catch {
      // Re-sync with the authoritative list instead of guessing at rollback.
      void refresh()
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    if (state.unreadCount === 0) return
    dispatch({ type: 'marked', all: true, readAt: new Date().toISOString(), unreadCount: 0 })
    try {
      const unreadCount = await api.markNotificationsRead({ all: true })
      dispatch({ type: 'count', unreadCount })
    } catch {
      void refresh()
    }
  }, [refresh, state.unreadCount])

  return {
    ...state,
    refresh,
    markRead,
    markAllRead,
  }
}
