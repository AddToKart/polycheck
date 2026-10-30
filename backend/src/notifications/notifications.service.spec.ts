import { HttpException } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { NOTIFICATION_CREATED_EVENT } from './notification-events'

const flush = () => new Promise((resolve) => setImmediate(resolve))

function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'dispute_filed',
    title: 'New attendance dispute',
    body: 'A student filed a dispute.',
    link: '/faculty/disputes',
    readAt: null,
    createdAt: new Date('2026-10-27T01:00:00.000Z'),
    ...overrides,
  }
}

function makeService(options: { fetchImpl?: jest.Mock; accessToken?: string } = {}) {
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue(notificationRow()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    pushSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  }
  const redis = {
    consumeRateLimit: jest.fn().mockResolvedValue(true),
    setIfAbsent: jest.fn().mockResolvedValue(true),
  }
  const events = { emit: jest.fn() }
  const config = { get: jest.fn().mockReturnValue(options.accessToken) }
  const service = new NotificationsService(
    prisma as never,
    redis as never,
    events as never,
    (options.fetchImpl ?? jest.fn()) as never,
    config as never,
  )
  return { service, prisma, redis, events, config }
}

describe('NotificationsService', () => {
  it('persists a notification, emits the realtime event, and presents ISO timestamps', async () => {
    const { service, prisma, events } = makeService()

    const result = await service.create('user-1', {
      type: 'dispute_filed',
      title: 'New attendance dispute',
      body: 'A student filed a dispute.',
      link: '/faculty/disputes',
    })

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'dispute_filed',
        title: 'New attendance dispute',
        body: 'A student filed a dispute.',
        link: '/faculty/disputes',
      },
    })
    expect(events.emit).toHaveBeenCalledWith(NOTIFICATION_CREATED_EVENT, {
      userId: 'user-1',
      notification: result,
    })
    expect(result).toEqual({
      id: 'notif-1',
      type: 'dispute_filed',
      title: 'New attendance dispute',
      body: 'A student filed a dispute.',
      link: '/faculty/disputes',
      createdAt: '2026-10-27T01:00:00.000Z',
    })
  })

  it('scopes lists to the caller, applies unreadOnly, and caps the limit', async () => {
    const { service, prisma } = makeService()

    await service.list({ id: 'user-1' }, { unreadOnly: true, limit: 500 })

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  })

  it('counts unread notifications and marks only the caller records', async () => {
    const { service, prisma } = makeService()
    prisma.notification.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2)

    await expect(service.unreadCount({ id: 'user-1' })).resolves.toBe(7)
    await expect(service.markRead({ id: 'user-1' }, { ids: ['a', 'a', 'b'] })).resolves.toBe(2)

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', id: { in: ['a', 'b'] }, readAt: null },
      data: { readAt: expect.any(Date) },
    })
  })

  it('marks every unread notification when all is requested', async () => {
    const { service, prisma } = makeService()

    await service.markRead({ id: 'user-1' }, { all: true })

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    })
  })

  it('upserts a push token by token and reassigns ownership when it moved', async () => {
    const { service, prisma } = makeService()

    await expect(
      service.registerPushToken({ id: 'user-2' }, { token: ' ExponentPushToken[abc] ', platform: 'expo' }),
    ).resolves.toBe(true)

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[abc]' },
      update: { userId: 'user-2', platform: 'expo', lastSeenAt: expect.any(Date) },
      create: { userId: 'user-2', platform: 'expo', token: 'ExponentPushToken[abc]' },
    })
  })

  it('rate limits push token registration', async () => {
    const { service, redis } = makeService()
    redis.consumeRateLimit.mockResolvedValue(false)

    await expect(
      service.registerPushToken({ id: 'user-1' }, { token: 'ExponentPushToken[abc]', platform: 'expo' }),
    ).rejects.toThrow(HttpException)
  })

  it('sends Expo pushes to every device and prunes invalid tokens', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    })
    const { service, prisma } = makeService({ fetchImpl, accessToken: 'expo-token' })
    prisma.pushSubscription.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[one]' },
      { token: 'ExponentPushToken[two]' },
    ])

    await service.create('user-1', { type: 'password_reset', title: 'Password reset', body: 'Reset', link: '/login' })
    await flush()

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer expo-token' }),
      }),
    )
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[two]'] } },
    })
  })

  it('swallows push transport failures without failing the notification', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('push endpoint down'))
    const { service, prisma } = makeService({ fetchImpl })
    prisma.pushSubscription.findMany.mockResolvedValue([{ token: 'ExponentPushToken[one]' }])

    await expect(
      service.create('user-1', { type: 'account_status_changed', title: 'Account enabled', body: 'Enabled' }),
    ).resolves.toMatchObject({ id: 'notif-1' })
    await flush()

    expect(fetchImpl).toHaveBeenCalled()
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })

  it('keeps the durable notification when the push request returns an error status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => null })
    const { service, prisma } = makeService({ fetchImpl })
    prisma.pushSubscription.findMany.mockResolvedValue([{ token: 'ExponentPushToken[one]' }])

    await expect(
      service.create('user-1', { type: 'role_changed', title: 'Role changed', body: 'Changed' }),
    ).resolves.toMatchObject({ id: 'notif-1' })
    await flush()

    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })

  it('does not throw when the notification insert itself fails', async () => {
    const { service, prisma } = makeService()
    prisma.notification.create.mockRejectedValue(new Error('database down'))

    await expect(
      service.notify('user-1', { type: 'excuse_decided', title: 'Excuse approved', body: 'Approved' }),
    ).resolves.toBeUndefined()
  })

  it('prunes notifications past the 30-day retention window in a bounded batch', async () => {
    const { service, prisma } = makeService()
    prisma.notification.findMany.mockResolvedValueOnce([{ id: 'notif-1' }, { id: 'notif-2' }]).mockResolvedValueOnce([])
    prisma.notification.deleteMany.mockResolvedValue({ count: 2 })

    await expect(service.pruneExpired()).resolves.toBe(2)

    const cutoff = prisma.notification.findMany.mock.calls[0][0].where.createdAt.lt as Date
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000)
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['notif-1', 'notif-2'] } } })
    expect(prisma.notification.findMany).toHaveBeenCalledTimes(1)
  })

  it('throttles duplicate absence notifications per student and session', async () => {
    const { service, prisma, redis } = makeService()
    redis.setIfAbsent.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await expect(
      service.notifyAttendanceAbsent('student-1', { sessionId: 'sess-1', subjectName: 'CS 101', date: '2026-10-27' }),
    ).resolves.toBe(false)
    await expect(
      service.notifyAttendanceAbsent('student-1', { sessionId: 'sess-1', subjectName: 'CS 101', date: '2026-10-27' }),
    ).resolves.toBe(true)

    expect(redis.setIfAbsent).toHaveBeenCalledWith('notify:absent:student-1:sess-1', '1', 604800)
    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'attendance_absent', link: '/student/dashboard' }),
      }),
    )
  })

  it('throttles standing alerts for 24 hours per section', async () => {
    const { service, redis, prisma } = makeService()

    await service.notifyStandingRisk('student-1', {
      sectionId: 'sec-1',
      subjectName: 'CS 101',
      status: 'at_risk',
      attendanceRate: 76,
    })

    expect(redis.setIfAbsent).toHaveBeenCalledWith('notify:standing:student-1:sec-1', '1', 86400)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'standing_below_threshold', title: 'Attendance at risk' }),
      }),
    )
  })
})
