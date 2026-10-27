import { Logger, type OnModuleDestroy } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import {
  AI_THREAD_JOIN_EVENT,
  AI_THREAD_JOINED_EVENT,
  AI_THREAD_LEAVE_EVENT,
  SERVER_METRICS_ROOM,
  SERVER_SUBSCRIBE_EVENT,
  SERVER_SUBSCRIBED_EVENT,
  SERVER_UNSUBSCRIBE_EVENT,
  type AppNotification,
} from '@polycheck/shared'
import type { Server, Socket } from 'socket.io'
import { NOTIFICATION_CREATED_EVENT, USER_NOTIFICATION_EVENT } from '../notifications/notification-events'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { SessionAuthenticator } from '../auth/session-authenticator.service'
import { OnEvent } from '@nestjs/event-emitter'
import { aiThreadRoom, AiStreamService } from '../ai/ai-stream.service'
import { AiChatService } from '../ai/ai-chat.service'
import { adminSectionInScope } from '../common/admin-scope'
import { SERVER_STATUS_INTERVAL_MS, ServerStatusService } from './server-status.service'

type SocketUser = RequestUser

function allowConfiguredOrigin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
  // SECURITY NOTE: Connections without an Origin header are allowed through the CORS
  // check because native mobile clients (Expo/React Native) do not send Origin headers.
  // This is safe because the afterInit middleware authenticates every WebSocket connection
  // via session token (cookie or bearer). Unauthenticated connections are rejected before
  // they can join any room or receive events. Browser-origin connections are still
  // validated against the configured CORS_ORIGINS allowlist.
  if (!origin) return callback(null, true)
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  callback(allowedOrigins.includes(origin) ? null : new Error('Origin is not allowed'), allowedOrigins.includes(origin))
}

@WebSocketGateway({
  namespace: '/attendance',
  cors: { origin: allowConfiguredOrigin, credentials: true },
})
export class AttendanceGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server

  private readonly logger = new Logger(AttendanceGateway.name)
  private metricsTimer?: NodeJS.Timeout
  private publishingMetrics = false
  private connectionListener?: (socket: Socket) => void

  constructor(
    private readonly sessions: SessionAuthenticator,
    private readonly prisma: PrismaService,
    private readonly serverStatus: ServerStatusService,
    private readonly aiStream: AiStreamService,
    private readonly aiChat: AiChatService,
  ) {}

  afterInit(server: Server) {
    this.server = server
    this.aiStream.attach(server)
    server.use(async (socket, next) => {
      try {
        socket.data.user = await this.sessions.authenticate(this.handshakeHeaders(socket))
        await socket.join(this.userRoom((socket.data.user as SocketUser).id))
        next()
      } catch {
        next(new Error('Invalid or expired token'))
      }
    })

    this.connectionListener = (socket) => {
      this.updateSocketCount()
      socket.on('disconnect', () => this.updateSocketCount())
    }
    server.on('connection', this.connectionListener)

    this.metricsTimer = setInterval(() => void this.publishServerMetrics(), SERVER_STATUS_INTERVAL_MS)
    this.metricsTimer.unref?.()
  }

  onModuleDestroy() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = undefined
    }
    if (this.server && this.connectionListener) {
      this.server.off('connection', this.connectionListener)
      this.connectionListener = undefined
    }
    this.serverStatus.setActiveSockets(0)
  }

  @SubscribeMessage('session:join')
  async joinSession(@ConnectedSocket() socket: Socket, @MessageBody() body: { sessionId?: string }) {
    const sessionId = body?.sessionId?.trim()
    if (!sessionId || sessionId.length > 128) throw new WsException('A valid sessionId is required')
    const principal = await this.sessions.authenticate(this.handshakeHeaders(socket))
    socket.data.user = principal
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, sectionId: true, teacherId: true },
    })
    if (!session) throw new WsException('Session not found')
    await this.assertSessionAccess(principal, session)
    await socket.join(this.sessionRoom(session.id))
    return { event: 'session:joined', data: { sessionId: session.id } }
  }

  @SubscribeMessage(AI_THREAD_JOIN_EVENT)
  async joinAiThread(@ConnectedSocket() socket: Socket, @MessageBody() body: { threadId?: string }) {
    const threadId = body?.threadId?.trim()
    if (!threadId || threadId.length > 128) throw new WsException('A valid threadId is required')
    const principal = await this.sessions.authenticate(this.handshakeHeaders(socket))
    socket.data.user = principal
    try {
      await this.aiChat.assertThreadAccess(threadId, principal)
    } catch (error) {
      throw new WsException(error instanceof Error ? error.message : 'You cannot access this thread')
    }
    await socket.join(aiThreadRoom(threadId))
    return { event: AI_THREAD_JOINED_EVENT, data: { threadId } }
  }

  @SubscribeMessage(AI_THREAD_LEAVE_EVENT)
  async leaveAiThread(@ConnectedSocket() socket: Socket, @MessageBody() body: { threadId?: string }) {
    const threadId = body?.threadId?.trim()
    if (!threadId || threadId.length > 128) throw new WsException('A valid threadId is required')
    await socket.leave(aiThreadRoom(threadId))
    return { event: AI_THREAD_LEAVE_EVENT, data: { threadId } }
  }

  @OnEvent('auth.session-replaced')
  handleSessionReplacement(event: { userId: string; reason?: string }) {
    const room = this.userRoom(event.userId)
    this.server.to(room).emit('auth:session-replaced', { reason: event.reason ?? 'session_revoked' })
    this.server.in(room).disconnectSockets(true)
  }

  @OnEvent(NOTIFICATION_CREATED_EVENT)
  handleNotificationCreated(event: { userId: string; notification: AppNotification }) {
    this.emitUserNotification(event.userId, event.notification)
  }

  /** Pushes a notification to every live socket of one account. */
  emitUserNotification(userId: string, notification: AppNotification) {
    if (!this.server) return
    this.server.to(this.userRoom(userId)).emit(USER_NOTIFICATION_EVENT, notification)
  }

  private async assertServerMetricsAccess(socket: Socket) {
    const principal = await this.sessions.authenticate(this.handshakeHeaders(socket))
    socket.data.user = principal
    if (principal.role !== 'super_admin') {
      throw new WsException('Only super admins can subscribe to server metrics')
    }
  }

  private updateSocketCount() {
    this.serverStatus.setActiveSockets(this.connectedSocketCount())
  }

  private connectedSocketCount(): number {
    const sockets = (this.server as unknown as { sockets?: { size?: number; sockets?: Map<string, unknown> } })?.sockets
    return sockets?.sockets?.size ?? sockets?.size ?? 0
  }

  private async publishServerMetrics() {
    if (!this.server || this.publishingMetrics) return
    this.updateSocketCount()
    if (this.serverMetricsRoomSize() === 0) return

    this.publishingMetrics = true
    try {
      const snapshot = await this.serverStatus.snapshot()
      this.serverStatus.publish(this.server, snapshot)
    } catch (error) {
      this.logger.error(`Could not publish server metrics: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.publishingMetrics = false
    }
  }

  private serverMetricsRoomSize(): number {
    const server = this.server as unknown as {
      adapter?: { rooms?: Map<string, Set<string>> }
      sockets?: { adapter?: { rooms?: Map<string, Set<string>> } }
    }
    return (
      server.adapter?.rooms?.get(SERVER_METRICS_ROOM)?.size ??
      server.sockets?.adapter?.rooms?.get(SERVER_METRICS_ROOM)?.size ??
      0
    )
  }

  private handshakeHeaders(socket: Socket) {
    const headers = new Headers()
    const cookie = socket.handshake.headers.cookie
    if (cookie) headers.set('cookie', cookie)
    const supplied = socket.handshake.auth?.token ?? socket.handshake.headers.authorization
    if (typeof supplied === 'string' && supplied) {
      headers.set('authorization', supplied.startsWith('Bearer ') ? supplied : `Bearer ${supplied}`)
    }
    return headers
  }

  private userRoom(userId: string) {
    return `auth:user:${userId}`
  }

  @SubscribeMessage('session:leave')
  async leaveSession(@ConnectedSocket() socket: Socket, @MessageBody() body: { sessionId?: string }) {
    const sessionId = body?.sessionId?.trim()
    if (!sessionId || sessionId.length > 128) throw new WsException('A valid sessionId is required')
    await socket.leave(this.sessionRoom(sessionId))
    return { event: 'session:left', data: { sessionId } }
  }

  @SubscribeMessage(SERVER_SUBSCRIBE_EVENT)
  async subscribeServerMetrics(@ConnectedSocket() socket: Socket) {
    await this.assertServerMetricsAccess(socket)
    await socket.join(SERVER_METRICS_ROOM)
    return { event: SERVER_SUBSCRIBED_EVENT, data: { intervalMs: SERVER_STATUS_INTERVAL_MS } }
  }

  @SubscribeMessage(SERVER_UNSUBSCRIBE_EVENT)
  async unsubscribeServerMetrics(@ConnectedSocket() socket: Socket) {
    await this.assertServerMetricsAccess(socket)
    await socket.leave(SERVER_METRICS_ROOM)
    return { event: SERVER_UNSUBSCRIBE_EVENT }
  }

  emitSessionState(session: { id: string; sectionId: string }, state: 'created' | 'activated' | 'ended') {
    const payload = { sessionId: session.id, sectionId: session.sectionId, state, timestamp: new Date().toISOString() }
    this.server.to(this.sessionRoom(session.id)).emit('session:state', payload)
  }

  emitAttendanceUpdated(record: {
    id: string
    sessionId: string
    sectionId: string
    studentId: string
    status: string
  }) {
    this.server.to(this.sessionRoom(record.sessionId)).emit('attendance:updated', {
      recordId: record.id,
      sessionId: record.sessionId,
      sectionId: record.sectionId,
      studentId: record.studentId,
      status: record.status,
      timestamp: new Date().toISOString(),
    })
  }

  private async assertSessionAccess(user: SocketUser, session: { sectionId: string; teacherId: string }) {
    if (user.role === 'super_admin') {
      if (await adminSectionInScope(user, session.sectionId, this.prisma)) return
    }
    if (user.role === 'teacher' && session.teacherId === user.id) return
    // Students intentionally cannot join roster rooms: attendance updates contain classmates' identifiers.
    throw new WsException('You cannot access this session')
  }

  private sessionRoom(sessionId: string) {
    return `session:${sessionId}`
  }
}
