import { io, type Socket } from 'socket.io-client'
import * as SecureStore from 'expo-secure-store'
import {
  AI_THREAD_JOINED_EVENT,
  AI_THREAD_JOIN_EVENT,
  AI_THREAD_LEAVE_EVENT,
  AI_THREAD_STREAM_EVENT,
  type AiStreamEvent,
  type AppNotification,
} from '@polycheck/shared'
import { API_BASE } from './api-config'

const TOKEN_KEY = 'polycheck-token'
const REALTIME_URL = `${API_BASE.replace(/\/api\/?$/, '')}/attendance`
export const NOTIFICATION_EVENT = 'notifications:new'

export function subscribeToSession(
  sessionId: string,
  onUpdate: () => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  let disposed = false
  let socket: Socket | null = null

  void SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
    if (!token || disposed) return
    socket = io(REALTIME_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      timeout: 8_000,
    })
    socket.on('connect', () => {
      onConnectionChange?.(true)
      socket?.emit('session:join', { sessionId })
    })
    socket.on('disconnect', () => onConnectionChange?.(false))
    socket.on('connect_error', () => onConnectionChange?.(false))
    socket.on('session:state', onUpdate)
    socket.on('attendance:updated', onUpdate)
  })

  return () => {
    disposed = true
    socket?.emit('session:leave', { sessionId })
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}

/**
 * Subscribes to one assistant thread's streamed reply. Mirrors the web
 * contract: join on (re)connect, forward deltas/done/error for this thread,
 * and leave on cleanup. Returns an unsubscribe function.
 */
export function subscribeToAiThread(
  threadId: string,
  onEvent: (event: AiStreamEvent) => void,
  onJoined?: (joined: boolean) => void,
) {
  let disposed = false
  let socket: Socket | null = null

  void SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
    if (!token || disposed) return
    socket = io(REALTIME_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      timeout: 8_000,
    })
    socket.on('connect', () => {
      onJoined?.(false)
      socket?.emit(AI_THREAD_JOIN_EVENT, { threadId })
    })
    socket.on(AI_THREAD_JOINED_EVENT, (payload: { threadId?: string }) => {
      if (payload?.threadId === threadId) onJoined?.(true)
    })
    socket.on(AI_THREAD_STREAM_EVENT, (event: AiStreamEvent) => {
      if (event?.threadId === threadId) onEvent(event)
    })
    socket.on(AI_THREAD_LEAVE_EVENT, (payload: { threadId?: string }) => {
      if (payload?.threadId === threadId) onJoined?.(false)
    })
    socket.on('disconnect', () => onJoined?.(false))
    socket.on('connect_error', () => onJoined?.(false))
  })

  return () => {
    disposed = true
    socket?.emit(AI_THREAD_LEAVE_EVENT, { threadId })
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}

/**
 * Subscribes to the current user's notification room. The gateway joins every
 * authenticated socket to its own `auth:user:<id>` room, so no explicit join
 * payload is required. Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  onNotification: (notification: AppNotification) => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  let disposed = false
  let socket: Socket | null = null

  void SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
    if (!token || disposed) return
    socket = io(REALTIME_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      timeout: 8_000,
    })
    socket.on('connect', () => onConnectionChange?.(true))
    socket.on('disconnect', () => onConnectionChange?.(false))
    socket.on('connect_error', () => onConnectionChange?.(false))
    socket.on(NOTIFICATION_EVENT, (notification: AppNotification) => {
      if (!disposed && notification?.id) onNotification(notification)
    })
  })

  return () => {
    disposed = true
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}

export function monitorAuthSession(onReplaced: () => void) {
  let disposed = false
  let socket: Socket | null = null

  void SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
    if (!token || disposed) return
    socket = io(REALTIME_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      timeout: 8_000,
    })
    socket.on('auth:session-replaced', onReplaced)
  })

  return () => {
    disposed = true
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}
