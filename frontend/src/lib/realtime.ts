import { io } from 'socket.io-client'
import {
  AI_THREAD_JOIN_EVENT,
  AI_THREAD_JOINED_EVENT,
  AI_THREAD_LEAVE_EVENT,
  AI_THREAD_STREAM_EVENT,
  SERVER_METRICS_EVENT,
  SERVER_SUBSCRIBE_EVENT,
  SERVER_SUBSCRIBED_EVENT,
  SERVER_UNSUBSCRIBE_EVENT,
  type AiStreamEvent,
  type AppNotification,
  type ServerStatusSnapshot,
} from '@polycheck/shared'
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

/**
 * Super-admin server metrics stream (SA7). The backend publishes one snapshot
 * per 5 s tick to the `server:metrics` room while at least one admin is
 * subscribed. `server:subscribed` is the room-join acknowledgement — a raw
 * transport connect is not enough to mark the view as live.
 */
export function subscribeToServerStatus(
  onSnapshot: (snapshot: ServerStatusSnapshot) => void,
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
    onConnectionChange?.(false)
    socket.emit(SERVER_SUBSCRIBE_EVENT)
  })
  socket.on(SERVER_SUBSCRIBED_EVENT, () => onConnectionChange?.(true))
  socket.on(SERVER_METRICS_EVENT, onSnapshot)
  socket.on('disconnect', () => onConnectionChange?.(false))
  socket.on('connect_error', () => onConnectionChange?.(false))

  return () => {
    socket.emit(SERVER_UNSUBSCRIBE_EVENT)
    socket.removeAllListeners()
    socket.disconnect()
  }
}

/**
 * Assistant thread stream (AI2/AI3). The server fans out deltas, the final
 * message, and run errors to the thread room. `ai:thread:joined` is the room
 * acknowledgement — a transport connect alone is not enough to start waiting
 * for a reply.
 */
export function subscribeToAiThread(
  threadId: string,
  onEvent: (event: AiStreamEvent) => void,
  onJoined?: (joined: boolean) => void,
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
    onJoined?.(false)
    socket.emit(AI_THREAD_JOIN_EVENT, { threadId })
  })
  socket.on(AI_THREAD_JOINED_EVENT, (payload: { threadId?: string }) => {
    if (payload?.threadId === threadId) onJoined?.(true)
  })
  socket.on(AI_THREAD_STREAM_EVENT, (event: AiStreamEvent) => {
    if (event?.threadId === threadId) onEvent(event)
  })
  socket.on('disconnect', () => onJoined?.(false))
  socket.on('connect_error', () => onJoined?.(false))

  return () => {
    socket.emit(AI_THREAD_LEAVE_EVENT, { threadId })
    socket.removeAllListeners()
    socket.disconnect()
  }
}

export const NOTIFICATIONS_NEW_EVENT = 'notifications:new'

/**
 * Per-user notification fan-out (NF3). The gateway joins authenticated sockets
 * to their own room on connect, so no explicit subscribe/join is required.
 */
export function subscribeToNotifications(
  onNotification: (notification: AppNotification) => void,
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

  socket.on(NOTIFICATIONS_NEW_EVENT, (notification: AppNotification) => {
    if (notification?.id) onNotification(notification)
  })

  return () => {
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
