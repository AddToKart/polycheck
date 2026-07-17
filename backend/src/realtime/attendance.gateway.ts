import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import type { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

type SocketUser = RequestUser

function allowConfiguredOrigin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
  // Native clients do not send an Origin header. Browser origins must be explicitly allow-listed.
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
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const authHeader = socket.handshake.headers.authorization
        const cookieToken = socket.handshake.headers.cookie
          ?.split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith('polycheck_access='))
          ?.slice('polycheck_access='.length)
        const supplied = socket.handshake.auth?.token ?? authHeader ?? cookieToken
        const token = typeof supplied === 'string' ? supplied.replace(/^Bearer\s+/i, '') : ''
        if (!token) return next(new Error('Authentication required'))

        const payload = await this.jwt.verifyAsync<{
          sub: string
          sessionVersion: number
        }>(token)
        const account = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            isActive: true,
            authVersion: true,
            role: true,
            email: true,
            studentId: true,
            department: true,
            scope: true,
          },
        })
        if (!account?.isActive || account.authVersion !== payload.sessionVersion)
          return next(new Error('Session was replaced or the account is inactive'))

        socket.data.user = {
          id: payload.sub,
          role: account.role,
          email: account.email,
          studentId: account.studentId,
          department: account.department,
          scope: account.scope,
        } satisfies SocketUser
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
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, sectionId: true, teacherId: true },
    })
    if (!session) throw new WsException('Session not found')
    await this.assertSessionAccess(socket.data.user as SocketUser, session)
    await socket.join(this.sessionRoom(session.id))
    return { event: 'session:joined', data: { sessionId: session.id } }
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
      if (user.scope === 'institution') return
      const allowed = await this.prisma.section.findFirst({
        where: { id: session.sectionId, teacher: { department: user.department ?? '__no_department__' } },
        select: { id: true },
      })
      if (allowed) return
    }
    if (user.role === 'teacher' && session.teacherId === user.id) return
    // Students intentionally cannot join roster rooms: attendance updates contain classmates' identifiers.
    throw new WsException('You cannot access this session')
  }

  private sessionRoom(sessionId: string) {
    return `session:${sessionId}`
  }
}
