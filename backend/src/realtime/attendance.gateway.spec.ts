import { WsException } from '@nestjs/websockets'
import {
  SERVER_METRICS_EVENT,
  SERVER_METRICS_ROOM,
  SERVER_SUBSCRIBED_EVENT,
  SERVER_UNSUBSCRIBE_EVENT,
} from '@polycheck/shared'
import { AttendanceGateway } from './attendance.gateway'

const statusMock = () => ({
  setActiveSockets: jest.fn(),
  snapshot: jest.fn().mockResolvedValue({ timestamp: '2026-10-26T00:00:00.000Z' }),
  publish: jest.fn(),
})

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
    const gateway = new AttendanceGateway(sessions as never, prisma as never, statusMock() as never)
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
    const gateway = new AttendanceGateway(sessions as never, prisma as never, statusMock() as never)
    const socket = { data: { user }, handshake: { headers: {}, auth: {} }, join: jest.fn() }

    await gateway.joinSession(socket as never, { sessionId: 'session-1' })

    expect(socket.join).toHaveBeenCalledTimes(1)
    expect(socket.join).toHaveBeenCalledWith('session:session-1')
  })

  it.each(['teacher', 'student'])('denies %s subscriptions to server metrics', async (role) => {
    const sessions = { authenticate: jest.fn().mockResolvedValue({ id: `${role}-1`, role }) }
    const gateway = new AttendanceGateway(sessions as never, {} as never, statusMock() as never)
    const socket = { data: {}, handshake: { headers: {}, auth: {} }, join: jest.fn(), leave: jest.fn() }

    await expect(gateway.subscribeServerMetrics(socket as never)).rejects.toThrow(WsException)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('joins super admins to the server metrics room and reports the cadence', async () => {
    const sessions = {
      authenticate: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'super_admin', scope: 'institution' }),
    }
    const gateway = new AttendanceGateway(sessions as never, {} as never, statusMock() as never)
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
    const gateway = new AttendanceGateway({} as never, {} as never, status as never)
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
    const gateway = new AttendanceGateway({} as never, {} as never, status as never)
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
    const gateway = new AttendanceGateway({} as never, {} as never, status as never)
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
})
