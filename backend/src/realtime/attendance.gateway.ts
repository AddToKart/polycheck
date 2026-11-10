import { Logger, Optional, type OnModuleDestroy } from '@nestjs/common'
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
  ATTENDANCE_ANOMALY_EVENT,
  KIOSK_JOIN_EVENT,
  KIOSK_JOINED_EVENT,
  KIOSK_LEAVE_EVENT,
  SESSION_FINALE_EVENT,
  SERVER_METRICS_ROOM,
  SERVER_SUBSCRIBE_EVENT,
  SERVER_SUBSCRIBED_EVENT,
  SERVER_UNSUBSCRIBE_EVENT,
  isMaintenanceExempt,
  type AppNotification,
  type AttendanceAnomalyEvent,
  type SessionFinaleSummary,
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
import { SystemMaintenanceService } from '../maintenance-mode/system-maintenance.service'

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
  /** Projector-kiosk presence per session (single-digit kiosks; in-memory is fine). */
  private readonly kioskViewers = new Map<string, Set<string>>()

  constructor(
    private readonly sessions: SessionAuthenticator,
    private readonly prisma: PrismaService,
    private readonly serverStatus: ServerStatusService,
    private readonly aiStream: AiStreamService,
    private readonly aiChat: AiChatService,
    @Optional() private readonly maintenance?: SystemMaintenanceService,
  ) {}

  afterInit(server: Server) {
    this.server = server
    this.aiStream.attach(server)
    server.use(async (socket, next) => {
      try {
        socket.data.user = await this.sessions.authenticate(this.handshakeHeaders(socket))
        const principal = socket.data.user as SocketUser
        // Maintenance mode closes realtime for regular users and students; the
        // handshake is the only place a socket can be rejected before it joins
        // any room. Exempt staff (super admins, IT coordinators) stay connected.
        if (this.maintenance) {
          const status = await this.maintenance.current()
          if (status.enabled && !isMaintenanceExempt(principal)) {
            return next(new Error('system_maintenance'))
          }
        }
        await socket.join(this.userRoom(principal.id))
        next()
      } catch {
        next(new Error('Invalid or expired token'))
      }
    })

    this.connectionListener = (socket) => {
      this.updateSocketCount()
      socket.on('disconnect', () => {
        this.updateSocketCount()
        this.removeKioskPresence(socket.id)
      })
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
    const allowed =
      principal.role === 'super_admin' || (principal.role === 'teacher' && principal.isItCoordinator === true)
    if (!allowed) {
      throw new WsException('Only super admins and IT coordinators can subscribe to server metrics')
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

  /**
   * F1 projector-kiosk presence handshake. Session-scoped access (same
   * `assertSessionAccess` as roster rooms); the kiosk room is tracked so the
   * cockpit can show an at-a-glance presence count without a publisher loop.
   */
  @SubscribeMessage(KIOSK_JOIN_EVENT)
  async joinKiosk(@ConnectedSocket() socket: Socket, @MessageBody() body: { sessionId?: string }) {
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
    await socket.join(this.kioskRoom(session.id))
    const viewers = this.kioskViewers.get(session.id) ?? new Set<string>()
    viewers.add(socket.id)
    this.kioskViewers.set(session.id, viewers)
    return { event: KIOSK_JOINED_EVENT, data: { sessionId: session.id, kioskCount: viewers.size } }
  }

  @SubscribeMessage(KIOSK_LEAVE_EVENT)
  async leaveKiosk(@ConnectedSocket() socket: Socket, @MessageBody() body: { sessionId?: string }) {
    const sessionId = body?.sessionId?.trim()
    if (!sessionId || sessionId.length > 128) throw new WsException('A valid sessionId is required')
    await socket.leave(this.kioskRoom(sessionId))
    this.removeKioskPresence(socket.id, sessionId)
    return { event: KIOSK_LEAVE_EVENT, data: { sessionId, kioskCount: this.kioskCount(sessionId) } }
  }

  /** Live kiosk viewer count for one session room (0 after the last disconnect). */
  kioskCount(sessionId: string): number {
    return this.kioskViewers.get(sessionId)?.size ?? 0
  }

  private removeKioskPresence(socketId: string, sessionId?: string) {
    if (sessionId) {
      const viewers = this.kioskViewers.get(sessionId)
      if (viewers?.delete(socketId) && viewers.size === 0) this.kioskViewers.delete(sessionId)
      return
    }
    for (const [id, viewers] of this.kioskViewers) {
      if (viewers.delete(socketId) && viewers.size === 0) this.kioskViewers.delete(id)
    }
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
    studentName?: string
  }) {
    this.server.to(this.sessionRoom(record.sessionId)).emit('attendance:updated', {
      recordId: record.id,
      sessionId: record.sessionId,
      sectionId: record.sectionId,
      studentId: record.studentId,
      // Additive enrichment (F1 kiosk ticker): existing listeners keep working.
      studentName: record.studentName,
      status: record.status,
      timestamp: new Date().toISOString(),
    })
  }

  /** F2 radar: a denied in-person scan with coordinates, broadcast to the session room. */
  emitAttendanceAnomaly(session: { id: string }, payload: AttendanceAnomalyEvent) {
    if (!this.server) return
    this.server.to(this.sessionRoom(session.id)).emit(ATTENDANCE_ANOMALY_EVENT, payload)
  }

  /**
   * F1: the authoritative end-of-class broadcast. `end()` and the auto-end cron
   * both call this once after their resolution commit; `endedAt` lets clients
   * dedupe repeated deliveries.
   */
  emitSessionFinale(session: { id: string }, summary: SessionFinaleSummary) {
    if (!this.server) return
    this.server.to(this.sessionRoom(session.id)).emit(SESSION_FINALE_EVENT, summary)
  }

  private kioskRoom(sessionId: string) {
    return `kiosk:${sessionId}`
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
