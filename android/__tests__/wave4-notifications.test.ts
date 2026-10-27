import type { AppNotification } from '@polycheck/shared'
import {
  countUnreadNotifications,
  formatRelativeNotificationTime,
  markNotificationsReadLocally,
  mergeNotifications,
  resolveNotificationRoute,
} from '../lib/notifications'

const notification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n-1',
  type: 'attendance_absent',
  title: 'Marked absent',
  body: 'You were marked absent in Software Engineering.',
  createdAt: '2026-10-27T02:00:00.000Z',
  ...overrides,
})

describe('mergeNotifications', () => {
  it('deduplicates by id, keeps the newest copy and sorts newest-first', () => {
    const current = [
      notification({ id: 'old', createdAt: '2026-10-20T00:00:00.000Z' }),
      notification({ id: 'same', title: 'Old title', createdAt: '2026-10-25T00:00:00.000Z' }),
    ]
    const incoming = [
      notification({ id: 'same', title: 'New title', createdAt: '2026-10-25T00:00:00.000Z' }),
      notification({ id: 'new', createdAt: '2026-10-27T00:00:00.000Z' }),
    ]

    expect(mergeNotifications(current, incoming).map((item) => [item.id, item.title])).toEqual([
      ['new', 'Marked absent'],
      ['same', 'New title'],
      ['old', 'Marked absent'],
    ])
  })

  it('caps the list to the requested limit', () => {
    const many = Array.from({ length: 8 }, (_, index) => notification({
      id: `n-${index}`,
      createdAt: `2026-10-${String(20 + index).padStart(2, '0')}T00:00:00.000Z`,
    }))
    expect(mergeNotifications([], many, 3).map((item) => item.id)).toEqual(['n-7', 'n-6', 'n-5'])
  })
})

describe('unread state', () => {
  const list = [
    notification({ id: 'a' }),
    notification({ id: 'b', readAt: '2026-10-27T03:00:00.000Z' }),
    notification({ id: 'c' }),
  ]

  it('counts unread items', () => {
    expect(countUnreadNotifications(list)).toBe(2)
  })

  it('marks selected ids or everything as read without overwriting a timestamp', () => {
    const readAt = '2026-10-27T04:00:00.000Z'
    expect(markNotificationsReadLocally(list, { ids: ['a'] }, readAt)).toEqual([
      expect.objectContaining({ id: 'a', readAt }),
      expect.objectContaining({ id: 'b', readAt: '2026-10-27T03:00:00.000Z' }),
      expect.objectContaining({ id: 'c' }),
    ])
    expect(markNotificationsReadLocally(list, { all: true }, readAt).every((item) => item.readAt)).toBe(true)
    expect(countUnreadNotifications(markNotificationsReadLocally(list, { all: true }, readAt))).toBe(0)
  })
})

describe('resolveNotificationRoute', () => {
  it('maps server deep links to Expo Router paths', () => {
    expect(resolveNotificationRoute({ link: '/student/history' }, 'student')).toBe('/(tabs)/history')
    expect(resolveNotificationRoute({ link: '/faculty/excuses' }, 'teacher')).toBe('/(faculty)/excuses')
    expect(resolveNotificationRoute({ link: '/faculty/students/s-9' }, 'teacher')).toBe('/(faculty)/student/s-9')
    expect(resolveNotificationRoute({ link: '/faculty/sessions/sess-1' }, 'super_admin')).toBe('/(faculty)/sessions/sess-1')
    expect(resolveNotificationRoute({ link: '/(faculty)/notifications' }, 'teacher')).toBe('/(faculty)/notifications')
  })

  it('falls back to the notification type when the link is unknown or mismatched', () => {
    expect(resolveNotificationRoute({ link: '/faculty/disputes', type: 'dispute_resolved' }, 'student')).toBe('/(tabs)/history')
    expect(resolveNotificationRoute({ type: 'excuse_requested' }, 'teacher')).toBe('/(faculty)/excuses')
    expect(resolveNotificationRoute({ type: 'dispute_filed' }, 'super_admin')).toBe('/(faculty)/disputes')
    expect(resolveNotificationRoute({ type: 'unknown_type' }, 'student')).toBeNull()
    expect(resolveNotificationRoute({ link: '/somewhere/else' }, 'teacher')).toBeNull()
  })
})

describe('formatRelativeNotificationTime', () => {
  const now = new Date('2026-10-27T12:00:00.000Z').getTime()

  it('uses compact relative labels', () => {
    expect(formatRelativeNotificationTime('2026-10-27T11:59:40.000Z', now)).toBe('Just now')
    expect(formatRelativeNotificationTime('2026-10-27T11:45:00.000Z', now)).toBe('15m ago')
    expect(formatRelativeNotificationTime('2026-10-27T09:00:00.000Z', now)).toBe('3h ago')
    expect(formatRelativeNotificationTime('2026-10-25T12:00:00.000Z', now)).toBe('2d ago')
  })

  it('falls back to a date for older notifications', () => {
    expect(formatRelativeNotificationTime('2026-09-30T12:00:00.000Z', now)).toBe('Sep 30')
    expect(formatRelativeNotificationTime('2025-09-30T12:00:00.000Z', now)).toBe('Sep 30, 2025')
  })

  it('never renders a future timestamp as negative', () => {
    expect(formatRelativeNotificationTime('2026-10-27T13:00:00.000Z', now)).toBe('Just now')
  })
})
