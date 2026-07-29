import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type {
  AttendanceListQueryDto,
  AttendanceReportQueryDto,
  CreateManualAttendanceDto,
  ScanAttendanceDto,
  SubmitAttendanceDto,
} from './dto/attendance.dto'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import { RedisService } from '../infrastructure/redis.service'
import { createHash } from 'crypto'
import type { AttendanceRecord, AttendanceStatus } from '@prisma/client'
import { ScanValidatorService } from './scan-validator.service'
import { AttendanceScopeService } from './attendance-scope.service'
import { AttendanceReportService } from './attendance-report.service'
import { GeofenceService } from './geofence.service'
import { verifyQRToken } from '@polycheck/shared'
import { RAW_ATTENDANCE_LIMIT, type ScanEvidence, type ScanValidation, type CachedSession } from './types'

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AttendanceGateway,
    private readonly redis: RedisService,
    private readonly scanValidator: ScanValidatorService,
    private readonly scope: AttendanceScopeService,
    private readonly reportService: AttendanceReportService,
    private readonly geofence: GeofenceService,
  ) {}

  // ── Raw record access ──

  async findAll(user: RequestUser, query: AttendanceListQueryDto = {}) {
    const where = await this.scope.rawRecordWhere(user, query)
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(query.limit ?? RAW_ATTENDANCE_LIMIT, RAW_ATTENDANCE_LIMIT),
    })
    return records.map((record) => this.present(record))
  }

  async findPage(user: RequestUser, query: AttendanceListQueryDto, pagination: { limit: number; offset: number }) {
    const where = await this.scope.rawRecordWhere(user, query)
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
    if (user.role !== 'student' && !sectionId) {
      throw new BadRequestException('Staff student-attendance queries require a sectionId')
    }
    if (user.role === 'teacher') {
      const section = await this.prisma.section.findUnique({ where: { id: sectionId }, select: { teacherId: true } })
      if (!section || section.teacherId !== user.id)
        throw new ForbiddenException('You cannot view this student attendance')
    }
    if (user.role === 'super_admin' && user.scope !== 'institution') {
      const allowed = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          ...(sectionId ? { sectionId } : {}),
          section: { teacher: { department: user.department ?? '__no_department__' } },
        },
        select: { id: true },
      })
      if (!allowed) throw new ForbiddenException('This student is outside your administrative scope')
    }
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId, ...(sectionId ? { sectionId } : {}) },
      orderBy: { timestamp: 'desc' },
      take: RAW_ATTENDANCE_LIMIT,
    })
    return records.map((record) => this.present(record))
  }

  // ── Report / summaries ──

  async summaries(user: RequestUser, query: AttendanceReportQueryDto = {}) {
    return this.reportService.summaries(user, query)
  }

  async report(user: RequestUser, query: AttendanceReportQueryDto = {}) {
    return this.reportService.report(user, query)
  }

  // ── Scan attempts ──

  async findAttempts(user: RequestUser, sessionId?: string) {
    const sessionWhere = await this.scope.sessionScope(user)
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

  // ── Scan / check / submit / sync ──

  async check(user: RequestUser, dto: ScanAttendanceDto) {
    const evidence = this.scanValidator.scanEvidenceFromScanDto(dto)
    const receivedAt = new Date()
    const withinLimit = await this.redis.consumeRateLimit(`scan:${user.id}:${dto.sessionId}`, 30, 60)
    if (!withinLimit) {
      const validation: ScanValidation = {
        success: false,
        status: 'absent',
        reason: 'rate_limited',
        message: 'Too many scan attempts. Try again shortly.',
        scannedAt: receivedAt,
        receivedAt,
        riskSignals: ['rate_limited'],
      }
      await this.recordScanAttempt(user, evidence, validation, 'denied')
      return validation
    }
    const validation = await this.scanValidator.validateScan(user, evidence, false, receivedAt)
    if (!validation.success) {
      await this.recordScanAttempt(user, evidence, validation, 'denied')
    }
    return validation
  }

  async submit(user: RequestUser, dto: SubmitAttendanceDto) {
    return this.processScanSubmission(user, this.scanValidator.scanEvidenceFromSubmitDto(dto), false)
  }

  async scan(user: RequestUser, dto: ScanAttendanceDto) {
    const result = await this.processScanSubmission(user, this.scanValidator.scanEvidenceFromScanDto(dto), false)
    if (!result.success || !('record' in result)) return { error: result.message ?? 'Check-in rejected' }
    return result.record
  }

  async syncScan(user: RequestUser, dto: ScanAttendanceDto) {
    if (!dto.scannedAt) {
      return { error: 'Offline attendance records require the original scan timestamp' }
    }
    const result = await this.processScanSubmission(user, this.scanValidator.scanEvidenceFromScanDto(dto), true)
    if (!result.success || !('record' in result)) return { error: result.message ?? 'Offline check-in rejected' }
    return result.record
  }

  private async processScanSubmission(user: RequestUser, evidence: ScanEvidence, offline: boolean) {
    const receivedAt = new Date()
    const tokenHash = createHash('sha256').update(evidence.qrToken).digest('hex')
    const replay = await this.scanValidator.findReplay(user.id, evidence, tokenHash)
    if (replay) return replay

    const withinLimit = await this.redis.consumeRateLimit(`scan:${user.id}:${evidence.sessionId}`, 10, 60)
    if (!withinLimit) {
      const validation: ScanValidation = {
        success: false,
        status: 'absent',
        reason: 'rate_limited',
        message: 'Too many scan attempts. Try again shortly.',
        scannedAt: this.scanValidator.clientScannedAt(evidence, offline, receivedAt),
        receivedAt,
        riskSignals: ['rate_limited'],
      }
      await this.recordScanAttempt(user, evidence, validation, 'denied', offline)
      return validation
    }

    const activation = await this.ensureOfflineActivation(evidence.sessionId, evidence.qrToken, receivedAt, offline)
    if (activation === 'expired') {
      const validation: ScanValidation = {
        success: false,
        status: 'absent',
        reason: 'qr_expired',
        message: 'The QR attendance window has expired',
        scannedAt: this.scanValidator.clientScannedAt(evidence, offline, receivedAt),
        receivedAt,
        riskSignals: ['expired_before_activation'],
      }
      await this.recordScanAttempt(user, evidence, validation, 'denied', offline)
      return validation
    }

    const validation = await this.scanValidator.validateScan(user, evidence, offline, receivedAt)
    if (!validation.success) {
      await this.recordScanAttempt(user, evidence, validation, 'denied', offline)
      return validation
    }
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: evidence.sessionId, studentId: user.id } },
    })
    if (!existing) throw new NotFoundException('Attendance roster entry not found')
    const suspiciousCoordinates =
      validation.status !== 'disputed' &&
      (await this.geofence.hasSuspiciousCoordinates(
        user.id,
        evidence.sessionId,
        evidence.deviceId,
        evidence.latitude,
        evidence.longitude,
      ))
    const disputed = suspiciousCoordinates || validation.status === 'disputed'
    if (suspiciousCoordinates) {
      validation.riskSignals.push('suspicious_coordinates')
      validation.reason = 'suspicious_coordinates'
      validation.message = 'Coordinates were implausibly identical across multiple sessions and require review.'
    }
    const finalStatus: AttendanceStatus = disputed ? 'disputed' : validation.status
    const outcome = disputed ? 'flagged' : finalStatus
    let transactionResult: AttendanceRecord | null
    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        const attempt = await tx.scanAttempt.create({
          data: this.scanValidator.buildScanAttemptData(user.id, evidence, validation, outcome, offline),
        })
        const updated = await tx.attendanceRecord.updateMany({
          where: {
            id: existing.id,
            status: disputed ? { in: ['pending', 'absent'] } : 'pending',
            manuallySet: false,
            tokenSnapshot: null,
            acceptedScanAttemptId: null,
          },
          data: {
            status: finalStatus,
            timestamp: validation.scannedAt,
            latitude: evidence.latitude,
            longitude: evidence.longitude,
            deviceId: evidence.deviceId,
            tokenSnapshot: evidence.qrToken,
            isSynced: true,
            syncedAt: receivedAt,
            acceptedScanAttemptId: attempt.id,
            ...(disputed
              ? {
                  disputeReason: suspiciousCoordinates ? 'suspicious_coordinates' : validation.reason,
                  disputeDescription: suspiciousCoordinates
                    ? 'Coordinates were implausibly identical across multiple sessions and require review.'
                    : validation.message,
                }
              : {}),
          },
        })
        if (updated.count === 0) {
          await tx.scanAttempt.update({
            where: { id: attempt.id },
            data: {
              outcome: 'denied',
              reason: 'duplicate',
              message: 'Attendance was already submitted for this session',
            },
          })
          return null
        }
        return tx.attendanceRecord.findUniqueOrThrow({ where: { id: existing.id } })
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const concurrentReplay = await this.scanValidator.findReplay(user.id, evidence, tokenHash)
        if (concurrentReplay && concurrentReplay.success && 'record' in concurrentReplay) return concurrentReplay
      }
      throw error
    }
    if (!transactionResult) {
      return {
        success: false,
        status: existing.status,
        reason: 'duplicate',
        message: 'Attendance was already submitted for this session',
      }
    }
    this.realtime.emitAttendanceUpdated(transactionResult)
    return { ...validation, status: finalStatus, record: this.present(transactionResult) }
  }

  // ── Manual status updates ──

  async updateStatus(user: RequestUser, id: string, status: 'present' | 'late' | 'absent' | 'pending' | 'disputed') {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can update attendance statuses')
    }
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        session: { select: { teacherId: true, section: { select: { teacher: { select: { department: true } } } } } },
      },
    })
    if (!record) throw new NotFoundException('Attendance record not found')
    if (user.role === 'teacher' && record.session.teacherId !== user.id)
      throw new ForbiddenException('You can only update records in your sessions')
    const updated = await this.prisma.attendanceRecord.update({ where: { id }, data: { status, manuallySet: true } })
    this.realtime.emitAttendanceUpdated(updated)
    return this.present(updated)
  }

  async createManual(user: RequestUser, dto: CreateManualAttendanceDto) {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can create attendance records')
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

  // ── Private: offline activation recovery ──

  private async ensureOfflineActivation(sessionId: string, qrToken: string, receivedAt: Date, offline: boolean) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.qrToken || session.endedAt) return 'unchanged' as const
    const teacher = await this.prisma.user.findUnique({
      where: { id: session.teacherId },
      select: { teacherPublicKey: true },
    })
    if (!teacher?.teacherPublicKey) return 'unchanged' as const
    const payload = verifyQRToken(qrToken, teacher.teacherPublicKey)
    if (
      !payload ||
      payload.sessionId !== session.id ||
      payload.sectionId !== session.sectionId ||
      payload.teacherId !== session.teacherId
    )
      return 'unchanged' as const
    if (
      payload.validityMinutes < 1 ||
      payload.validityMinutes > 180 ||
      payload.gracePeriodMinutes < 0 ||
      payload.gracePeriodMinutes > 180
    )
      return 'unchanged' as const
    if (!offline && (payload.validityMinutes > 15 || payload.gracePeriodMinutes > 60)) return 'unchanged' as const
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > receivedAt.getTime() + 5 * 60_000)
      return 'unchanged' as const
    const graceEnd = payload.issuedAt + (payload.validityMinutes + payload.gracePeriodMinutes) * 60_000
    const expired = receivedAt.getTime() > graceEnd
    if (expired && !offline) return 'expired' as const

    const issuedAt = new Date(payload.issuedAt)
    const expiresAt = new Date(payload.issuedAt + payload.validityMinutes * 60_000)
    const activated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.session.updateMany({
        where: { id: session.id, qrToken: null, endedAt: null },
        data: {
          isActive: !expired,
          endedAt: expired ? receivedAt : null,
          qrToken: expired ? null : qrToken,
          qrGeneratedAt: expired ? null : issuedAt,
          qrTokenExpiresAt: expired ? null : expiresAt,
          qrValidityMinutes: payload.validityMinutes,
          gracePeriodMinutes: payload.gracePeriodMinutes,
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
          timestamp: expired ? receivedAt : issuedAt,
          status: expired ? 'absent' : 'pending',
          latitude: session.geofenceLatitude,
          longitude: session.geofenceLongitude,
          isSynced: true,
          syncedAt: receivedAt,
        })),
        skipDuplicates: true,
      })
      return tx.session.findUniqueOrThrow({ where: { id: session.id } })
    })
    if (activated) {
      this.realtime.emitSessionState(activated, expired ? 'ended' : 'activated')
      if (!expired) {
        const ttlSeconds = Math.max(300, (activated.qrValidityMinutes + activated.gracePeriodMinutes) * 60)
        await this.redis.setJson(
          `active-session:${activated.id}`,
          { ...activated, teacherPublicKey: teacher.teacherPublicKey },
          ttlSeconds,
        )
      }
    }
    return activated ? ('activated' as const) : ('unchanged' as const)
  }

  // ── Private: scan attempt persistence ──

  private async recordScanAttempt(
    user: RequestUser,
    evidence: ScanEvidence,
    validation: ScanValidation,
    outcome: string,
    offline = false,
  ) {
    const session = await this.prisma.session.findUnique({ where: { id: evidence.sessionId }, select: { id: true } })
    if (!session) return
    try {
      await this.prisma.scanAttempt.create({
        data: this.scanValidator.buildScanAttemptData(user.id, evidence, validation, outcome, offline),
      })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error
    }
  }

  // ── Private: presentation helper ──

  private present(record: AttendanceRecord) {
    return { ...record, coordinates: { latitude: record.latitude, longitude: record.longitude } }
  }
}
