import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@polycheck/shared'
import {
  initialNotificationCenterState,
  notificationCenterReducer,
  notificationDestination,
  safeInternalLink,
} from './notification-center'

function notification(
  id: string,
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id,
    type: 'excuse_requested',
    title: `Notification ${id}`,
    body: 'Body',
    createdAt: '2026-10-27T08:00:00.000Z',
    ...overrides,
  }
}

describe('notification center reducer', () => {
  it('loads the list newest-first and takes the server unread count', () => {
    const state = notificationCenterReducer(initialNotificationCenterState, {
      type: 'loaded',
      notifications: [
        notification('older', { createdAt: '2026-10-26T08:00:00.000Z' }),
        notification('newer', { createdAt: '2026-10-27T09:00:00.000Z' }),
      ],
      unreadCount: 4,
    })
    expect(state.notifications.map((item) => item.id)).toEqual(['newer', 'older'])
    expect(state.unreadCount).toBe(4)
    expect(state.status).toBe('ready')
  })

  it('prepends realtime notifications and increments unread exactly once', () => {
    const initial = notificationCenterReducer(initialNotificationCenterState, {
      type: 'loaded',
      notifications: [notification('existing')],
      unreadCount: 1,
    })
    const received = notificationCenterReducer(initial, {
      type: 'received',
      notification: notification('live', { createdAt: '2026-10-27T10:00:00.000Z' }),
    })
    expect(received.notifications[0].id).toBe('live')
    expect(received.unreadCount).toBe(2)

    const duplicate = notificationCenterReducer(received, {
      type: 'received',
      notification: notification('live', { title: 'Updated title' }),
    })
    expect(duplicate.unreadCount).toBe(2)
    expect(duplicate.notifications[0].title).toBe('Updated title')
  })

  it('does not increment for an already-read realtime notification', () => {
    const state = notificationCenterReducer(initialNotificationCenterState, {
      type: 'received',
      notification: notification('read-one', { readAt: '2026-10-27T08:01:00.000Z' }),
    })
    expect(state.unreadCount).toBe(0)
  })

  it('marks one notification read optimistically and decrements the badge', () => {
    const initial = notificationCenterReducer(initialNotificationCenterState, {
      type: 'loaded',
      notifications: [notification('one'), notification('two')],
      unreadCount: 2,
    })
    const marked = notificationCenterReducer(initial, {
      type: 'marked',
      ids: ['one'],
      readAt: '2026-10-27T11:00:00.000Z',
    })
    expect(marked.notifications.find((item) => item.id === 'one')?.readAt).toBe(
      '2026-10-27T11:00:00.000Z',
    )
    expect(marked.notifications.find((item) => item.id === 'two')?.readAt).toBeUndefined()
    expect(marked.unreadCount).toBe(1)
  })

  it('marks all read and accepts an authoritative count', () => {
    const initial = notificationCenterReducer(initialNotificationCenterState, {
      type: 'loaded',
      notifications: [notification('one'), notification('two')],
      unreadCount: 12,
    })
    const marked = notificationCenterReducer(initial, {
      type: 'marked',
      all: true,
      readAt: '2026-10-27T11:00:00.000Z',
      unreadCount: 0,
    })
    expect(marked.notifications.every((item) => Boolean(item.readAt))).toBe(true)
    expect(marked.unreadCount).toBe(0)
  })

  it('clamps counts and supports a failure state', () => {
    const state = notificationCenterReducer(initialNotificationCenterState, {
      type: 'count',
      unreadCount: -3,
    })
    expect(state.unreadCount).toBe(0)
    expect(
      notificationCenterReducer(state, { type: 'failed', error: 'Offline' }).status,
    ).toBe('error')
  })

  it('maps notification types to in-app destinations and rejects external links', () => {
    expect(notificationDestination(notification('one'))).toBe('/faculty/excuses')
    expect(
      notificationDestination(notification('two', { type: 'dispute_resolved', link: 'https://evil.test' })),
    ).toBe('/student/dashboard?tab=attendance')
    expect(
      notificationDestination(
        notification('three', { type: 'excuse_decided', link: '/student/dashboard' }),
      ),
    ).toBe('/student/dashboard?tab=attendance')
    expect(safeInternalLink('//evil.test/path')).toBeNull()
    expect(safeInternalLink('/faculty/disputes')).toBe('/faculty/disputes')
  })
})
