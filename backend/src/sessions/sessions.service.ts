import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { decodePinHashRecord, verifyQRToken } from '@polycheck/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { ActivateSessionDto, CreateBulkSessionsDto, CreateSessionDto } from './dto/create-session.dto'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import { RedisService } from '../infrastructure/redis.service'
import { Prisma, type Session, type SessionMode } from '../prisma/client'
import { ErrorCode } from '../common/constants/error-codes'
import { haversineDistance } from '@polycheck/shared'
import { parseIsoDate } from '../common/utils/iso-date'
import { sessionDurationMinutes } from '../common/utils/session-time'
import { adminSessionWhere, assertSectionInAdminScope } from '../common/admin-scope'
import { lockStudentSection } from '../common/student-section-lock'
import { NotificationsService } from '../notifications/notifications.service'
import { resolveSessionAttendance } from '../attendance/resolution'

const AUTO_END_LOCK_TTL_SECONDS = 5 * 60
const MAX_QR_VALIDITY_MINUTES = 15
const MAX_QR_GRACE_MINUTES = 60
const MIN_ONLINE_QR_VALIDITY_SECONDS = 60
const MAX_ONLINE_QR_VALIDITY_SECONDS = 300
const DEFAULT_ONLINE_START_VALIDITY_SECONDS = 90
const DEFAULT_ONLINE_START_GRACE_MINUTES = 10
const DEFAULT_ONLINE_END_VALIDITY_SECONDS = 90
const ONLINE_AUTO_END_BUFFER_MINUTES = 15
const ABSENT_NOTIFICATION_BATCH_SIZE = 10
// Cache-hygiene lease only. Scan authorization always re-reads PostgreSQL, so
// lease expiry cannot make a stale cached key or session state authoritative.
const KEY_ROTATION_LOCK_TTL_SECONDS = 10

// V4 anti-ghost-professor policy (see plan/vulnerability-hardening-plan.md):
// in-person activations may carry the teacher's current fix; the class only
// proceeds when they are inside the geofence floor. Absent coordinates keep
// today's behavior (offline-first activation), and online sessions never
// consult a location (RA 10173).
const TEACHER_ACTIVATION_LOCATION_ENFORCEMENT = envFlag(process.env.TEACHER_ACTIVATION_LOCATION_ENFORCEMENT, true)
const TEACHER_ACTIVATION_TOLERANCE_METERS = positiveInt(process.env.TEACHER_ACTIVATION_TOLERANCE_METERS, 150)

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback
  if (raw.toLowerCase() === 'true') return true
  if (raw.toLowerCase() === 'false') return false
  return fallback
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AttendanceGateway,
    private readonly redis: RedisService,
    @Optional() private readonly notifications?: NotificationsService,
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
    this.assertDate(dto.date, 'date')
    if (dto.rescheduledFromDate) this.assertDate(dto.rescheduledFromDate, 'rescheduledFromDate')
    this.assertTimeRange(dto.startTime, dto.endTime)
    const mode: SessionMode = dto.mode ?? 'in_person'
    this.assertModeShape(mode, dto.geofence)
    this.assertOnlineTimingDefaults(dto)
    const {
      geofence,
      subjectName: _ignoredSubjectName,
      qrValidityMinutes,
      gracePeriodMinutes,
      startQrValiditySeconds,
      startGraceMinutes,
      endQrValiditySeconds,
      mode: _mode,
      ...data
    } = dto
    const onlineDefaults = this.onlineTimingColumns(mode, {
      startQrValiditySeconds,
      startGraceMinutes,
      endQrValiditySeconds,
    })
    // Authorization and creation share one transaction so a concurrent removal
    // or permission revocation cannot slip between the authorization reads and
    // the session insert.
    const { session, teacherId } = await this.prisma.$transaction(async (tx) => {
      if (user.role === 'student') await lockStudentSection(tx, user.id, dto.sectionId)
      const authorized = await this.authorizeCreator(dto.sectionId, user, tx)
      const created = await this.createSessionOrThrowConflict(tx, {
        ...data,
        mode,
        subjectName: authorized.subjectName,
        teacherId: authorized.teacherId,
        // Timing defaults — the authoritative values are set at QR generation time
        qrValidityMinutes: qrValidityMinutes ?? 15,
        gracePeriodMinutes: gracePeriodMinutes ?? 15,
        ...onlineDefaults,
        geofenceLatitude: geofence?.latitude ?? null,
        geofenceLongitude: geofence?.longitude ?? null,
        geofenceRadiusMeters: geofence?.radiusMeters ?? null,
      })
      return { session: created, teacherId: authorized.teacherId }
    })
    this.realtime.emitSessionState(session, 'created')
    return this.present(session, await this.teacherPublicKey(teacherId), user.role !== 'student')
  }

  async createBulk(dto: CreateBulkSessionsDto, user: RequestUser) {
    const mode: SessionMode = dto.mode ?? 'in_person'
    this.assertModeShape(mode, dto.geofence)
    this.assertOnlineTimingDefaults(dto)
    const section = await this.assertTeacherOwnsSection(dto.sectionId, user.id)
    this.assertTimeRange(dto.startTime, dto.endTime)
    const start = this.assertDate(dto.startDate, 'startDate')
    const end = this.assertDate(dto.endDate, 'endDate')
    if (end < start) throw new BadRequestException('End date must be on or after start date')
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

    const onlineDefaults = this.onlineTimingColumns(mode, {
      startQrValiditySeconds: dto.startQrValiditySeconds,
      startGraceMinutes: dto.startGraceMinutes,
      endQrValiditySeconds: dto.endQrValiditySeconds,
    })
    let sessions: Session[]
    try {
      sessions = await this.prisma.$transaction(
        dates.map((date) =>
          this.prisma.session.create({
            data: {
              sectionId: dto.sectionId,
              subjectName: section.subject.name,
              mode,
              date,
              startTime: dto.startTime,
              endTime: dto.endTime,
              room: dto.room,
              // Timing defaults — the authoritative values are set at QR generation time
              qrValidityMinutes: dto.qrValidityMinutes ?? 15,
              gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
              ...onlineDefaults,
              teacherId: user.id,
              geofenceLatitude: dto.geofence?.latitude ?? null,
              geofenceLongitude: dto.geofence?.longitude ?? null,
              geofenceRadiusMeters: dto.geofence?.radiusMeters ?? null,
            },
          }),
        ),
      )
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('One or more sessions already exist for the selected date and time')
      }
      throw error
    }
    for (const session of sessions) this.realtime.emitSessionState(session, 'created')
    const publicKey = await this.teacherPublicKey(user.id)
    return sessions.map((session) => this.present(session, publicKey, true))
  }

  async activate(id: string, dto: ActivateSessionDto, user: RequestUser) {
    // Numeric caps are mode-independent and guarded before any database read so
    // an invalid activation can never touch persisted session state.
    if (
      (dto.validityMinutes !== undefined && dto.validityMinutes > MAX_QR_VALIDITY_MINUTES) ||
      (dto.gracePeriodMinutes ?? 0) > MAX_QR_GRACE_MINUTES
    ) {
      throw new BadRequestException('QR validity is limited to 15 minutes and grace to 60 minutes')
    }
    const session = await this.prisma.session.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session not found')
    await this.assertTeacherOwnsSection(session.sectionId, user.id)
    if (session.mode !== 'online') {
      if (dto.checkpoint === 'end') {
        throw new BadRequestException('End-of-class checkpoints are only available for online sessions')
      }
      if (session.isActive || session.endedAt || session.qrToken) {
        throw new ConflictException('Session is already active or was already ended')
      }
    }
    const teacher = await this.prisma.user.findUnique({ where: { id: user.id }, select: { teacherPublicKey: true } })
    if (!teacher?.teacherPublicKey)
      throw new BadRequestException('Provision a teacher signing key before activating a session')
    // V4: in-person activations may carry the teacher's fix; off-campus
    // activations must be explicitly overridden and are audited. Online
    // sessions are zero-GPS (RA 10173) and never consult a location.
    if (session.mode === 'in_person') {
      await this.assertTeacherAtClassroom(session, dto, user)
    }
    if (session.mode === 'online') {
      return this.activateOnlineCheckpoint(session, dto, user, teacher.teacherPublicKey)
    }
    return this.activateInPerson(session, dto, user, teacher.teacherPublicKey)
  }

  /**
   * V4 anti-ghost-professor gate. Only runs for in-person sessions: an absent
   * fix (offline activation, permission denied) keeps today's behavior, and a
   * fix inside the geofence floor proceeds silently. An off-campus fix is
   * refused with a typed 409 unless the teacher explicitly overrides — the
   * override is recorded in the audit log (fail-open).
   */
  private async assertTeacherAtClassroom(session: Session, dto: ActivateSessionDto, user: RequestUser) {
    if (!TEACHER_ACTIVATION_LOCATION_ENFORCEMENT) return
    if (dto.latitude === undefined || dto.longitude === undefined) return
    if (session.geofenceLatitude === null || session.geofenceLongitude === null) return
    const radius = session.geofenceRadiusMeters ?? 0
    const allowedDistanceMeters = Math.max(radius, TEACHER_ACTIVATION_TOLERANCE_METERS)
    const distanceMeters = haversineDistance(
      dto.latitude,
      dto.longitude,
      session.geofenceLatitude,
      session.geofenceLongitude,
    )
    if (distanceMeters <= allowedDistanceMeters) return

    if (dto.overrideTeacherLocation === true) {
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            actorRole: user.role,
            action: 'session.activation_override',
            entityType: 'session',
            entityId: session.id,
            metadata: {
              subjectName: session.subjectName,
              date: session.date,
              distanceMeters: Math.round(distanceMeters),
              allowedDistanceMeters,
              geofenceRadiusMeters: radius,
              override: true,
            },
          },
        })
      } catch (error) {
        // Fail-open audit policy: the confirmed activation must still proceed;
        // the audit miss is observable in logs.
        Logger.error(
          `Could not write activation-override audit for session ${session.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          'SessionsService',
        )
      }
      return
    }

    throw new ConflictException({
      message: 'Your location is far outside the classroom geofence. Confirm in-person activation to proceed.',
      code: ErrorCode.TEACHER_LOCATION_OUTSIDE_GEOFENCE,
      distanceMeters: Math.round(distanceMeters),
      allowedDistanceMeters,
      geofenceRadiusMeters: radius,
      canRequestOverride: true,
    })
  }

  private async activateInPerson(
    session: Session,
    dto: ActivateSessionDto,
    user: RequestUser,
    teacherPublicKey: string,
  ) {
    if (dto.validityMinutes === undefined) {
      throw new BadRequestException('validityMinutes is required for in-person sessions')
    }
    if (dto.checkpoint === 'end') {
      throw new BadRequestException('End-of-class checkpoints are only available for online sessions')
    }
    if (dto.validityMinutes > MAX_QR_VALIDITY_MINUTES || (dto.gracePeriodMinutes ?? 0) > MAX_QR_GRACE_MINUTES) {
      throw new BadRequestException('QR validity is limited to 15 minutes and grace to 60 minutes')
    }
    if (session.isActive || session.endedAt || session.qrToken) {
      throw new ConflictException('Session is already active or was already ended')
    }
    const payload = verifyQRToken(dto.token, teacherPublicKey)
    if (!payload) throw new BadRequestException('QR token signature is invalid')
    if (payload.mode === 'online' || payload.checkpoint) {
      throw new BadRequestException('QR token does not belong to an in-person session')
    }
    if (payload.sessionId !== session.id || payload.sectionId !== session.sectionId || payload.teacherId !== user.id) {
      throw new BadRequestException('QR token does not belong to this session')
    }
    // Grace period is configurable at generation time; fall back to the session default
    const gracePeriodMinutes = dto.gracePeriodMinutes ?? session.gracePeriodMinutes
    if (gracePeriodMinutes > MAX_QR_GRACE_MINUTES)
      throw new BadRequestException('QR grace period is limited to 60 minutes')
    if (payload.validityMinutes !== dto.validityMinutes || payload.gracePeriodMinutes !== gracePeriodMinutes) {
      throw new BadRequestException('QR token timing does not match the session')
    }
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > Date.now() + 5 * 60_000) {
      throw new BadRequestException('QR token issuedAt is invalid')
    }
    const receivedAt = new Date()
    const expired = receivedAt.getTime() > payload.issuedAt + (dto.validityMinutes + gracePeriodMinutes) * 60_000
    const issuedAt = new Date(payload.issuedAt)
    const expiresAt = new Date(issuedAt.getTime() + dto.validityMinutes * 60_000)

    const activated = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.session.updateMany({
        where: { id: session.id, isActive: false, endedAt: null, qrToken: null },
        data: {
          isActive: !expired,
          endedAt: expired ? receivedAt : null,
          qrToken: expired ? null : dto.token,
          qrGeneratedAt: expired ? null : issuedAt,
          qrTokenExpiresAt: expired ? null : expiresAt,
          qrValidityMinutes: dto.validityMinutes!,
          gracePeriodMinutes,
          autoEndAt: expired ? receivedAt : new Date(expiresAt.getTime() + gracePeriodMinutes * 60_000),
        },
      })
      if (claim.count === 0) {
        throw new ConflictException('Session is already active or was already ended')
      }
      const enrollments = await tx.enrollment.findMany({
        where: { sectionId: session.sectionId },
        include: { student: { select: { fullName: true, program: true } } },
      })
      await tx.attendanceRecord.createMany({
        data: enrollments.map((enrollment) => ({
          sessionId: session.id,
          sectionId: session.sectionId,
          studentId: enrollment.studentId,
          studentName: enrollment.student.fullName,
          studentProgram: enrollment.student.program,
          timestamp: expired ? receivedAt : issuedAt,
          status: expired ? 'absent' : 'pending',
          latitude: session.geofenceLatitude,
          longitude: session.geofenceLongitude,
          isSynced: true,
          syncedAt: expired ? receivedAt : issuedAt,
        })),
        skipDuplicates: true,
      })
      if (expired) {
        await tx.attendanceRecord.updateMany({
          where: { sessionId: session.id, status: 'pending' },
          data: { status: 'absent', timestamp: receivedAt, manuallySet: false },
        })
      }
      return tx.session.findUniqueOrThrow({ where: { id: session.id } })
    })
    this.realtime.emitSessionState(activated, expired ? 'ended' : 'activated')
    await this.publishActivationCache(activated, expired)
    return this.present(activated, teacherPublicKey, true)
  }

  private async activateOnlineCheckpoint(
    session: Session,
    dto: ActivateSessionDto,
    user: RequestUser,
    teacherPublicKey: string,
  ) {
    const checkpoint = dto.checkpoint ?? 'start'
    const payload = verifyQRToken(dto.token, teacherPublicKey)
    if (!payload) throw new BadRequestException('QR token signature is invalid')
    if (payload.mode !== 'online') throw new BadRequestException('QR token does not belong to an online session')
    if (payload.checkpoint !== checkpoint)
      throw new BadRequestException('QR token does not match the requested checkpoint')
    if (payload.sessionId !== session.id || payload.sectionId !== session.sectionId || payload.teacherId !== user.id) {
      throw new BadRequestException('QR token does not belong to this session')
    }
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > Date.now() + 5 * 60_000) {
      throw new BadRequestException('QR token issuedAt is invalid')
    }
    const validitySeconds = payload.validitySeconds
    if (
      validitySeconds === undefined ||
      !Number.isInteger(validitySeconds) ||
      validitySeconds < MIN_ONLINE_QR_VALIDITY_SECONDS ||
      validitySeconds > MAX_ONLINE_QR_VALIDITY_SECONDS
    ) {
      throw new BadRequestException('Online QR validity is limited to 60-300 seconds')
    }
    if (dto.validitySeconds !== undefined && dto.validitySeconds !== validitySeconds) {
      throw new BadRequestException('QR token timing does not match the request')
    }
    const graceMinutes = checkpoint === 'start' ? (payload.gracePeriodMinutes ?? 0) : 0
    if (checkpoint === 'start') {
      if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > MAX_QR_GRACE_MINUTES) {
        throw new BadRequestException('QR grace period is limited to 60 minutes')
      }
    } else if (payload.gracePeriodMinutes !== 0) {
      throw new BadRequestException('End-of-class QR codes have no grace period')
    }

    const pinRequired = payload.pinRequired === true
    const pinHash = pinRequired ? payload.pinHash : undefined
    if (pinRequired && (!pinHash || !decodePinHashRecord(pinHash))) {
      throw new BadRequestException('PIN-protected QR token is missing a valid PIN hash')
    }
    if (!pinRequired && pinHash) {
      throw new BadRequestException('QR token PIN state is inconsistent')
    }

    const issuedAt = new Date(payload.issuedAt)
    const expiresAt = new Date(issuedAt.getTime() + validitySeconds * 1000)
    const receivedAt = new Date()
    if (receivedAt.getTime() > expiresAt.getTime()) {
      throw new BadRequestException('The QR attendance window has already expired')
    }

    if (checkpoint === 'start') {
      if (dto.regenerate) {
        if (!session.startQrToken || !session.startTokenExpiresAt) {
          throw new ConflictException('The start-of-class QR has not been generated yet')
        }
        const graceEnd = session.startTokenExpiresAt.getTime() + (session.startGraceMinutes ?? 0) * 60_000
        if (receivedAt.getTime() > graceEnd) {
          throw new BadRequestException('The start-of-class QR window is closed; regenerate is no longer possible')
        }
        const regenerated = await this.prisma.$transaction(async (tx) => {
          const claim = await tx.session.updateMany({
            where: {
              id: session.id,
              mode: 'online',
              isActive: true,
              endedAt: null,
              startQrToken: session.startQrToken,
            },
            data: {
              startQrToken: dto.token,
              startQrGeneratedAt: issuedAt,
              startTokenExpiresAt: expiresAt,
              startQrValiditySeconds: validitySeconds,
              startGraceMinutes: graceMinutes,
              startPinHash: pinHash ?? null,
            },
          })
          if (!claim.count) {
            throw new ConflictException('The start-of-class QR changed while regenerating; try again')
          }
          return tx.session.findUniqueOrThrow({ where: { id: session.id } })
        })
        this.realtime.emitSessionState(regenerated, 'activated')
        await this.publishActivationCache(regenerated, false)
        return this.present(regenerated, teacherPublicKey, true)
      }

      if (session.isActive || session.endedAt || session.startQrToken) {
        throw new ConflictException('Session is already active or was already ended')
      }
      const autoEndAt = this.onlineAutoEndAt(issuedAt, session.startTime, session.endTime)
      const activated = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.session.updateMany({
          where: { id: session.id, mode: 'online', isActive: false, endedAt: null, startQrToken: null },
          data: {
            isActive: true,
            startQrToken: dto.token,
            startQrGeneratedAt: issuedAt,
            startTokenExpiresAt: expiresAt,
            startQrValiditySeconds: validitySeconds,
            startGraceMinutes: graceMinutes,
            startPinHash: pinHash ?? null,
            autoEndAt,
          },
        })
        if (!claim.count) throw new ConflictException('Session is already active or was already ended')
        const enrollments = await tx.enrollment.findMany({
          where: { sectionId: session.sectionId },
          include: { student: { select: { fullName: true, program: true } } },
        })
        await tx.attendanceRecord.createMany({
          data: enrollments.map((enrollment) => ({
            sessionId: session.id,
            sectionId: session.sectionId,
            studentId: enrollment.studentId,
            studentName: enrollment.student.fullName,
            studentProgram: enrollment.student.program,
            timestamp: issuedAt,
            status: 'pending',
            // Zero-GPS (RA 10173): online rosters never carry coordinates.
            latitude: null,
            longitude: null,
            isSynced: true,
            syncedAt: issuedAt,
          })),
          skipDuplicates: true,
        })
        return tx.session.findUniqueOrThrow({ where: { id: session.id } })
      })
      this.realtime.emitSessionState(activated, 'activated')
      await this.publishActivationCache(activated, false)
      return this.present(activated, teacherPublicKey, true)
    }

    if (!session.isActive || session.endedAt) throw new ConflictException('Session is not active')
    if (dto.regenerate) {
      if (!session.endQrToken || !session.endTokenExpiresAt) {
        throw new ConflictException('The end-of-class QR has not been generated yet')
      }
      if (receivedAt.getTime() > session.endTokenExpiresAt.getTime()) {
        throw new BadRequestException('The end-of-class QR window is closed; regenerate is no longer possible')
      }
      const regenerated = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.session.updateMany({
          where: {
            id: session.id,
            mode: 'online',
            isActive: true,
            endedAt: null,
            endQrToken: session.endQrToken,
          },
          data: {
            endQrToken: dto.token,
            endQrGeneratedAt: issuedAt,
            endTokenExpiresAt: expiresAt,
            endQrValiditySeconds: validitySeconds,
            endGraceMinutes: 0,
            endPinHash: pinHash ?? null,
            autoEndAt: expiresAt,
          },
        })
        if (!claim.count) {
          throw new ConflictException('The end-of-class QR changed while regenerating; try again')
        }
        return tx.session.findUniqueOrThrow({ where: { id: session.id } })
      })
      this.realtime.emitSessionState(regenerated, 'activated')
      await this.publishActivationCache(regenerated, false)
      return this.present(regenerated, teacherPublicKey, true)
    }
    if (session.endQrToken) throw new ConflictException('End-of-class QR was already generated')

    const armed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.session.updateMany({
        where: { id: session.id, mode: 'online', isActive: true, endedAt: null, endQrToken: null },
        data: {
          endQrToken: dto.token,
          endQrGeneratedAt: issuedAt,
          endTokenExpiresAt: expiresAt,
          endQrValiditySeconds: validitySeconds,
          endGraceMinutes: 0,
          endPinHash: pinHash ?? null,
          autoEndAt: expiresAt,
        },
      })
      if (!claim.count) throw new ConflictException('End-of-class QR was already generated')
      return tx.session.findUniqueOrThrow({ where: { id: session.id } })
    })
    this.realtime.emitSessionState(armed, 'activated')
    await this.publishActivationCache(armed, false)
    return this.present(armed, teacherPublicKey, true)
  }

  async end(id: string, user: RequestUser) {
    const session = await this.prisma.session.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session not found')
    await this.assertTeacherOwnsSection(session.sectionId, user.id)
    // Derive BEFORE the ledger claim below nulls endQrToken: the resolver must
    // know whether the teacher ever opened the Checkpoint-2 window.
    const endArmed = Boolean(session.endQrToken ?? session.endQrGeneratedAt)
    const { ended, absentStudentIds } = await this.prisma.$transaction(async (tx) => {
      const sessionResult = await tx.session.updateMany({
        where: { id, isActive: true },
        data: {
          isActive: false,
          endedAt: new Date(),
          qrToken: null,
          qrTokenExpiresAt: null,
          qrGeneratedAt: null,
          startQrToken: null,
          endQrToken: null,
        },
      })
      if (sessionResult.count === 0) throw new ConflictException('Session is not active or was already ended')
      const resolved = await resolveSessionAttendance(tx, { ...session, endArmed })
      return {
        ended: await tx.session.findUniqueOrThrow({ where: { id } }),
        absentStudentIds: resolved.absentStudentIds,
      }
    })
    this.realtime.emitSessionState(ended, 'ended')
    await this.invalidateActiveSessionCache(ended)
    await this.notifyAbsentStudents(ended, absentStudentIds)
    return this.present(ended, await this.teacherPublicKey(session.teacherId), true)
  }

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async autoEndExpiredSessions() {
    const lockKey = 'sessions:auto-end-expired'
    let ownershipToken: string | null = null
    try {
      ownershipToken = await this.redis.acquireLock(lockKey, AUTO_END_LOCK_TTL_SECONDS)
      if (!ownershipToken) return

      const candidates = await this.prisma.session.findMany({
        where: { isActive: true, autoEndAt: { not: null } },
      })

      const now = new Date()
      const expired = candidates.filter((session) => session.autoEndAt && now > session.autoEndAt)

      for (const session of expired) {
        try {
          // Derive BEFORE the ledger claim nulls the token columns (V1: the
          // resolver must know whether Checkpoint 2 was ever armed).
          const endArmed = Boolean(session.endQrToken ?? session.endQrGeneratedAt)
          const result = await this.prisma.$transaction(async (tx) => {
            const claim = await tx.session.updateMany({
              where: {
                id: session.id,
                isActive: true,
                autoEndAt: session.autoEndAt,
              },
              data: {
                isActive: false,
                endedAt: now,
                qrToken: null,
                qrTokenExpiresAt: null,
                qrGeneratedAt: null,
                startQrToken: null,
                endQrToken: null,
              },
            })
            if (claim.count === 0) return null
            const resolved = await resolveSessionAttendance(tx, { ...session, endArmed })
            return {
              ended: await tx.session.findUniqueOrThrow({ where: { id: session.id } }),
              absentStudentIds: resolved.absentStudentIds,
            }
          })
          if (!result) continue
          const { ended, absentStudentIds } = result

          this.realtime.emitSessionState(ended, 'ended')
          await this.invalidateActiveSessionCache(ended)
          await this.notifyAbsentStudents(ended, absentStudentIds)
          Logger.log(`Automatically ended expired session ${session.id} (${session.subjectName})`, 'SessionsService')
        } catch (error) {
          Logger.error(
            `Failed to auto-end session ${session.id}: ${error instanceof Error ? error.message : 'unknown'}`,
            'SessionsService',
          )
        }
      }
    } catch (error) {
      Logger.error(
        `Failed to auto-end expired sessions: ${error instanceof Error ? error.message : 'unknown'}`,
        'SessionsService',
      )
    } finally {
      if (ownershipToken) {
        try {
          await this.redis.releaseLock(lockKey, ownershipToken)
        } catch (error) {
          Logger.error(
            `Failed to release auto-end lock: ${error instanceof Error ? error.message : 'unknown'}`,
            'SessionsService',
          )
        }
      }
    }
  }

  private async notifyAbsentStudents(session: Pick<Session, 'id' | 'subjectName' | 'date'>, studentIds: string[]) {
    if (!this.notifications || studentIds.length === 0) return
    let failed = 0
    for (let index = 0; index < studentIds.length; index += ABSENT_NOTIFICATION_BATCH_SIZE) {
      const batch = studentIds.slice(index, index + ABSENT_NOTIFICATION_BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((studentId) =>
          this.notifications!.notifyAttendanceAbsent(studentId, {
            sessionId: session.id,
            subjectName: session.subjectName,
            date: session.date,
          }),
        ),
      )
      failed += results.filter((result) => result.status === 'rejected').length
    }
    if (failed > 0) {
      Logger.warn(`Could not notify ${failed} student(s) marked absent in session ${session.id}`, 'SessionsService')
    }
  }

  private async sessionScope(user: RequestUser, sectionId?: string) {
    if (user.role === 'super_admin') {
      return { ...adminSessionWhere(user), ...(sectionId ? { sectionId } : {}) }
    }
    if (user.role === 'teacher') return { teacherId: user.id, ...(sectionId ? { sectionId } : {}) }
    const sections = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    const enrolledSectionIds = sections.map((item) => item.sectionId)
    return sectionId
      ? { AND: [{ sectionId: { in: enrolledSectionIds } }, { sectionId }] }
      : { sectionId: { in: enrolledSectionIds } }
  }

  private async assertAccess(sectionId: string, user: RequestUser, teacherId: string) {
    if (user.role === 'super_admin') {
      await assertSectionInAdminScope(user, sectionId, this.prisma, 'This session')
      return
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

  private async authorizeCreator(sectionId: string, user: RequestUser, tx: Prisma.TransactionClient = this.prisma) {
    const section = await tx.section.findUnique({
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
    const [enrollment, officerRole, permission] = await Promise.all([
      tx.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: user.id, sectionId } },
        select: { id: true },
      }),
      tx.sectionRole.findUnique({
        where: { sectionId_studentId_role: { sectionId, studentId: user.id, role: 'president' } },
      }),
      tx.sessionPermission.findFirst({
        where: { sectionId, studentId: user.id, isActive: true, expiresAt: { gt: new Date() } },
      }),
    ])
    if (!enrollment) throw new ForbiddenException('You must be enrolled in this section to create sessions')
    if (!officerRole || !permission) throw new ForbiddenException('An active president session permission is required')
    return { teacherId: section.teacherId, subjectName: section.subject.name }
  }

  private assertModeShape(mode: SessionMode, geofence: { latitude: number } | undefined) {
    if (mode === 'online') {
      if (geofence) {
        throw new BadRequestException('Online sessions must not include a geofence (RA 10173 zero-GPS)')
      }
      return
    }
    if (!geofence) throw new BadRequestException('Geofence is required for in-person sessions')
  }

  private assertOnlineTimingDefaults(dto: {
    mode?: SessionMode
    startQrValiditySeconds?: number
    startGraceMinutes?: number
    endQrValiditySeconds?: number
  }) {
    const mode = dto.mode ?? 'in_person'
    if (mode !== 'online') return
    if (
      dto.startQrValiditySeconds !== undefined &&
      (dto.startQrValiditySeconds < MIN_ONLINE_QR_VALIDITY_SECONDS ||
        dto.startQrValiditySeconds > MAX_ONLINE_QR_VALIDITY_SECONDS)
    ) {
      throw new BadRequestException('Start-of-class QR validity is limited to 60-300 seconds')
    }
    if (dto.endQrValiditySeconds !== undefined && dto.endQrValiditySeconds > MAX_ONLINE_QR_VALIDITY_SECONDS) {
      throw new BadRequestException('End-of-class QR validity is limited to 300 seconds')
    }
    if (dto.startGraceMinutes !== undefined && dto.startGraceMinutes > MAX_QR_GRACE_MINUTES) {
      throw new BadRequestException('QR grace period is limited to 60 minutes')
    }
  }

  private onlineTimingColumns(
    mode: SessionMode,
    input: {
      startQrValiditySeconds?: number
      startGraceMinutes?: number
      endQrValiditySeconds?: number
    },
  ) {
    if (mode !== 'online') {
      return { startQrValiditySeconds: null, startGraceMinutes: null, endQrValiditySeconds: null }
    }
    return {
      startQrValiditySeconds: input.startQrValiditySeconds ?? DEFAULT_ONLINE_START_VALIDITY_SECONDS,
      startGraceMinutes: input.startGraceMinutes ?? DEFAULT_ONLINE_START_GRACE_MINUTES,
      endQrValiditySeconds: input.endQrValiditySeconds ?? DEFAULT_ONLINE_END_VALIDITY_SECONDS,
    }
  }

  /**
   * Online classes are not killed by the first QR window: the deadline is the
   * scheduled class duration plus a buffer unless the teacher arms the end QR
   * (which replaces this with the end token's expiry).
   */
  private onlineAutoEndAt(issuedAt: Date, startTime: string, endTime: string) {
    const duration = Math.max(0, sessionDurationMinutes(startTime, endTime))
    return new Date(issuedAt.getTime() + (duration + ONLINE_AUTO_END_BUFFER_MINUTES) * 60_000)
  }

  private assertTimeRange(startTime: string, endTime: string) {
    if (endTime <= startTime) throw new BadRequestException('endTime must be after startTime')
  }

  private assertDate(value: string, field: string) {
    const date = parseIsoDate(value)
    if (!date) throw new BadRequestException(`${field} must be a real calendar date in YYYY-MM-DD format`)
    return date
  }

  private async createSessionOrThrowConflict(tx: Prisma.TransactionClient, data: Prisma.SessionUncheckedCreateInput) {
    try {
      return await tx.session.create({ data })
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('A session already exists for this section, date, and time')
      }
      throw error
    }
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
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

  private cacheTtlSeconds(session: Session) {
    const deadline = session.autoEndAt?.getTime()
    if (deadline && Number.isFinite(deadline)) {
      return Math.max(300, Math.ceil((deadline - Date.now()) / 1000) + 60)
    }
    return Math.max(300, (session.qrValidityMinutes + session.gracePeriodMinutes) * 60)
  }

  private async publishActivationCache(session: Session, ended: boolean) {
    try {
      if (ended) await this.invalidateActiveSessionCache(session)
      else await this.cacheActiveSession(session)
    } catch (error) {
      // The cache is a latency optimization only; scan validation falls back to
      // the database. A failed cache write must not fail an already-committed
      // activation or make a client retry hit the conflict guard.
      Logger.error(
        `Failed to update active-session cache for ${session.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
        'SessionsService',
      )
    }
  }

  private async cacheActiveSession(session: Session) {
    // Serialize against key rotation: a rotation in progress between the DB
    // write and this publish would otherwise let the old key back into the
    // cache. Skipping the publish is safe — scan validation falls back to the
    // database, which is authoritative.
    const lockKey = `key-rotation:${session.teacherId}`
    const lockToken = await this.redis.acquireLock(lockKey, KEY_ROTATION_LOCK_TTL_SECONDS)
    if (!lockToken) {
      Logger.warn(
        `Skipping active-session cache publish for ${session.id}: signing key rotation in progress`,
        'SessionsService',
      )
      return
    }
    try {
      const [currentSession, currentKey] = await Promise.all([
        this.prisma.session.findUnique({ where: { id: session.id } }),
        this.teacherPublicKey(session.teacherId),
      ])
      // An end may commit between activation and cache publication. Re-read
      // after acquiring the hygiene lock and never knowingly publish an active
      // snapshot once PostgreSQL says the session ended.
      const hasArmedToken = currentSession
        ? currentSession.mode === 'online'
          ? Boolean(currentSession.startQrToken || currentSession.endQrToken)
          : Boolean(currentSession.qrToken)
        : false
      if (!currentSession?.isActive || currentSession.endedAt || !hasArmedToken) {
        await this.invalidateActiveSessionCache(currentSession ?? session)
        return
      }
      const published = await this.redis.setJson(
        `active-session:${currentSession.id}`,
        { ...currentSession, teacherPublicKey: currentKey ?? undefined },
        this.cacheTtlSeconds(currentSession),
      )
      if (!published) {
        Logger.warn(`Active-session cache publication was not distributed for ${currentSession.id}`, 'SessionsService')
      }
    } finally {
      await this.redis.releaseLock(lockKey, lockToken)
    }
  }

  /**
   * Removes the active-session cache for an ended session. If the delete fails,
   * republishes the authoritative ended state as cache hygiene. PostgreSQL is
   * authoritative during scan validation, so failure of both operations cannot
   * authorize a post-end scan.
   */
  private async invalidateActiveSessionCache(session: Session) {
    const cacheKey = `active-session:${session.id}`
    try {
      const deleted = await this.redis.delete(cacheKey)
      if (deleted) return
      Logger.error(
        `Cache delete could not reach configured Redis for ${session.id}; republishing ended state`,
        'SessionsService',
      )
    } catch (deleteError) {
      Logger.error(
        `Cache delete failed for ${session.id}; republishing ended state: ${
          deleteError instanceof Error ? deleteError.message : 'unknown'
        }`,
        'SessionsService',
      )
    }
    try {
      const published = await this.redis.setJson(cacheKey, { ...session, teacherPublicKey: undefined }, 300)
      if (!published)
        Logger.error(`Ended-state cache publication was not distributed for ${session.id}`, 'SessionsService')
    } catch (publishError) {
      Logger.error(
        `Failed to republish ended state for ${session.id}: ${
          publishError instanceof Error ? publishError.message : 'unknown'
        }`,
        'SessionsService',
      )
    }
  }

  private present<T extends Session>(session: T, teacherPublicKey?: string | null, includeQrToken = false) {
    const {
      qrToken,
      startQrToken,
      endQrToken,
      startPinHash,
      endPinHash,
      geofenceLatitude,
      geofenceLongitude,
      geofenceRadiusMeters,
      ...safeSession
    } = session
    const pinRequired =
      Boolean(startPinHash ?? endPinHash) || Boolean((session as T & { pinRequired?: boolean }).pinRequired)
    return {
      ...safeSession,
      mode: session.mode ?? 'in_person',
      pinRequired,
      ...(includeQrToken && qrToken ? { qrToken } : {}),
      ...(includeQrToken && startQrToken ? { startQrToken } : {}),
      ...(includeQrToken && endQrToken ? { endQrToken } : {}),
      teacherPublicKey: teacherPublicKey ?? undefined,
      ...(geofenceLatitude !== null && geofenceLongitude !== null && geofenceRadiusMeters !== null
        ? {
            geofence: {
              latitude: geofenceLatitude,
              longitude: geofenceLongitude,
              radiusMeters: geofenceRadiusMeters,
            },
          }
        : {}),
    }
  }
}
