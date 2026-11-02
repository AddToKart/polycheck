import { beforeEach, describe, expect, it, vi } from 'vitest'

const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, (payload?: unknown) => void>()
  return {
    handlers,
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => { handlers.set(event, handler) }),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  }
})
const ioMock = vi.hoisted(() => vi.fn(() => socketMock))
const apiMock = vi.hoisted(() => ({ hasCurrentUser: vi.fn(() => true) }))

vi.mock('socket.io-client', () => ({ io: ioMock }))
vi.mock('./api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))
vi.mock('./api-client', () => ({ api: apiMock }))

import {
  monitorAuthSession,
  subscribeToAiThread,
  subscribeToNotifications,
  subscribeToServerStatus,
  subscribeToSession,
} from './realtime'

describe('session realtime subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    socketMock.handlers.clear()
    apiMock.hasCurrentUser.mockReturnValue(true)
  })

  it('uses WebSocket-only transport when WebSocket is available', () => {
    subscribeToSession('session-1', vi.fn())

    expect(ioMock).toHaveBeenCalledWith(
      'https://api.polycheck.test/attendance',
      expect.objectContaining({ transports: ['websocket'] }),
    )
  })

  it('keeps fallback polling enabled until the authorized room join is acknowledged', () => {
    const onConnectionChange = vi.fn()
    subscribeToSession('session-1', vi.fn(), onConnectionChange)

    socketMock.handlers.get('connect')?.()
    expect(socketMock.emit).toHaveBeenCalledWith('session:join', { sessionId: 'session-1' })
    expect(onConnectionChange).toHaveBeenLastCalledWith(false)

    socketMock.handlers.get('session:joined')?.({ sessionId: 'another-session' })
    expect(onConnectionChange).not.toHaveBeenCalledWith(true)

    socketMock.handlers.get('session:joined')?.({ sessionId: 'session-1' })
    expect(onConnectionChange).toHaveBeenLastCalledWith(true)
  })

  it('does not enable unsafe polling when WebSocket is unavailable', () => {
    const original = window.WebSocket
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: undefined })
    try {
      subscribeToSession('session-1', vi.fn())
      expect(ioMock).toHaveBeenCalledWith(
        'https://api.polycheck.test/attendance',
        expect.objectContaining({ transports: ['websocket'] }),
      )
    } finally {
      Object.defineProperty(window, 'WebSocket', { configurable: true, value: original })
    }
  })

  it('joins the server-metrics room and only reports live after the ack', () => {
    const onSnapshot = vi.fn()
    const onConnectionChange = vi.fn()
    const stop = subscribeToServerStatus(onSnapshot, onConnectionChange)

    expect(ioMock).toHaveBeenCalledWith(
      'https://api.polycheck.test/attendance',
      expect.objectContaining({ transports: ['websocket'] }),
    )

    socketMock.handlers.get('connect')?.()
    expect(socketMock.emit).toHaveBeenCalledWith('server:subscribe')
    expect(onConnectionChange).toHaveBeenLastCalledWith(false)

    const snapshot = { timestamp: '2026-10-26T02:30:00.000Z', httpRequestsTotal: 10 }
    socketMock.handlers.get('server:metrics')?.(snapshot)
    expect(onSnapshot).toHaveBeenCalledWith(snapshot)

    socketMock.handlers.get('server:subscribed')?.()
    expect(onConnectionChange).toHaveBeenLastCalledWith(true)

    socketMock.handlers.get('disconnect')?.()
    expect(onConnectionChange).toHaveBeenLastCalledWith(false)

    stop()
    expect(socketMock.emit).toHaveBeenCalledWith('server:unsubscribe')
    expect(socketMock.removeAllListeners).toHaveBeenCalled()
    expect(socketMock.disconnect).toHaveBeenCalled()
  })

  it('joins an assistant thread room, forwards its stream, and leaves on cleanup', () => {
    const onEvent = vi.fn()
    const onJoined = vi.fn()
    const stop = subscribeToAiThread('thread-1', onEvent, onJoined)

    expect(ioMock).toHaveBeenCalledWith(
      'https://api.polycheck.test/attendance',
      expect.objectContaining({ transports: ['websocket'], withCredentials: true }),
    )

    socketMock.handlers.get('connect')?.()
    expect(socketMock.emit).toHaveBeenCalledWith('ai:thread:join', { threadId: 'thread-1' })
    expect(onJoined).toHaveBeenLastCalledWith(false)

    socketMock.handlers.get('ai:thread:joined')?.({ threadId: 'thread-1' })
    expect(onJoined).toHaveBeenLastCalledWith(true)

    const delta = { type: 'delta', threadId: 'thread-1', messageId: 'message-1', text: 'Hello' }
    socketMock.handlers.get('ai:thread:stream')?.(delta)
    expect(onEvent).toHaveBeenCalledWith(delta)

    socketMock.handlers.get('ai:thread:stream')?.({ ...delta, threadId: 'thread-2' })
    expect(onEvent).toHaveBeenCalledTimes(1)

    socketMock.handlers.get('disconnect')?.()
    expect(onJoined).toHaveBeenLastCalledWith(false)

    stop()
    expect(socketMock.emit).toHaveBeenCalledWith('ai:thread:leave', { threadId: 'thread-1' })
    expect(socketMock.removeAllListeners).toHaveBeenCalled()
    expect(socketMock.disconnect).toHaveBeenCalled()
  })

  it('delivers per-user notification events without an explicit room join', () => {
    const onNotification = vi.fn()
    const stop = subscribeToNotifications(onNotification)

    expect(ioMock).toHaveBeenCalledWith(
      'https://api.polycheck.test/attendance',
      expect.objectContaining({ transports: ['websocket'], withCredentials: true }),
    )
    expect(socketMock.emit).not.toHaveBeenCalled()

    const notification = {
      id: 'notification-1',
      type: 'excuse_requested',
      title: 'New excuse request',
      body: 'A student filed an excuse.',
      link: '/faculty/excuses',
      createdAt: '2026-10-27T08:00:00.000Z',
    }
    socketMock.handlers.get('notifications:new')?.(notification)
    expect(onNotification).toHaveBeenCalledWith(notification)

    socketMock.handlers.get('notifications:new')?.({ title: 'Missing id' })
    expect(onNotification).toHaveBeenCalledTimes(1)

    stop()
    expect(socketMock.removeAllListeners).toHaveBeenCalled()
    expect(socketMock.disconnect).toHaveBeenCalled()
  })

  it('monitors auth replacement from in-memory auth when localStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })

    const onReplaced = vi.fn()
    const stop = monitorAuthSession(onReplaced)

    expect(apiMock.hasCurrentUser).toHaveBeenCalled()
    expect(ioMock).toHaveBeenCalledWith(
      'https://api.polycheck.test/attendance',
      expect.objectContaining({ transports: ['websocket'] }),
    )
    socketMock.handlers.get('auth:session-replaced')?.()
    expect(onReplaced).toHaveBeenCalledTimes(1)

    stop()
    vi.restoreAllMocks()
  })
})
