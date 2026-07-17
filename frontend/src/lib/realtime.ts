import { io } from 'socket.io-client'
import { API_BASE } from './api-config'

function realtimeUrl() {
  if (API_BASE.startsWith('/')) return `${window.location.origin}/attendance`
  return `${new URL(API_BASE).origin}/attendance`
}

export function subscribeToSession(
  sessionId: string,
  onUpdate: () => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  if (typeof window === 'undefined') return () => undefined
  const socket = io(realtimeUrl(), {
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1_000,
    timeout: 8_000,
  })

  socket.on('connect', () => {
    onConnectionChange?.(true)
    socket.emit('session:join', { sessionId })
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
