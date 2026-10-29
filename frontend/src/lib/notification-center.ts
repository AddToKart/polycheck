import type { AppNotification, NotificationType } from '@polycheck/shared'

/**
 * Pure state machine for the notification bell. Kept separate from the hook so
 * optimistic read handling and realtime fan-out can be unit-tested without a
 * network or socket.
 */
export interface NotificationCenterState {
  notifications: AppNotification[]
  unreadCount: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
}

export const initialNotificationCenterState: NotificationCenterState = {
  notifications: [],
  unreadCount: 0,
  status: 'idle',
  error: null,
}

export type NotificationCenterAction =
  | { type: 'loading' }
  | { type: 'loaded'; notifications: AppNotification[]; unreadCount: number }
  | { type: 'received'; notification: AppNotification }
  | { type: 'count'; unreadCount: number }
  | { type: 'marked'; ids?: string[]; all?: boolean; readAt: string; unreadCount?: number }
  | { type: 'failed'; error: string }
  | { type: 'restore'; state: NotificationCenterState }

function newestFirst(notifications: AppNotification[]): AppNotification[] {
  return [...notifications].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()
    if (leftTime === rightTime) return 0
    return rightTime - leftTime
  })
}

function isUnread(notification: AppNotification): boolean {
  return !notification.readAt
}

export function notificationCenterReducer(
  state: NotificationCenterState,
  action: NotificationCenterAction,
): NotificationCenterState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'loaded':
      return {
        notifications: newestFirst(action.notifications),
        unreadCount: Math.max(0, action.unreadCount),
        status: 'ready',
        error: null,
      }
    case 'received': {
      const existing = state.notifications.some((item) => item.id === action.notification.id)
      if (existing) {
        return {
          ...state,
          notifications: state.notifications.map((item) =>
            item.id === action.notification.id ? action.notification : item,
          ),
        }
      }
      return {
        ...state,
        notifications: newestFirst([action.notification, ...state.notifications]),
        unreadCount: state.unreadCount + (isUnread(action.notification) ? 1 : 0),
        status: 'ready',
      }
    }
    case 'count':
      return { ...state, unreadCount: Math.max(0, action.unreadCount) }
    case 'marked': {
      const ids = new Set(action.ids ?? [])
      let changed = 0
      const notifications = state.notifications.map((notification) => {
        if (notification.readAt) return notification
        if (!action.all && !ids.has(notification.id)) return notification
        changed += 1
        return { ...notification, readAt: action.readAt }
      })
      return {
        ...state,
        notifications,
        unreadCount:
          action.unreadCount !== undefined
            ? Math.max(0, action.unreadCount)
            : Math.max(0, state.unreadCount - changed),
      }
    }
    case 'failed':
      return { ...state, status: 'error', error: action.error }
    case 'restore':
      return action.state
    default:
      return state
  }
}

const INTERNAL_LINK = /^\/(?!\/)/

export function safeInternalLink(link?: string | null): string | null {
  if (!link) return null
  const trimmed = link.trim()
  return INTERNAL_LINK.test(trimmed) ? trimmed : null
}

const FALLBACK_LINKS: Partial<Record<NotificationType, string>> = {
  dispute_filed: '/faculty/disputes',
  dispute_resolved: '/student/dashboard?tab=attendance',
  excuse_requested: '/faculty/excuses',
  excuse_decided: '/student/dashboard?tab=attendance',
  attendance_absent: '/student/dashboard?tab=attendance',
  standing_below_threshold: '/student/dashboard',
}

/** Student outcomes land on the attendance history, not the dashboard summary. */
const STUDENT_HISTORY_TYPES = new Set<NotificationType>([
  'dispute_resolved',
  'excuse_decided',
  'attendance_absent',
])

/** Deep link for a notification, rejecting external/protocol-relative links. */
export function notificationDestination(notification: AppNotification): string | null {
  const link = safeInternalLink(notification.link)
  if (link) {
    if (
      STUDENT_HISTORY_TYPES.has(notification.type) &&
      link.split('?')[0] === '/student/dashboard'
    ) {
      return '/student/dashboard?tab=attendance'
    }
    return link
  }
  return FALLBACK_LINKS[notification.type] ?? null
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  dispute_filed: 'Dispute',
  dispute_resolved: 'Dispute',
  excuse_requested: 'Excuse',
  excuse_decided: 'Excuse',
  attendance_absent: 'Attendance',
  standing_below_threshold: 'Standing',
  account_status_changed: 'Account',
  password_reset: 'Account',
  role_changed: 'Account',
  key_provisioned: 'Security',
  device_released: 'Security',
}
