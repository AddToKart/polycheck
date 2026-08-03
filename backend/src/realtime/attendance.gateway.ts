import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { SessionAuthenticator } from '../auth/session-authenticator.service'
import { OnEvent } from '@nestjs/event-emitter'
import { adminSectionInScope } from '../common/admin-scope'

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
export class AttendanceGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server

  constructor(
    private readonly sessions: SessionAuthenticator,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        socket.data.user = await this.sessions.authenticate(this.handshakeHeaders(socket))
        await socket.join(this.userRoom((socket.data.user as SocketUser).id))
        next()
      } catch {
        next(new Error('Invalid or expired token'))
      }
    })
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

  @OnEvent('auth.session-replaced')
  handleSessionReplacement(event: { userId: string; reason?: string }) {
    const room = this.userRoom(event.userId)
    this.server.to(room).emit('auth:session-replaced', { reason: event.reason ?? 'session_revoked' })
    this.server.in(room).disconnectSockets(true)
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
