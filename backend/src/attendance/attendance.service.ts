import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { isWithinGeofence, verifyQRToken } from '@polycheck/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { CreateManualAttendanceDto, ScanAttendanceDto, SubmitAttendanceDto } from './dto/attendance.dto'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import { RedisService } from '../infrastructure/redis.service'
import { createHash } from 'crypto'

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AttendanceGateway,
    private readonly redis: RedisService,
  ) {}

  async findAll(user: RequestUser, sessionId?: string) {
    const where = await this.recordScope(user, sessionId)
    const records = await this.prisma.attendanceRecord.findMany({ where, orderBy: { timestamp: 'desc' } })
    return records.map((record) => this.present(record))
  }

  async findPage(user: RequestUser, sessionId: string | undefined, pagination: { limit: number; offset: number }) {
    const where = await this.recordScope(user, sessionId)
    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ])
    return {
      data: records.map((record) => this.present(record)),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + records.length < total,
    }
  }

  async forStudent(user: RequestUser, studentId: string, sectionId?: string) {
    if (user.role === 'student' && user.id !== studentId)
      throw new ForbiddenException('Students can only view their own attendance')
    if (user.role === 'teacher') {
      if (sectionId) {
        const section = await this.prisma.section.findUnique({ where: { id: sectionId }, select: { teacherId: true } })
        if (!section || section.teacherId !== user.id)
          throw new ForbiddenException('You cannot view this student attendance')
      } else {
        const allowed = await this.prisma.enrollment.findFirst({
          where: { studentId, section: { teacherId: user.id } },
          select: { id: true },
        })
        if (!allowed) throw new ForbiddenException('You cannot view this student attendance')
      }
    }
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId, ...(sectionId ? { sectionId } : {}) },
      orderBy: { timestamp: 'desc' },
    })
    return records.map((record) => this.present(record))
  }

  async summaries(user: RequestUser) {
    const where = await this.recordScope(user)
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      select: { sectionId: true, status: true, session: { select: { subjectName: true } } },
    })
    const sessions = await this.prisma.session.findMany({
      where: await this.sessionScope(user),
      select: { id: true, sectionId: true },
    })
    const result = new Map<
      string,
      {
        sectionId: string
        subjectName: string
        totalSessions: number
        present: number
        late: number
        absent: number
        disputed: number
        pending: number
      }
    >()
    for (const session of sessions)
      if (!result.has(session.sectionId))
        result.set(session.sectionId, {
          sectionId: session.sectionId,
          subjectName: '',
          totalSessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          disputed: 0,
          pending: 0,
        })
    for (const session of sessions) result.get(session.sectionId)!.totalSessions++
    for (const record of records) {
      const summary = result.get(record.sectionId) ?? {
        sectionId: record.sectionId,
        subjectName: record.session.subjectName,
        totalSessions: 0,
        present: 0,
        late: 0,
        absent: 0,
        disputed: 0,
        pending: 0,
      }
      summary.subjectName ||= record.session.subjectName
      if (record.status === 'present') summary.present++
      else if (record.status === 'late') summary.late++
      else if (record.status === 'absent') summary.absent++
      else if (record.status === 'disputed') summary.disputed++
      else summary.pending++
      result.set(record.sectionId, summary)
    }
    return [...result.values()]
  }

  async findAttempts(user: RequestUser, sessionId?: string) {
    const sessionWhere = await this.sessionScope(user)
    return this.prisma.scanAttempt.findMany({
      where: { ...(sessionId ? { sessionId } : {}), session: sessionWhere },
      include: {
        student: { select: { fullName: true, studentId: true } },
        session: { select: { subjectName: true, sectionId: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 1_000,
    })
  }

  async check(user: RequestUser, dto: ScanAttendanceDto) {
    const withinLimit = await this.redis.consumeRateLimit(
      `scan:${user.id}:${dto.sessionId}:${dto.deviceId ?? 'unknown'}`,
      30,
      60,
    )
    if (!withinLimit) {
      return {
        success: false,
        status: 'absent' as const,
        reason: 'rate_limited',
        message: 'Too many scan attempts. Try again shortly.',
      }
    }
    const validation = await this.validateScan(user, dto.sessionId, dto.lat, dto.lon, dto.qrToken, dto.scannedAt)
    if (!validation.success) {
      await this.recordScanAttempt(
        user,
        dto.sessionId,
        dto.lat,
        dto.lon,
        dto.deviceId,
        dto.qrToken,
        dto.scannedAt,
        'denied',
        validation.reason,
        validation.message,
      )
    }
    return validation
  }

  async submit(user: RequestUser, dto: SubmitAttendanceDto) {
    return this.processScanSubmission(
      user,
      dto.sessionId,
      dto.latitude,
      dto.longitude,
      dto.deviceId,
      dto.qrToken,
      dto.scannedAt,
    )
  }

  async scan(user: RequestUser, dto: ScanAttendanceDto) {
    const result = await this.processScanSubmission(
      user,
      dto.sessionId,
      dto.lat,
      dto.lon,
      dto.deviceId,
      dto.qrToken,
      dto.scannedAt,
    )
    if (!result.success || !('record' in result)) return { error: result.message ?? 'Check-in rejected' }
    return result.record
  }

  private async processScanSubmission(
    user: RequestUser,
    sessionId: string,
    latitude: number,
    longitude: number,
    deviceId: string | undefined,
    qrToken: string,
    scannedAt?: string,
  ) {
    const withinLimit = await this.redis.consumeRateLimit(
      `scan:${user.id}:${sessionId}:${deviceId ?? 'unknown'}`,
      10,
      60,
    )
    if (!withinLimit) {
      await this.recordScanAttempt(
        user,
        sessionId,
        latitude,
        longitude,
        deviceId,
        qrToken,
        scannedAt,
        'denied',
        'rate_limited',
        'Too many scan attempts. Try again shortly.',
      )
      return {
        success: false,
        status: 'absent' as const,
        reason: 'rate_limited',
        message: 'Too many scan attempts. Try again shortly.',
      }
    }
    await this.ensureOfflineActivation(sessionId, qrToken)
    const validation = await this.validateScan(user, sessionId, latitude, longitude, qrToken, scannedAt)
    if (!validation.success) {
      await this.recordScanAttempt(
        user,
        sessionId,
        latitude,
        longitude,
        deviceId,
        qrToken,
        scannedAt,
        'denied',
        validation.reason,
        validation.message,
      )
      await this.recordRejectedScan(
        user,
        sessionId,
        latitude,
        longitude,
        qrToken,
        scannedAt,
        validation.reason ?? 'rejected_scan',
        validation.message,
      )
      return validation
    }
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: user.id } },
    })
    if (!existing) throw new NotFoundException('Attendance roster entry not found')
    const suspiciousCoordinates = await this.hasSuspiciousCoordinates(user.id, sessionId, deviceId, latitude, longitude)
    const updated = await this.prisma.attendanceRecord.updateMany({
      where: { id: existing.id, status: 'pending', tokenSnapshot: null },
      data: {
        status: suspiciousCoordinates ? 'disputed' : validation.status,
        timestamp: validation.scannedAt,
        latitude,
        longitude,
        deviceId,
        tokenSnapshot: qrToken,
        isSynced: true,
        syncedAt: new Date(),
        ...(suspiciousCoordinates
          ? {
              disputeReason: 'suspicious_coordinates',
              disputeDescription: 'Coordinates were implausibly identical across multiple sessions and require review.',
            }
          : {}),
      },
    })
    if (updated.count === 0) {
      await this.recordScanAttempt(
        user,
        sessionId,
        latitude,
        longitude,
        deviceId,
        qrToken,
        scannedAt,
        'denied',
        'duplicate',
        'Attendance was already submitted for this session',
      )
      return {
        success: false,
        status: existing.status,
        reason: 'duplicate',
        message: 'Attendance was already submitted for this session',
      }
    }
    const record = await this.prisma.attendanceRecord.findUniqueOrThrow({ where: { id: existing.id } })
    await this.recordScanAttempt(
      user,
      sessionId,
      latitude,
      longitude,
      deviceId,
      qrToken,
      scannedAt,
      suspiciousCoordinates ? 'flagged' : validation.status,
      suspiciousCoordinates ? 'suspicious_coordinates' : undefined,
      validation.message,
    )
    this.realtime.emitAttendanceUpdated(record)
    return { ...validation, record: this.present(record) }
  }

  async updateStatus(user: RequestUser, id: string, status: 'present' | 'late' | 'absent' | 'pending' | 'disputed') {
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      throw new ForbiddenException('Only teachers and super admins can update attendance statuses')
    }
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: { session: { select: { teacherId: true } } },
    })
    if (!record) throw new NotFoundException('Attendance record not found')
    if (user.role === 'teacher' && record.session.teacherId !== user.id)
      throw new ForbiddenException('You can only update records in your sessions')
    const updated = await this.prisma.attendanceRecord.update({ where: { id }, data: { status, manuallySet: true } })
    this.realtime.emitAttendanceUpdated(updated)
    return this.present(updated)
  }

  async createManual(user: RequestUser, dto: CreateManualAttendanceDto) {
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      throw new ForbiddenException('Only teachers and super admins can create attendance records')
    }
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } })
    if (!session) throw new NotFoundException('Session not found')
    if (session.sectionId !== dto.sectionId) throw new ForbiddenException('Session does not belong to this section')
    if (user.role === 'teacher' && session.teacherId !== user.id)
      throw new ForbiddenException('You can only manage records in your sessions')
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.sectionId } },
      include: { student: { select: { fullName: true, program: true } } },
    })
    if (!enrollment) throw new NotFoundException('Student is not enrolled in this section')
    const record = await this.prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: dto.sessionId, studentId: dto.studentId } },
      create: {
        sessionId: dto.sessionId,
        sectionId: dto.sectionId,
        studentId: dto.studentId,
        studentName: enrollment.student.fullName,
        studentProgram: enrollment.student.program,
        timestamp: new Date(),
        status: dto.status,
        latitude: session.geofenceLatitude,
        longitude: session.geofenceLongitude,
        deviceId: 'manual',
        isSynced: true,
        syncedAt: new Date(),
        manuallySet: true,
      },
      update: { status: dto.status, manuallySet: true, timestamp: new Date() },
    })
    this.realtime.emitAttendanceUpdated(record)
    return this.present(record)
  }

  private async validateScan(
    user: RequestUser,
    sessionId: string,
    latitude: number,
    longitude: number,
    qrToken: string,
    scannedAtInput?: string,
  ) {
    const cached = await this.redis.getJson<any>(`active-session:${sessionId}`)
    const session = cached
      ? {
          ...cached,
          endedAt: cached.endedAt ? new Date(cached.endedAt) : null,
          qrTokenExpiresAt: cached.qrTokenExpiresAt ? new Date(cached.qrTokenExpiresAt) : null,
        }
      : await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session)
      return { success: false, status: 'absent' as const, reason: 'session_not_found', message: 'Session not found' }
    const scannedAt = scannedAtInput ? new Date(scannedAtInput) : new Date()
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId: session.sectionId } },
    })
    if (!enrollment)
      return {
        success: false,
        status: 'absent' as const,
        reason: 'not_enrolled',
        message: 'You are not enrolled in this section',
      }
    const teacherPublicKey =
      cached?.teacherPublicKey ??
      (await this.prisma.user.findUnique({ where: { id: session.teacherId }, select: { teacherPublicKey: true } }))
        ?.teacherPublicKey
    if (!teacherPublicKey)
      return {
        success: false,
        status: 'disputed' as const,
        reason: 'invalid_signature',
        message: 'Teacher signing key is unavailable',
      }
    const payload = verifyQRToken(qrToken, teacherPublicKey)
    if (!payload)
      return {
        success: false,
        status: 'disputed' as const,
        reason: 'invalid_signature',
        message: 'QR token signature is invalid',
      }
    if (
      (session.qrToken && qrToken !== session.qrToken) ||
      payload.sessionId !== session.id ||
      payload.sectionId !== session.sectionId ||
      payload.teacherId !== session.teacherId
    ) {
      return {
        success: false,
        status: 'disputed' as const,
        reason: 'token_mismatch',
        message: 'QR token does not match this session',
      }
    }
    if (!session.isActive && session.endedAt && scannedAt > session.endedAt)
      return {
        success: false,
        status: 'absent' as const,
        reason: 'session_inactive',
        message: 'Session was not active at scan time',
      }
    if (scannedAt.getTime() < payload.issuedAt - 30_000 || scannedAt.getTime() > Date.now() + 5 * 60_000) {
      return {
        success: false,
        status: 'disputed' as const,
        reason: 'invalid_timestamp',
        message: 'Scan timestamp is invalid',
      }
    }
    if (
      !isWithinGeofence(
        latitude,
        longitude,
        session.geofenceLatitude,
        session.geofenceLongitude,
        session.geofenceRadiusMeters,
      )
    )
      return {
        success: false,
        status: 'absent' as const,
        reason: 'outside_geofence',
        message: 'You are outside the session geofence',
      }
    const validityEnd = payload.issuedAt + payload.validityMinutes * 60_000
    const status = scannedAt.getTime() > validityEnd ? ('late' as const) : ('present' as const)
    return {
      success: true,
      status,
      scannedAt,
      message: status === 'late' ? 'Check-in recorded as late.' : 'Check-in successful.',
    }
  }

  private async ensureOfflineActivation(sessionId: string, qrToken: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.qrToken || session.endedAt) return
    const teacher = await this.prisma.user.findUnique({
      where: { id: session.teacherId },
      select: { teacherPublicKey: true },
    })
    if (!teacher?.teacherPublicKey) return
    const payload = verifyQRToken(qrToken, teacher.teacherPublicKey)
    if (
      !payload ||
      payload.sessionId !== session.id ||
      payload.sectionId !== session.sectionId ||
      payload.teacherId !== session.teacherId
    )
      return
    if (
      payload.validityMinutes < 1 ||
      payload.validityMinutes > 180 ||
      payload.gracePeriodMinutes !== session.gracePeriodMinutes
    )
      return
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > Date.now() + 5 * 60_000) return

    const issuedAt = new Date(payload.issuedAt)
    const expiresAt = new Date(payload.issuedAt + payload.validityMinutes * 60_000)
    const activated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.session.updateMany({
        where: { id: session.id, qrToken: null, endedAt: null },
        data: {
          isActive: true,
          qrToken,
          qrGeneratedAt: issuedAt,
          qrTokenExpiresAt: expiresAt,
          qrValidityMinutes: payload.validityMinutes,
        },
      })
      if (!claimed.count) return null
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
          latitude: session.geofenceLatitude,
          longitude: session.geofenceLongitude,
          isSynced: true,
          syncedAt: new Date(),
        })),
        skipDuplicates: true,
      })
      return tx.session.findUniqueOrThrow({ where: { id: session.id } })
    })
    if (activated) {
      this.realtime.emitSessionState(activated, 'activated')
      const ttlSeconds = Math.max(300, (activated.qrValidityMinutes + activated.gracePeriodMinutes) * 60)
      await this.redis.setJson(
        `active-session:${activated.id}`,
        { ...activated, teacherPublicKey: teacher.teacherPublicKey },
        ttlSeconds,
      )
    }
  }

  private async recordRejectedScan(
    user: RequestUser,
    sessionId: string,
    latitude: number,
    longitude: number,
    qrToken: string,
    scannedAt: string | undefined,
    reason: string,
    message: string,
  ) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: user.id } },
    })
    if (!record || record.status !== 'pending') return
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status: 'disputed',
        timestamp: scannedAt ? new Date(scannedAt) : new Date(),
        latitude,
        longitude,
        tokenSnapshot: qrToken,
        disputeReason: reason,
        disputeDescription: message,
        isSynced: true,
        syncedAt: new Date(),
      },
    })
    this.realtime.emitAttendanceUpdated(updated)
  }

  private async recordScanAttempt(
    user: RequestUser,
    sessionId: string,
    latitude: number,
    longitude: number,
    deviceId: string | undefined,
    qrToken: string | undefined,
    scannedAt: string | undefined,
    outcome: string,
    reason?: string,
    message?: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, sectionId: true },
    })
    if (!session) return
    const enrolled = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId: session.sectionId } },
      select: { id: true },
    })
    if (!enrolled) return
    await this.prisma.scanAttempt.create({
      data: {
        sessionId,
        studentId: user.id,
        timestamp: scannedAt ? new Date(scannedAt) : new Date(),
        latitude,
        longitude,
        deviceId,
        outcome,
        reason,
        message,
        tokenHash: qrToken ? createHash('sha256').update(qrToken).digest('hex') : undefined,
      },
    })
  }

  private async hasSuspiciousCoordinates(
    studentId: string,
    sessionId: string,
    deviceId: string | undefined,
    latitude: number,
    longitude: number,
  ) {
    if (!deviceId) return false
    const previous = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        deviceId,
        sessionId: { not: sessionId },
        status: { in: ['present', 'late', 'disputed'] },
        manuallySet: false,
      },
      select: {
        latitude: true,
        longitude: true,
        session: { select: { geofenceLatitude: true, geofenceLongitude: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    })
    const identical = previous.filter(
      (record) =>
        Math.abs(record.latitude - latitude) < 0.0000001 && Math.abs(record.longitude - longitude) < 0.0000001,
    )
    const exactCenter = previous.some(
      (record) =>
        Math.abs(record.session.geofenceLatitude - latitude) < 0.0000001 &&
        Math.abs(record.session.geofenceLongitude - longitude) < 0.0000001,
    )
    return identical.length >= 2 || (exactCenter && identical.length >= 1)
  }

  private async recordScope(user: RequestUser, sessionId?: string) {
    if (user.role === 'super_admin') return sessionId ? { sessionId } : {}
    if (user.role === 'teacher') return { session: { teacherId: user.id }, ...(sessionId ? { sessionId } : {}) }
    return { studentId: user.id, ...(sessionId ? { sessionId } : {}) }
  }

  private async sessionScope(user: RequestUser) {
    if (user.role === 'super_admin') return {}
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { sectionId: { in: enrollments.map((item) => item.sectionId) } }
  }

  private present(record: any) {
    return { ...record, coordinates: { latitude: record.latitude, longitude: record.longitude } }
  }
}
