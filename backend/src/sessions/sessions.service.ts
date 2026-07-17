import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { verifyQRToken } from '@polycheck/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { ActivateSessionDto, CreateBulkSessionsDto, CreateSessionDto } from './dto/create-session.dto'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import { RedisService } from '../infrastructure/redis.service'
import type { Session } from '@prisma/client'

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AttendanceGateway,
    private readonly redis: RedisService,
  ) {}

  async findAll(user: RequestUser, sectionId?: string) {
    const where = await this.sessionScope(user, sectionId)
    const sessions = await this.prisma.session.findMany({
      where,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    })
    return this.presentMany(sessions, user)
  }

  async findPage(user: RequestUser, sectionId: string | undefined, pagination: { limit: number; offset: number }) {
    const where = await this.sessionScope(user, sectionId)
    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.session.count({ where }),
    ])
    return {
      data: await this.presentMany(sessions, user),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + sessions.length < total,
    }
  }

  async findOne(id: string, user: RequestUser) {
    const session = await this.prisma.session.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session not found')
    await this.assertAccess(session.sectionId, user, session.teacherId)
    return this.present(session, await this.teacherPublicKey(session.teacherId), user.role === 'teacher')
  }

  async create(dto: CreateSessionDto, user: RequestUser) {
    const { teacherId, subjectName } = await this.authorizeCreator(dto.sectionId, user)
    this.assertTimeRange(dto.startTime, dto.endTime)
    const { geofence, subjectName: _ignoredSubjectName, ...data } = dto
    const session = await this.prisma.session.create({
      data: {
        ...data,
        subjectName,
        teacherId,
        geofenceLatitude: geofence.latitude,
        geofenceLongitude: geofence.longitude,
        geofenceRadiusMeters: geofence.radiusMeters,
      },
    })
    this.realtime.emitSessionState(session, 'created')
    return this.present(session, await this.teacherPublicKey(teacherId), user.role !== 'student')
  }

  async createBulk(dto: CreateBulkSessionsDto, user: RequestUser) {
    const section = await this.assertTeacherOwnsSection(dto.sectionId, user.id)
    this.assertTimeRange(dto.startTime, dto.endTime)
    const start = new Date(`${dto.startDate}T00:00:00.000Z`)
    const end = new Date(`${dto.endDate}T00:00:00.000Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new BadRequestException('End date must be on or after start date')
    }
    if ((end.getTime() - start.getTime()) / 86_400_000 > 366) {
      throw new BadRequestException('Bulk creation is limited to one year')
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dates: string[] = []
    for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (dto.daysOfWeek.includes(dayNames[cursor.getUTCDay()])) dates.push(cursor.toISOString().slice(0, 10))
    }
    if (dates.length === 0) throw new BadRequestException('No session dates match the selected days')

    const existing = await this.prisma.session.findMany({
      where: { sectionId: dto.sectionId, date: { in: dates } },
      select: { date: true },
    })
    if (existing.length) {
      const conflictDates = existing
        .map((session) => session.date)
        .slice(0, 10)
        .join(', ')
      const suffix = existing.length > 10 ? ` and ${existing.length - 10} more` : ''
      throw new ConflictException(`Sessions already exist on ${conflictDates}${suffix}`)
    }

    const sessions = await this.prisma.$transaction(
      dates.map((date) =>
        this.prisma.session.create({
          data: {
            sectionId: dto.sectionId,
            subjectName: section.subject.name,
            date,
            startTime: dto.startTime,
            endTime: dto.endTime,
            room: dto.room,
            qrValidityMinutes: dto.qrValidityMinutes,
            gracePeriodMinutes: dto.gracePeriodMinutes,
            teacherId: user.id,
            geofenceLatitude: dto.geofence.latitude,
            geofenceLongitude: dto.geofence.longitude,
            geofenceRadiusMeters: dto.geofence.radiusMeters,
          },
        }),
      ),
    )
    for (const session of sessions) this.realtime.emitSessionState(session, 'created')
    const publicKey = await this.teacherPublicKey(user.id)
    return sessions.map((session) => this.present(session, publicKey, true))
  }

  async activate(id: string, dto: ActivateSessionDto, user: RequestUser) {
    const session = await this.prisma.session.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session not found')
    await this.assertTeacherOwnsSection(session.sectionId, user.id)
    const teacher = await this.prisma.user.findUnique({ where: { id: user.id }, select: { teacherPublicKey: true } })
    if (!teacher?.teacherPublicKey)
      throw new BadRequestException('Provision a teacher signing key before activating a session')
    const payload = verifyQRToken(dto.token, teacher.teacherPublicKey)
    if (!payload) throw new BadRequestException('QR token signature is invalid')
    if (payload.sessionId !== session.id || payload.sectionId !== session.sectionId || payload.teacherId !== user.id) {
      throw new BadRequestException('QR token does not belong to this session')
    }
    if (payload.validityMinutes !== dto.validityMinutes || payload.gracePeriodMinutes !== session.gracePeriodMinutes) {
      throw new BadRequestException('QR token timing does not match the session')
    }
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > Date.now() + 5 * 60_000) {
      throw new BadRequestException('QR token issuedAt is invalid')
    }
    const issuedAt = new Date(payload.issuedAt)
    const expiresAt = new Date(issuedAt.getTime() + dto.validityMinutes * 60_000)

    const activated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.session.update({
        where: { id },
        data: {
          isActive: true,
          endedAt: null,
          qrToken: dto.token,
          qrGeneratedAt: issuedAt,
          qrTokenExpiresAt: expiresAt,
          qrValidityMinutes: dto.validityMinutes,
        },
      })
      const enrollments = await tx.enrollment.findMany({
        where: { sectionId: session.sectionId },
        include: { student: { select: { fullName: true, program: true } } },
      })
      await tx.attendanceRecord.createMany({
        data: enrollments.map((enrollment) => ({
          sessionId: id,
          sectionId: session.sectionId,
          studentId: enrollment.studentId,
          studentName: enrollment.student.fullName,
          studentProgram: enrollment.student.program,
          timestamp: issuedAt,
          status: 'pending',
          latitude: session.geofenceLatitude,
          longitude: session.geofenceLongitude,
          isSynced: true,
          syncedAt: issuedAt,
        })),
        skipDuplicates: true,
      })
      return updated
    })
    this.realtime.emitSessionState(activated, 'activated')
    await this.cacheActiveSession(activated, teacher.teacherPublicKey)
    return this.present(activated, teacher.teacherPublicKey, true)
  }

  async end(id: string, user: RequestUser) {
    const session = await this.prisma.session.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session not found')
    await this.assertTeacherOwnsSection(session.sectionId, user.id)
    const ended = await this.prisma.$transaction(async (tx) => {
      const pendingResult = await tx.attendanceRecord.updateMany({
        where: { sessionId: id, status: 'pending' },
        data: { status: 'absent', timestamp: new Date(), manuallySet: false },
      })
      void pendingResult
      const sessionResult = await tx.session.updateMany({
        where: { id, isActive: true },
        data: { isActive: false, endedAt: new Date(), qrToken: null, qrTokenExpiresAt: null, qrGeneratedAt: null },
      })
      if (sessionResult.count === 0) throw new ConflictException('Session is not active or was already ended')
      return tx.session.findUniqueOrThrow({ where: { id } })
    })
    this.realtime.emitSessionState(ended, 'ended')
    await this.redis.delete(`active-session:${ended.id}`)
    return this.present(ended, await this.teacherPublicKey(session.teacherId), true)
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async autoEndExpiredSessions() {
    try {
      const activeSessions = await this.prisma.session.findMany({
        where: {
          isActive: true,
          qrTokenExpiresAt: { not: null },
        },
      })

      const now = new Date()
      const expired = activeSessions.filter((session) => {
        if (!session.qrTokenExpiresAt) return false
        const graceEnd = new Date(
          session.qrTokenExpiresAt.getTime() + session.gracePeriodMinutes * 60 * 1000,
        )
        return now > graceEnd
      })

      for (const session of expired) {
        const ended = await this.prisma.$transaction(async (tx) => {
          await tx.attendanceRecord.updateMany({
            where: { sessionId: session.id, status: 'pending' },
            data: { status: 'absent', timestamp: now, manuallySet: false },
          })

          const updated = await tx.session.update({
            where: { id: session.id },
            data: {
              isActive: false,
              endedAt: now,
              qrToken: null,
              qrTokenExpiresAt: null,
              qrGeneratedAt: null,
            },
          })

          return updated
        })

        this.realtime.emitSessionState(ended, 'ended')
        await this.redis.delete(`active-session:${ended.id}`)
        Logger.log(`Automatically ended expired session ${session.id} (${session.subjectName})`, 'SessionsService')
      }
    } catch (error) {
      Logger.error(
        `Failed to auto-end expired sessions: ${error instanceof Error ? error.message : 'unknown'}`,
        'SessionsService',
      )
    }
  }

  private async sessionScope(user: RequestUser, sectionId?: string) {
    if (user.role === 'super_admin') {
      const adminScope =
        user.scope === 'institution'
          ? {}
          : user.department
            ? { section: { teacher: { department: user.department } } }
            : { id: { in: [] as string[] } }
      return { ...adminScope, ...(sectionId ? { sectionId } : {}) }
    }
    if (user.role === 'teacher') return { teacherId: user.id, ...(sectionId ? { sectionId } : {}) }
    const sections = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { sectionId: { in: sections.map((item) => item.sectionId) }, ...(sectionId ? { sectionId } : {}) }
  }

  private async assertAccess(sectionId: string, user: RequestUser, teacherId: string) {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId, teacher: { department: user.department ?? '__no_department__' } },
        select: { id: true },
      })
      if (section) return
      throw new ForbiddenException('This session is outside your administrative scope')
    }
    if (user.role === 'teacher' && teacherId === user.id) return
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId } },
    })
    if (!enrollment) throw new ForbiddenException('You cannot access this session')
  }

  private async assertTeacherOwnsSection(sectionId: string, teacherId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { teacherId: true, subject: { select: { name: true } } },
    })
    if (!section) throw new NotFoundException('Section not found')
    if (section.teacherId !== teacherId)
      throw new ForbiddenException('You can only manage sessions in your own sections')
    return section
  }

  private async authorizeCreator(sectionId: string, user: RequestUser) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { teacherId: true, subject: { select: { name: true } } },
    })
    if (!section) throw new NotFoundException('Section not found')
    if (user.role === 'teacher') {
      if (section.teacherId !== user.id)
        throw new ForbiddenException('You can only manage sessions in your own sections')
      return { teacherId: user.id, subjectName: section.subject.name }
    }
    if (user.role !== 'student') throw new ForbiddenException('You cannot create sessions')
    const [officerRole, permission] = await Promise.all([
      this.prisma.sectionRole.findUnique({
        where: { sectionId_studentId_role: { sectionId, studentId: user.id, role: 'president' } },
      }),
      this.prisma.sessionPermission.findFirst({
        where: { sectionId, studentId: user.id, isActive: true, expiresAt: { gt: new Date() } },
      }),
    ])
    if (!officerRole || !permission) throw new ForbiddenException('An active president session permission is required')
    return { teacherId: section.teacherId, subjectName: section.subject.name }
  }

  private assertTimeRange(startTime: string, endTime: string) {
    if (endTime <= startTime) throw new BadRequestException('endTime must be after startTime')
  }

  private async teacherPublicKey(teacherId: string) {
    return (
      (await this.prisma.user.findUnique({ where: { id: teacherId }, select: { teacherPublicKey: true } }))
        ?.teacherPublicKey ?? undefined
    )
  }

  private async presentMany<T extends Session>(sessions: T[], user: RequestUser) {
    const teachers = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(sessions.map((session) => session.teacherId))] } },
      select: { id: true, teacherPublicKey: true },
    })
    const keys = new Map(teachers.map((teacher) => [teacher.id, teacher.teacherPublicKey]))
    return sessions.map((session) => this.present(session, keys.get(session.teacherId), user.role === 'teacher'))
  }

  private async cacheActiveSession(session: Session, teacherPublicKey: string) {
    const ttlSeconds = Math.max(300, (session.qrValidityMinutes + session.gracePeriodMinutes) * 60)
    await this.redis.setJson(`active-session:${session.id}`, { ...session, teacherPublicKey }, ttlSeconds)
  }

  private present<T extends Session>(session: T, teacherPublicKey?: string | null, includeQrToken = false) {
    const { qrToken, geofenceLatitude, geofenceLongitude, geofenceRadiusMeters, ...safeSession } = session
    return {
      ...safeSession,
      ...(includeQrToken && qrToken ? { qrToken } : {}),
      teacherPublicKey: teacherPublicKey ?? undefined,
      geofence: {
        latitude: geofenceLatitude,
        longitude: geofenceLongitude,
        radiusMeters: geofenceRadiusMeters,
      },
    }
  }
}
