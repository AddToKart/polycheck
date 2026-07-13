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

type SocketUser = RequestUser & { email?: string; studentId?: string }

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin))

@WebSocketGateway({
  namespace: '/attendance',
  cors: { origin: allowedOrigins, credentials: true },
})
export class AttendanceGateway implements OnGatewayInit {
  @WebSocketServer() server: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const authHeader = socket.handshake.headers.authorization
        const supplied = socket.handshake.auth?.token ?? authHeader
        const token = typeof supplied === 'string' ? supplied.replace(/^Bearer\s+/i, '') : ''
        if (!token) return next(new Error('Authentication required'))

        const payload = await this.jwt.verifyAsync<{ sub: string; role: string; email?: string; studentId?: string; sessionVersion: number }>(token)
        const account = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isActive: true, authVersion: true } })
        if (!account?.isActive || account.authVersion !== payload.sessionVersion) return next(new Error('Session was replaced or the account is inactive'))

        socket.data.user = {
          id: payload.sub,
          role: payload.role,
          email: payload.email,
          studentId: payload.studentId,
        } satisfies SocketUser
        next()
      } catch {
        next(new Error('Invalid or expired token'))
      }
    })
  }

  @SubscribeMessage('session:join')
  async joinSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { sessionId?: string },
  ) {
    const sessionId = body?.sessionId?.trim()
    if (!sessionId) throw new WsException('sessionId is required')
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { id: true, sectionId: true, teacherId: true } })
    if (!session) throw new WsException('Session not found')
    await this.assertSessionAccess(socket.data.user as SocketUser, session)
    await socket.join(this.sessionRoom(session.id))
    await socket.join(this.sectionRoom(session.sectionId))
    return { event: 'session:joined', data: { sessionId: session.id } }
  }

  @SubscribeMessage('session:leave')
  async leaveSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { sessionId?: string },
  ) {
    const sessionId = body?.sessionId?.trim()
    if (!sessionId) throw new WsException('sessionId is required')
    await socket.leave(this.sessionRoom(sessionId))
    return { event: 'session:left', data: { sessionId } }
  }

  emitSessionState(session: { id: string; sectionId: string }, state: 'created' | 'activated' | 'ended') {
    const payload = { sessionId: session.id, sectionId: session.sectionId, state, timestamp: new Date().toISOString() }
    this.server.to(this.sessionRoom(session.id)).to(this.sectionRoom(session.sectionId)).emit('session:state', payload)
  }

  emitAttendanceUpdated(record: { id: string; sessionId: string; sectionId: string; studentId: string; status: string }) {
    this.server.to(this.sessionRoom(record.sessionId)).to(this.sectionRoom(record.sectionId)).emit('attendance:updated', {
      recordId: record.id,
      sessionId: record.sessionId,
      sectionId: record.sectionId,
      studentId: record.studentId,
      status: record.status,
      timestamp: new Date().toISOString(),
    })
  }

  private async assertSessionAccess(user: SocketUser, session: { sectionId: string; teacherId: string }) {
    if (user.role === 'super_admin') return
    if (user.role === 'teacher' && session.teacherId === user.id) return
    if (user.role === 'student') {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: user.id, sectionId: session.sectionId } },
        select: { id: true },
      })
      if (enrollment) return
    }
    throw new WsException('You cannot access this session')
  }

  private sessionRoom(sessionId: string) { return `session:${sessionId}` }
  private sectionRoom(sectionId: string) { return `section:${sectionId}` }
}
