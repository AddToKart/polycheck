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

import { monitorAuthSession, subscribeToSession } from './realtime'

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
