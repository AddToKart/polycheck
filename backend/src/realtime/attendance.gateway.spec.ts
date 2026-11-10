import { WsException } from '@nestjs/websockets'
import {
  AI_THREAD_JOINED_EVENT,
  AI_THREAD_LEAVE_EVENT,
  ATTENDANCE_ANOMALY_EVENT,
  KIOSK_JOINED_EVENT,
  KIOSK_LEAVE_EVENT,
  SERVER_METRICS_EVENT,
  SERVER_METRICS_ROOM,
  SERVER_SUBSCRIBED_EVENT,
  SERVER_UNSUBSCRIBE_EVENT,
  SESSION_FINALE_EVENT,
  type SessionFinaleSummary,
} from '@polycheck/shared'
import { AttendanceGateway } from './attendance.gateway'

const statusMock = () => ({
  setActiveSockets: jest.fn(),
  snapshot: jest.fn().mockResolvedValue({ timestamp: '2026-10-26T00:00:00.000Z' }),
  publish: jest.fn(),
})

const aiStreamMock = () => ({ attach: jest.fn() })
const aiChatMock = () => ({ assertThreadAccess: jest.fn().mockResolvedValue({}) })

function makeGateway(
  sessions: unknown,
  prisma: unknown,
  status: unknown,
  stream = aiStreamMock(),
  chat = aiChatMock(),
) {
  return new AttendanceGateway(sessions as never, prisma as never, status as never, stream as never, chat as never)
}

function makeServer() {
  const emit = jest.fn()
  const server = {
    use: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    to: jest.fn().mockReturnValue({ emit }),
    emit,
    sockets: {
      size: 2,
      adapter: { rooms: new Map<string, Set<string>>() },
    },
  }
  return server
}

describe('AttendanceGateway', () => {
  it('does not permit students to join roster update rooms', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', sectionId: 'section-1', teacherId: 'teacher-1' }),
      },
    }
    const user = { id: 'student-1', role: 'student' }
    const sessions = { authenticate: jest.fn().mockResolvedValue(user) }
    const gateway = makeGateway(sessions, prisma, statusMock())
    const socket = { data: { user }, handshake: { headers: {}, auth: {} }, join: jest.fn() }

    await expect(gateway.joinSession(socket as never, { sessionId: 'session-1' })).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('joins an owning teacher only to the requested session room', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', sectionId: 'section-1', teacherId: 'teacher-1' }),
      },
    }
    const user = { id: 'teacher-1', role: 'teacher' }
    const sessions = { authenticate: jest.fn().mockResolvedValue(user) }
    const gateway = makeGateway(sessions, prisma, statusMock())
    const socket = { data: { user }, handshake: { headers: {}, auth: {} }, join: jest.fn() }

    await gateway.joinSession(socket as never, { sessionId: 'session-1' })

    expect(socket.join).toHaveBeenCalledTimes(1)
    expect(socket.join).toHaveBeenCalledWith('session:session-1')
  })

  it.each(['teacher', 'student'])('denies %s subscriptions to server metrics', async (role) => {
    const sessions = { authenticate: jest.fn().mockResolvedValue({ id: `${role}-1`, role }) }
    const gateway = makeGateway(sessions, {}, statusMock())
    const socket = { data: {}, handshake: { headers: {}, auth: {} }, join: jest.fn(), leave: jest.fn() }

    await expect(gateway.subscribeServerMetrics(socket as never)).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('joins super admins to the server metrics room and reports the cadence', async () => {
    const sessions = {
      authenticate: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'super_admin', scope: 'institution' }),
    }
    const gateway = makeGateway(sessions, {}, statusMock())
    const socket = {
      data: {},
      handshake: { headers: {}, auth: {} },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    }

    await expect(gateway.subscribeServerMetrics(socket as never)).resolves.toEqual({
      event: SERVER_SUBSCRIBED_EVENT,
      data: { intervalMs: 5_000 },
    })
    expect(socket.join).toHaveBeenCalledWith(SERVER_METRICS_ROOM)

    await expect(gateway.unsubscribeServerMetrics(socket as never)).resolves.toEqual({
      event: SERVER_UNSUBSCRIBE_EVENT,
    })
    expect(socket.leave).toHaveBeenCalledWith(SERVER_METRICS_ROOM)
  })

  it('does not build or publish a snapshot while nobody is subscribed', async () => {
    jest.useFakeTimers()
    const status = statusMock()
    const gateway = makeGateway({}, {}, status)
    const server = makeServer()

    try {
      gateway.afterInit(server as never)
      await jest.advanceTimersByTimeAsync(5_000)

      expect(status.snapshot).not.toHaveBeenCalled()
      expect(status.publish).not.toHaveBeenCalled()
    } finally {
      gateway.onModuleDestroy()
      jest.useRealTimers()
    }
  })

  it('publishes one snapshot per tick to the subscribed room', async () => {
    jest.useFakeTimers()
    const status = statusMock()
    const gateway = makeGateway({}, {}, status)
    const server = makeServer()
    server.sockets.adapter.rooms.set(SERVER_METRICS_ROOM, new Set(['admin-socket']))

    try {
      gateway.afterInit(server as never)
      await jest.advanceTimersByTimeAsync(5_000)

      expect(status.setActiveSockets).toHaveBeenCalledWith(2)
      expect(status.snapshot).toHaveBeenCalledTimes(1)
      expect(status.publish).toHaveBeenCalledWith(server, expect.objectContaining({ timestamp: expect.any(String) }))
    } finally {
      gateway.onModuleDestroy()
      jest.useRealTimers()
    }
  })

  it('tracks the live socket count on connect and disconnect', () => {
    const status = statusMock()
    const gateway = makeGateway({}, {}, status)
    const server = makeServer()
    let disconnect: (() => void) | undefined
    const socket = { on: jest.fn((_event: string, handler: () => void) => (disconnect = handler)) }

    gateway.afterInit(server as never)
    const connection = server.on.mock.calls.find(([event]) => event === 'connection')?.[1] as (socket: unknown) => void
    connection(socket)
    expect(status.setActiveSockets).toHaveBeenLastCalledWith(2)

    server.sockets.size = 1
    disconnect?.()
    expect(status.setActiveSockets).toHaveBeenLastCalledWith(1)
    expect(server.emit).not.toHaveBeenCalledWith(SERVER_METRICS_EVENT, expect.anything())

    gateway.onModuleDestroy()
    expect(server.off).toHaveBeenCalledWith('connection', expect.any(Function))
  })

  it('attaches the AI stream to the Socket.IO server', () => {
    const stream = aiStreamMock()
    const gateway = makeGateway({}, {}, statusMock(), stream)
    const server = makeServer()

    gateway.afterInit(server as never)
    expect(stream.attach).toHaveBeenCalledWith(server)
    gateway.onModuleDestroy()
  })

  it('joins an AI thread room after ownership validation', async () => {
    const user = { id: 'teacher-1', role: 'teacher' }
    const sessions = { authenticate: jest.fn().mockResolvedValue(user) }
    const chat = aiChatMock()
    const gateway = makeGateway(sessions, {}, statusMock(), aiStreamMock(), chat)
    const socket = {
      data: {},
      handshake: { headers: {}, auth: {} },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    }

    await expect(gateway.joinAiThread(socket as never, { threadId: 'thread-1' })).resolves.toEqual({
      event: AI_THREAD_JOINED_EVENT,
      data: { threadId: 'thread-1' },
    })
    expect(chat.assertThreadAccess).toHaveBeenCalledWith('thread-1', user)
    expect(socket.join).toHaveBeenCalledWith('ai:thread:thread-1')
  })

  it('denies joining another user AI thread', async () => {
    const sessions = { authenticate: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher' }) }
    const chat = { assertThreadAccess: jest.fn().mockRejectedValue(new WsException('You cannot access this thread')) }
    const gateway = makeGateway(sessions, {}, statusMock(), aiStreamMock(), chat)
    const socket = { data: {}, handshake: { headers: {}, auth: {} }, join: jest.fn() }

    await expect(gateway.joinAiThread(socket as never, { threadId: 'thread-1' })).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('leaves an AI thread room', async () => {
    const gateway = makeGateway({}, {}, statusMock())
    const socket = { leave: jest.fn().mockResolvedValue(undefined) }

    await expect(gateway.leaveAiThread(socket as never, { threadId: 'thread-1' })).resolves.toEqual({
      event: AI_THREAD_LEAVE_EVENT,
      data: { threadId: 'thread-1' },
    })
    expect(socket.leave).toHaveBeenCalledWith('ai:thread:thread-1')
  })

  it('rejects an AI join without a thread id', async () => {
    const gateway = makeGateway({}, {}, statusMock())
    const socket = { data: {}, handshake: { headers: {}, auth: {} }, join: jest.fn() }

    await expect(gateway.joinAiThread(socket as never, {})).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('emits notifications:new to the recipient per-user room', () => {
    const gateway = makeGateway({}, {}, statusMock())
    const server = makeServer()
    ;(gateway as unknown as { server: unknown }).server = server
    const notification = {
      id: 'notif-1',
      type: 'dispute_filed' as const,
      title: 'New attendance dispute',
      body: 'A student filed a dispute.',
      link: '/faculty/disputes',
      createdAt: '2026-10-27T00:00:00.000Z',
    }

    gateway.emitUserNotification('teacher-1', notification)

    expect(server.to).toHaveBeenCalledWith('auth:user:teacher-1')
    expect(server.to('auth:user:teacher-1').emit).toHaveBeenCalledWith('notifications:new', notification)
  })

  it('forwards persisted notification events to the user room', () => {
    const gateway = makeGateway({}, {}, statusMock())
    const server = makeServer()
    ;(gateway as unknown as { server: unknown }).server = server
    const notification = {
      id: 'notif-2',
      type: 'excuse_requested' as const,
      title: 'New excuse request',
      body: 'A student requested an excuse.',
      createdAt: '2026-10-27T00:00:00.000Z',
    }

    gateway.handleNotificationCreated({ userId: 'teacher-1', notification })

    expect(server.to).toHaveBeenCalledWith('auth:user:teacher-1')
  })

  // ── F1 kiosk presence + broadcast helpers ──

  function kioskSocket(join?: jest.Mock, leave?: jest.Mock) {
    const user = { id: 'teacher-1', role: 'teacher' }
    return {
      user,
      socket: {
        data: {},
        id: 'socket-1',
        handshake: { headers: {}, auth: {} },
        join: join ?? jest.fn(() => Promise.resolve()),
        leave: leave ?? jest.fn(() => Promise.resolve()),
      },
    }
  }

  function kioskSession() {
    return { id: 'sess-1', sectionId: 'sec-1', teacherId: 'teacher-1' }
  }

  it('joins an owning teacher to the kiosk room and reports the presence count', async () => {
    const prisma = { session: { findUnique: jest.fn().mockResolvedValue(kioskSession()) } }
    const user = { id: 'teacher-1', role: 'teacher' }
    const sessions = { authenticate: jest.fn().mockResolvedValue(user) }
    const gateway = makeGateway(sessions, prisma, statusMock())
    const { socket } = kioskSocket()
    socket.id = 'kiosk-a'

    const ack = await gateway.joinKiosk(socket as never, { sessionId: 'sess-1' })
    expect(ack).toEqual({
      event: KIOSK_JOINED_EVENT,
      data: { sessionId: 'sess-1', kioskCount: 1 },
    })
    expect(socket.join).toHaveBeenCalledWith('kiosk:sess-1')

    const second = kioskSocket()
    second.socket.id = 'kiosk-b'
    await gateway.joinKiosk(second.socket as never, { sessionId: 'sess-1' })
    expect(gateway.kioskCount('sess-1')).toBe(2)
  })

  it('denies students and foreign teachers kiosk access (attendance:anomaly and finale stay staff-only)', async () => {
    const prisma = { session: { findUnique: jest.fn().mockResolvedValue(kioskSession()) } }
    const sessions = { authenticate: jest.fn().mockResolvedValue({ id: 'student-1', role: 'student' }) }
    const gateway = makeGateway(sessions, prisma, statusMock())
    const { socket } = kioskSocket()

    await expect(gateway.joinKiosk(socket as never, { sessionId: 'sess-1' })).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()

    const foreignSessions = { authenticate: jest.fn().mockResolvedValue({ id: 'teacher-9', role: 'teacher' }) }
    const foreignGateway = makeGateway(foreignSessions, prisma, statusMock())
    const foreignSocket = kioskSocket().socket
    await expect(foreignGateway.joinKiosk(foreignSocket as never, { sessionId: 'sess-1' })).rejects.toThrow(WsException)
    expect(foreignSocket.join).not.toHaveBeenCalled()
    expect(gateway.kioskCount('sess-1')).toBe(0)
  })

  it('rejects a kiosk join without a session id', async () => {
    const gateway = makeGateway({}, {}, statusMock())
    const { socket } = kioskSocket()
    await expect(gateway.joinKiosk(socket as never, {})).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('leaves the kiosk room and decrements the per-session presence count', async () => {
    const prisma = { session: { findUnique: jest.fn().mockResolvedValue(kioskSession()) } }
    const sessions = { authenticate: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher' }) }
    const gateway = makeGateway(sessions, prisma, statusMock())
    const first = kioskSocket()
    first.socket.id = 'kiosk-a'
    const second = kioskSocket()
    second.socket.id = 'kiosk-b'
    await gateway.joinKiosk(first.socket as never, { sessionId: 'sess-1' })
    await gateway.joinKiosk(second.socket as never, { sessionId: 'sess-1' })

    const ack = await gateway.leaveKiosk(second.socket as never, { sessionId: 'sess-1' })

    expect(ack).toEqual({ event: KIOSK_LEAVE_EVENT, data: { sessionId: 'sess-1', kioskCount: 1 } })
    expect(second.socket.leave).toHaveBeenCalledWith('kiosk:sess-1')
    expect(gateway.kioskCount('sess-1')).toBe(1)
  })

  it('emits the finale and anomaly events to the session room', () => {
    const gateway = makeGateway({}, {}, statusMock())
    const server = makeServer()
    ;(gateway as unknown as { server: unknown }).server = server

    const recap: SessionFinaleSummary = {
      sessionId: 'sess-1',
      endedAt: '2026-11-02T03:30:00.000Z',
      counts: { present: 12, late: 2, absent: 1, excused: 1, incomplete: 0, disputed: 0, pending: 0 },
      capacity: 16,
    }
    gateway.emitSessionFinale({ id: 'sess-1' }, recap)
    expect(server.to).toHaveBeenCalledWith('session:sess-1')
    expect(server.to('session:sess-1').emit).toHaveBeenCalledWith(SESSION_FINALE_EVENT, recap)

    gateway.emitAttendanceAnomaly(
      { id: 'sess-1' },
      {
        sessionId: 'sess-1',
        studentId: 'stu-1',
        studentName: 'Juan Dela Cruz',
        latitude: 14.87,
        longitude: 120.999,
        distanceMeters: 124,
        geofenceRadiusMeters: 50,
        reason: 'outside_geofence',
        timestamp: '2026-11-02T03:11:00.000Z',
      },
    )
    expect(server.to('session:sess-1').emit).toHaveBeenCalledWith(ATTENDANCE_ANOMALY_EVENT, expect.anything())

    server.to.mockClear()
    server.to('session:sess-1')
    gateway.emitAttendanceUpdated({
      id: 'rec-1',
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      studentId: 'stu-1',
      studentName: 'Juan Dela Cruz',
      status: 'present',
    })
    const payload = server.to('session:sess-1').emit.mock.calls.at(-1)?.[1] as Record<string, unknown>
    // The kiosk ticker reads studentName; every legacy key stays intact.
    expect(payload).toEqual({
      recordId: 'rec-1',
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      studentId: 'stu-1',
      studentName: 'Juan Dela Cruz',
      status: 'present',
      timestamp: expect.any(String),
    })
  })
})
