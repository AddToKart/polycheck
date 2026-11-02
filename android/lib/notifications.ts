import type { AppNotification, NotificationType, UserRole } from '@polycheck/shared'

const NOTIFICATION_TYPES: NotificationType[] = [
  'dispute_filed',
  'dispute_resolved',
  'excuse_requested',
  'excuse_decided',
  'attendance_absent',
  'standing_below_threshold',
  'account_status_changed',
  'password_reset',
  'role_changed',
  'key_provisioned',
]

const STUDENT_TYPE_ROUTES: Partial<Record<NotificationType, string>> = {
  dispute_resolved: '/(tabs)/history',
  excuse_decided: '/(tabs)/history',
  attendance_absent: '/(tabs)/history',
  standing_below_threshold: '/(tabs)/dashboard',
}

const FACULTY_TYPE_ROUTES: Partial<Record<NotificationType, string>> = {
  dispute_filed: '/(faculty)/disputes',
  excuse_requested: '/(faculty)/excuses',
  key_provisioned: '/(faculty)/sessions',
}

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && NOTIFICATION_TYPES.includes(value as NotificationType)
}

/** Deduplicates by id, newest-first, capped so the list cannot grow forever. */
export function mergeNotifications(
  current: AppNotification[],
  incoming: AppNotification[],
  limit = 50,
): AppNotification[] {
  const byId = new Map<string, AppNotification>()
  for (const notification of current) byId.set(notification.id, notification)
  for (const notification of incoming) byId.set(notification.id, notification)
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export function countUnreadNotifications(notifications: AppNotification[]): number {
  return notifications.reduce((count, notification) => count + (notification.readAt ? 0 : 1), 0)
}

/** Optimistic local read state matching `POST /notifications/read`. */
export function markNotificationsReadLocally(
  notifications: AppNotification[],
  input: { ids?: string[]; all?: boolean },
  readAt = new Date().toISOString(),
): AppNotification[] {
  const ids = new Set(input.ids ?? [])
  return notifications.map((notification) => {
    if (input.all || ids.has(notification.id)) {
      return notification.readAt ? notification : { ...notification, readAt }
    }
    return notification
  })
}

function mapWebLink(link: string, role: UserRole): string | null {
  const path = link.split(/[?#]/)[0].replace(/\/+$/, '')
  if (!path) return null

  if (path.startsWith('/(faculty)') || path.startsWith('/(tabs)')) return path

  if (role === 'student') {
    if (path === '/student/dashboard') return '/(tabs)/dashboard'
    if (path === '/student/history') return '/(tabs)/history'
    if (path.startsWith('/student/')) return '/(tabs)/dashboard'
    return null
  }

  if (path === '/faculty/students' || path === '/faculty/student') return '/(faculty)/subjects'
  const studentDetail = /^\/faculty\/students\/([^/]+)$/.exec(path)
  if (studentDetail) return `/(faculty)/student/${studentDetail[1]}`
  if (path === '/faculty/history') return '/(faculty)/attendance'
  if (path.startsWith('/faculty/')) return `/(faculty)/${path.slice('/faculty/'.length)}`
  return null
}

/**
 * Resolves a notification's web-style deep link (or its type fallback) to an
 * Expo Router path. Unknown links return null so the center simply marks read.
 */
export function resolveNotificationRoute(
  input: { link?: string; type?: string },
  role: UserRole,
): string | null {
  if (typeof input.link === 'string' && input.link.trim()) {
    const mapped = mapWebLink(input.link.trim(), role)
    if (mapped) return mapped
  }
  if (!isNotificationType(input.type)) return null
  const typeRoutes = role === 'student' ? STUDENT_TYPE_ROUTES : FACULTY_TYPE_ROUTES
  return typeRoutes[input.type] ?? null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Compact relative timestamp used by the notification list. */
export function formatRelativeNotificationTime(
  createdAt: string,
  now: number = Date.now(),
): string {
  const time = new Date(createdAt).getTime()
  if (!Number.isFinite(time)) return ''
  const diff = Math.max(0, now - time)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`

  const date = new Date(time)
  const current = new Date(now)
  const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  return date.getFullYear() === current.getFullYear() ? label : `${label}, ${date.getFullYear()}`
}
