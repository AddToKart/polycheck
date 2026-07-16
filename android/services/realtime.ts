import { io, type Socket } from 'socket.io-client'
import * as SecureStore from 'expo-secure-store'
import { API_BASE } from './api-config'

const TOKEN_KEY = 'polycheck-token'
const REALTIME_URL = `${API_BASE.replace(/\/api\/?$/, '')}/attendance`

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
