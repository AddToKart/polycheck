import { io } from 'socket.io-client'
import { API_BASE } from './api-config'
import { api } from './api-client'

function realtimeUrl() {
  if (API_BASE.startsWith('/')) return `${window.location.origin}/attendance`
  return `${new URL(API_BASE).origin}/attendance`
}

// Polling is intentionally never enabled: its multi-request Socket.IO
// handshake is unsafe across replicas without load-balancer stickiness. When a
// proxy blocks WebSocket upgrades, SessionGuard's independent HTTP validation
// remains the bounded fallback for detecting revoked/replaced auth sessions.
const realtimeTransports = (): ('websocket')[] => ['websocket']

export function subscribeToSession(
  sessionId: string,
  onUpdate: () => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  if (typeof window === 'undefined') return () => undefined
  const socket = io(realtimeUrl(), {
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1_000,
    timeout: 8_000,
    transports: realtimeTransports(),
  })

  socket.on('connect', () => {
    // A transport connection is not proof that the authorized session room
    // join completed. Keep fallback polling enabled until the gateway's
    // session:joined handshake arrives.
    onConnectionChange?.(false)
    socket.emit('session:join', { sessionId })
  })
  socket.on('session:joined', (payload: { sessionId?: string }) => {
    if (payload?.sessionId === sessionId) onConnectionChange?.(true)
  })
  socket.on('disconnect', () => onConnectionChange?.(false))
  socket.on('connect_error', () => onConnectionChange?.(false))
  socket.on('session:state', onUpdate)
  socket.on('attendance:updated', onUpdate)

  return () => {
    socket.emit('session:leave', { sessionId })
    socket.removeAllListeners()
    socket.disconnect()
  }
}

export function monitorAuthSession(onReplaced: () => void) {
  if (typeof window === 'undefined') return () => undefined
  let socket: ReturnType<typeof io> | null = null

  const connect = () => {
    if (!api.hasCurrentUser()) {
      socket?.removeAllListeners()
      socket?.disconnect()
      socket = null
      return
    }
    if (socket) return
    socket = io(realtimeUrl(), {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      timeout: 8_000,
      transports: realtimeTransports(),
    })
    socket.on('auth:session-replaced', onReplaced)
  }

  connect()
  window.addEventListener('polycheck-auth-changed', connect)
  return () => {
    window.removeEventListener('polycheck-auth-changed', connect)
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}
