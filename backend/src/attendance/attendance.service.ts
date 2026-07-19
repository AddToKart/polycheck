import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { haversineDistance, verifyQRToken } from '@polycheck/shared'
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
import type { AttendanceRecord, AttendanceStatus, Prisma, Session } from '@prisma/client'

type CachedSession = Omit<Session, 'endedAt' | 'qrTokenExpiresAt'> & {
  endedAt: string | null
  qrTokenExpiresAt: string | null
  teacherPublicKey?: string
}

type ScanEvidence = {
  sessionId: string
  latitude: number
  longitude: number
  deviceId?: string
  qrToken: string
  scannedAt?: string
  clientAttemptId?: string
  accuracyMeters?: number
  locationCapturedAt?: string
  mocked?: boolean
  inputChannel?: 'camera' | 'image' | 'manual'
}

type ScanValidation = {
  success: boolean
  status: AttendanceStatus
  reason?: string
  message: string
  scannedAt: Date
  receivedAt: Date
  distanceMeters?: number
  geofenceRadiusMeters?: number
  riskSignals: string[]
}

const MAX_LOCATION_AGE_MS = 2 * 60_000
const MAX_LOCATION_ACCURACY_METERS = 50
const RAW_ATTENDANCE_LIMIT = 1_000
const RAW_DATE_RANGE_DAYS = 31
const REPORT_DATE_RANGE_DAYS = 366
const REPORT_SECTION_LIMIT = 1_000

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AttendanceGateway,
    private readonly redis: RedisService,
  ) {}

  async findAll(user: RequestUser, query: AttendanceListQueryDto = {}) {
    const where = await this.rawRecordWhere(user, query)
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(query.limit ?? RAW_ATTENDANCE_LIMIT, RAW_ATTENDANCE_LIMIT),
    })
    return records.map((record) => this.present(record))
  }

  async findPage(user: RequestUser, query: AttendanceListQueryDto, pagination: { limit: number; offset: number }) {
    const where = await this.rawRecordWhere(user, query)
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

  async summaries(user: RequestUser, query: AttendanceReportQueryDto = {}) {
    return (await this.report(user, query)).summaries
  }

  async report(user: RequestUser, query: AttendanceReportQueryDto = {}) {
    const range = this.resolveDateRange(query.startDate, query.endDate, REPORT_DATE_RANGE_DAYS, 30)
    const sessionWhere = await this.filteredSessionScope(user, query, range)
    const recordWhere: Prisma.AttendanceRecordWhereInput = {
      AND: [
        await this.recordScope(user),
        { session: sessionWhere },
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
        ...(query.sessionId ? [{ sessionId: query.sessionId }] : []),
      ],
    }
    const sessionGroups = await this.prisma.session.groupBy({
      by: ['sectionId'],
      where: sessionWhere,
      _count: { _all: true },
      orderBy: { sectionId: 'asc' },
      take: REPORT_SECTION_LIMIT + 1,
    })
    if (sessionGroups.length > REPORT_SECTION_LIMIT) {
      throw new BadRequestException(`Reports are limited to ${REPORT_SECTION_LIMIT} sections; narrow the filters`)
    }
    const statusGroups = await this.prisma.attendanceRecord.groupBy({
      by: ['sectionId', 'status'],
      where: recordWhere,
      _count: { _all: true },
    })
    const sectionIds = [
      ...new Set([...statusGroups.map((group) => group.sectionId), ...sessionGroups.map((group) => group.sectionId)]),
    ]
    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds } },
      select: { id: true, subject: { select: { name: true } } },
    })
    const subjectNames = new Map(sections.map((section) => [section.id, section.subject.name]))
    const summaries = new Map(
      sectionIds.map((sectionId) => [
        sectionId,
        {
          sectionId,
          subjectName: subjectNames.get(sectionId) ?? sectionId,
          totalSessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          disputed: 0,
          pending: 0,
        },
      ]),
    )
    for (const group of sessionGroups) summaries.get(group.sectionId)!.totalSessions = group._count._all
    for (const group of statusGroups) summaries.get(group.sectionId)![group.status] = group._count._all
    const rows = [...summaries.values()].sort((left, right) => left.subjectName.localeCompare(right.subjectName))
    const totals = rows.reduce(
      (total, row) => ({
        totalRecords: total.totalRecords + row.present + row.late + row.absent + row.pending + row.disputed,
        totalSessions: total.totalSessions + row.totalSessions,
        present: total.present + row.present,
        late: total.late + row.late,
        absent: total.absent + row.absent,
        pending: total.pending + row.pending,
        disputed: total.disputed + row.disputed,
      }),
      { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0 },
    )
    return { range, totals, summaries: rows }
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
    const evidence = this.scanEvidence(dto)
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
    const validation = await this.validateScan(user, evidence, false, receivedAt)
    if (!validation.success) {
      await this.recordScanAttempt(user, evidence, validation, 'denied')
    }
    return validation
  }

  async submit(user: RequestUser, dto: SubmitAttendanceDto) {
    return this.processScanSubmission(user, this.submitEvidence(dto), false)
  }

  async scan(user: RequestUser, dto: ScanAttendanceDto) {
    const result = await this.processScanSubmission(user, this.scanEvidence(dto), false)
    if (!result.success || !('record' in result)) return { error: result.message ?? 'Check-in rejected' }
    return result.record
  }

  async syncScan(user: RequestUser, dto: ScanAttendanceDto) {
    if (!dto.scannedAt) {
      return { error: 'Offline attendance records require the original scan timestamp' }
    }
    const result = await this.processScanSubmission(user, this.scanEvidence(dto), true)
    if (!result.success || !('record' in result)) return { error: result.message ?? 'Offline check-in rejected' }
    return result.record
  }

  private async processScanSubmission(user: RequestUser, evidence: ScanEvidence, offline: boolean) {
    const receivedAt = new Date()
    const tokenHash = createHash('sha256').update(evidence.qrToken).digest('hex')
    const replay = await this.findReplay(user.id, evidence, tokenHash)
    if (replay) return replay

    const withinLimit = await this.redis.consumeRateLimit(`scan:${user.id}:${evidence.sessionId}`, 10, 60)
    if (!withinLimit) {
      const validation: ScanValidation = {
        success: false,
        status: 'absent',
        reason: 'rate_limited',
        message: 'Too many scan attempts. Try again shortly.',
        scannedAt: this.clientScannedAt(evidence, offline, receivedAt),
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
        scannedAt: this.clientScannedAt(evidence, offline, receivedAt),
        receivedAt,
        riskSignals: ['expired_before_activation'],
      }
      await this.recordScanAttempt(user, evidence, validation, 'denied', offline)
      return validation
    }

    const validation = await this.validateScan(user, evidence, offline, receivedAt)
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
      (await this.hasSuspiciousCoordinates(
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
          data: this.scanAttemptData(user.id, evidence, validation, outcome, offline),
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
        const concurrentReplay = await this.findReplay(user.id, evidence, tokenHash)
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

  private async validateScan(
    user: RequestUser,
    evidence: ScanEvidence,
    offline: boolean,
    receivedAt: Date,
  ): Promise<ScanValidation> {
    const riskSignals: string[] = []
    const missingCoreEvidence: string[] = []
    if (!evidence.clientAttemptId) missingCoreEvidence.push('missing_client_attempt_id')
    if (evidence.accuracyMeters === undefined) missingCoreEvidence.push('missing_accuracy')
    if (!evidence.locationCapturedAt) missingCoreEvidence.push('missing_location_timestamp')
    if (!evidence.inputChannel) missingCoreEvidence.push('missing_input_channel')
    riskSignals.push(...missingCoreEvidence)
    if (evidence.mocked === undefined) riskSignals.push('mock_status_unavailable')
    if (evidence.inputChannel && evidence.inputChannel !== 'camera')
      riskSignals.push(`fallback_${evidence.inputChannel}`)
    const scannedAt = this.clientScannedAt(evidence, offline, receivedAt)
    const failed = (
      status: AttendanceStatus,
      reason: string,
      message: string,
      signals: string[] = [],
    ): ScanValidation => ({
      success: false,
      status,
      reason,
      message,
      scannedAt,
      receivedAt,
      riskSignals: [...riskSignals, ...signals],
    })

    const cached = await this.redis.getJson<CachedSession>(`active-session:${evidence.sessionId}`)
    const session = cached
      ? {
          ...cached,
          endedAt: cached.endedAt ? new Date(cached.endedAt) : null,
          qrTokenExpiresAt: cached.qrTokenExpiresAt ? new Date(cached.qrTokenExpiresAt) : null,
        }
      : await this.prisma.session.findUnique({ where: { id: evidence.sessionId } })
    if (!session) return failed('absent', 'session_not_found', 'Session not found')
    if (Number.isNaN(scannedAt.getTime()))
      return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['invalid_client_timestamp'])

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId: session.sectionId } },
    })
    if (!enrollment) return failed('absent', 'not_enrolled', 'You are not enrolled in this section')
    const teacherPublicKey =
      cached?.teacherPublicKey ??
      (await this.prisma.user.findUnique({ where: { id: session.teacherId }, select: { teacherPublicKey: true } }))
        ?.teacherPublicKey
    if (!teacherPublicKey) return failed('disputed', 'invalid_signature', 'Teacher signing key is unavailable')
    const payload = verifyQRToken(evidence.qrToken, teacherPublicKey)
    if (!payload) return failed('disputed', 'invalid_signature', 'QR token signature is invalid')
    if (
      (session.qrToken && evidence.qrToken !== session.qrToken) ||
      payload.sessionId !== session.id ||
      payload.sectionId !== session.sectionId ||
      payload.teacherId !== session.teacherId
    )
      return failed('disputed', 'token_mismatch', 'QR token does not match this session')

    const validityEnd = payload.issuedAt + payload.validityMinutes * 60_000
    const graceEnd = validityEnd + payload.gracePeriodMinutes * 60_000
    if (!session.isActive && !offline) return failed('absent', 'session_inactive', 'Session is not active')
    if (!session.isActive && offline && !session.endedAt)
      return failed('absent', 'session_inactive', 'Session was never activated')
    if (scannedAt.getTime() < payload.issuedAt - 30_000 || scannedAt.getTime() > receivedAt.getTime() + 5 * 60_000)
      return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['implausible_client_timestamp'])

    const distanceMeters = haversineDistance(
      evidence.latitude,
      evidence.longitude,
      session.geofenceLatitude,
      session.geofenceLongitude,
    )
    const withLocation = (validation: ScanValidation): ScanValidation => ({
      ...validation,
      distanceMeters,
      geofenceRadiusMeters: session.geofenceRadiusMeters,
    })
    if (evidence.mocked === true)
      return withLocation(
        failed('disputed', 'mocked_location', 'Mocked locations are not accepted', ['mocked_location']),
      )
    if (evidence.locationCapturedAt) {
      const locationCapturedAt = new Date(evidence.locationCapturedAt)
      const clientTimestamp = evidence.scannedAt ? new Date(evidence.scannedAt) : null
      const locationReference =
        clientTimestamp && !Number.isNaN(clientTimestamp.getTime()) ? clientTimestamp : scannedAt
      const age = locationReference.getTime() - locationCapturedAt.getTime()
      if (Number.isNaN(locationCapturedAt.getTime()) || age < -30_000 || age > MAX_LOCATION_AGE_MS)
        return withLocation(
          failed('disputed', 'stale_location', 'Location fix is stale or has an invalid timestamp', ['stale_location']),
        )
    }
    if (evidence.accuracyMeters !== undefined && evidence.accuracyMeters > MAX_LOCATION_ACCURACY_METERS)
      return withLocation(
        failed('disputed', 'poor_location_accuracy', 'Location accuracy is too poor to verify attendance', [
          'poor_accuracy',
        ]),
      )
    if (distanceMeters > session.geofenceRadiusMeters)
      return withLocation(
        failed('absent', 'outside_geofence', 'You are outside the session geofence', ['outside_geofence']),
      )
    if (
      evidence.accuracyMeters !== undefined &&
      distanceMeters + evidence.accuracyMeters > session.geofenceRadiusMeters
    )
      return withLocation(
        failed('disputed', 'geofence_uncertain', 'Location uncertainty extends outside the session geofence', [
          'geofence_uncertain',
        ]),
      )
    if (scannedAt.getTime() > graceEnd)
      return withLocation(
        failed('absent', 'qr_expired', 'The QR attendance window has expired', ['client_scan_outside_window']),
      )
    if (offline && (receivedAt.getTime() > graceEnd || session.endedAt)) {
      return {
        success: true,
        status: 'disputed',
        reason: 'delayed_offline_sync',
        scannedAt,
        receivedAt,
        message: 'Offline check-in arrived after the attendance window and requires teacher review.',
        distanceMeters,
        geofenceRadiusMeters: session.geofenceRadiusMeters,
        riskSignals: [
          ...riskSignals,
          'delayed_offline_sync',
          ...(session.endedAt ? ['received_after_session_end'] : []),
        ],
      }
    }
    if (missingCoreEvidence.length > 0) {
      return {
        success: true,
        status: 'disputed',
        reason: 'missing_scan_evidence',
        scannedAt,
        receivedAt,
        message: 'Legacy scan evidence is incomplete and requires teacher review.',
        distanceMeters,
        geofenceRadiusMeters: session.geofenceRadiusMeters,
        riskSignals,
      }
    }
    const status: AttendanceStatus = scannedAt.getTime() > validityEnd ? 'late' : 'present'
    return {
      success: true,
      status,
      scannedAt,
      receivedAt,
      message: status === 'late' ? 'Check-in recorded as late.' : 'Check-in successful.',
      distanceMeters,
      geofenceRadiusMeters: session.geofenceRadiusMeters,
      riskSignals,
    }
  }

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
        data: this.scanAttemptData(user.id, evidence, validation, outcome, offline),
      })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error
    }
  }

  private scanEvidence(dto: ScanAttendanceDto): ScanEvidence {
    return {
      sessionId: dto.sessionId,
      latitude: dto.lat,
      longitude: dto.lon,
      deviceId: dto.deviceId,
      qrToken: dto.qrToken,
      scannedAt: dto.scannedAt,
      clientAttemptId: dto.clientAttemptId,
      accuracyMeters: dto.accuracyMeters,
      locationCapturedAt: dto.locationCapturedAt,
      mocked: dto.mocked,
      inputChannel: dto.inputChannel,
    }
  }

  private submitEvidence(dto: SubmitAttendanceDto): ScanEvidence {
    return {
      sessionId: dto.sessionId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      deviceId: dto.deviceId,
      qrToken: dto.qrToken,
      scannedAt: dto.scannedAt,
      clientAttemptId: dto.clientAttemptId,
      accuracyMeters: dto.accuracyMeters,
      locationCapturedAt: dto.locationCapturedAt,
      mocked: dto.mocked,
      inputChannel: dto.inputChannel,
    }
  }

  private clientScannedAt(evidence: ScanEvidence, offline: boolean, receivedAt: Date) {
    return offline && evidence.scannedAt ? new Date(evidence.scannedAt) : receivedAt
  }

  private scanAttemptData(
    studentId: string,
    evidence: ScanEvidence,
    validation: ScanValidation,
    outcome: string,
    offline: boolean,
  ) {
    return {
      sessionId: evidence.sessionId,
      studentId,
      clientAttemptId: evidence.clientAttemptId,
      timestamp: validation.scannedAt,
      clientScannedAt: evidence.scannedAt ? new Date(evidence.scannedAt) : undefined,
      receivedAt: validation.receivedAt,
      locationCapturedAt: evidence.locationCapturedAt ? new Date(evidence.locationCapturedAt) : undefined,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      accuracyMeters: evidence.accuracyMeters,
      mocked: evidence.mocked,
      inputChannel: evidence.inputChannel,
      deviceId: evidence.deviceId,
      offline,
      distanceMeters: validation.distanceMeters,
      geofenceRadiusMeters: validation.geofenceRadiusMeters,
      riskSignals: validation.riskSignals,
      outcome,
      reason: validation.reason,
      message: validation.message,
      tokenHash: createHash('sha256').update(evidence.qrToken).digest('hex'),
    }
  }

  private async findReplay(studentId: string, evidence: ScanEvidence, tokenHash: string) {
    if (!evidence.clientAttemptId) return null
    const attempt = await this.prisma.scanAttempt.findUnique({
      where: { studentId_clientAttemptId: { studentId, clientAttemptId: evidence.clientAttemptId } },
      include: { acceptedAttendanceRecord: true },
    })
    if (!attempt) return null
    const clientScannedAt = evidence.scannedAt ? new Date(evidence.scannedAt).getTime() : null
    const locationCapturedAt = evidence.locationCapturedAt ? new Date(evidence.locationCapturedAt).getTime() : null
    const exactReplay =
      attempt.sessionId === evidence.sessionId &&
      attempt.tokenHash === tokenHash &&
      attempt.latitude === evidence.latitude &&
      attempt.longitude === evidence.longitude &&
      (attempt.deviceId ?? undefined) === evidence.deviceId &&
      (attempt.inputChannel ?? undefined) === evidence.inputChannel &&
      (attempt.accuracyMeters ?? undefined) === evidence.accuracyMeters &&
      (attempt.mocked ?? undefined) === evidence.mocked &&
      (attempt.clientScannedAt?.getTime() ?? null) === clientScannedAt &&
      (attempt.locationCapturedAt?.getTime() ?? null) === locationCapturedAt
    if (!exactReplay) {
      return {
        success: false,
        status: 'disputed' as const,
        reason: 'client_attempt_conflict',
        message: 'clientAttemptId was already used for a different scan payload',
      }
    }
    if (!attempt.acceptedAttendanceRecord) {
      return {
        success: false,
        status: 'disputed' as const,
        reason: attempt.reason ?? 'replayed_rejection',
        message: attempt.message ?? 'This scan attempt was already rejected',
      }
    }
    return {
      success: true,
      status: attempt.acceptedAttendanceRecord.status,
      message: 'Attendance was already acknowledged.',
      record: this.present(attempt.acceptedAttendanceRecord),
    }
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

  private async rawRecordWhere(user: RequestUser, query: AttendanceListQueryDto) {
    const hasDateRange = Boolean(query.startDate || query.endDate)
    if (hasDateRange && (!query.startDate || !query.endDate)) {
      throw new BadRequestException('Raw attendance date scopes require both startDate and endDate')
    }
    if (user.role !== 'student' && !query.sessionId && !query.sectionId && !hasDateRange) {
      throw new BadRequestException('Staff attendance lists require a sessionId, sectionId, or date range')
    }
    const range =
      query.startDate && query.endDate
        ? this.resolveDateRange(query.startDate, query.endDate, RAW_DATE_RANGE_DAYS, RAW_DATE_RANGE_DAYS)
        : undefined
    const sessionWhere: Prisma.SessionWhereInput = {
      AND: [await this.sessionScope(user), ...(range ? [{ date: { gte: range.startDate, lte: range.endDate } }] : [])],
    }
    return {
      AND: [
        await this.recordScope(user),
        { session: sessionWhere },
        ...(query.sessionId ? [{ sessionId: query.sessionId }] : []),
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
      ],
    } satisfies Prisma.AttendanceRecordWhereInput
  }

  private async filteredSessionScope(
    user: RequestUser,
    query: AttendanceReportQueryDto,
    range: { startDate: string; endDate: string },
  ): Promise<Prisma.SessionWhereInput> {
    if (user.role === 'teacher' && query.teacherId && query.teacherId !== user.id) {
      throw new ForbiddenException('Teachers can only report on their own attendance')
    }
    return {
      AND: [
        await this.sessionScope(user),
        { date: { gte: range.startDate, lte: range.endDate } },
        ...(query.teacherId ? [{ teacherId: query.teacherId }] : []),
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
        ...(query.sessionId ? [{ id: query.sessionId }] : []),
        ...(query.subjectId ? [{ section: { subjectId: query.subjectId } }] : []),
      ],
    }
  }

  private resolveDateRange(
    requestedStart: string | undefined,
    requestedEnd: string | undefined,
    maximumDays: number,
    defaultDays: number,
  ) {
    const endDate = requestedEnd ?? new Date().toISOString().slice(0, 10)
    const parsedEnd = this.parseDate(endDate)
    const defaultStart = new Date(parsedEnd)
    defaultStart.setUTCDate(defaultStart.getUTCDate() - (defaultDays - 1))
    const startDate = requestedStart ?? defaultStart.toISOString().slice(0, 10)
    const parsedStart = this.parseDate(startDate)
    if (parsedEnd < parsedStart) throw new BadRequestException('endDate must be on or after startDate')
    const dayCount = Math.floor((parsedEnd.getTime() - parsedStart.getTime()) / 86_400_000) + 1
    if (dayCount > maximumDays) {
      throw new BadRequestException(`Date ranges are limited to ${maximumDays} days`)
    }
    return { startDate, endDate }
  }

  private parseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Dates must use YYYY-MM-DD')
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Date is invalid')
    }
    return parsed
  }

  private async recordScope(user: RequestUser, sessionId?: string) {
    if (user.role === 'super_admin') {
      const adminScope =
        user.scope === 'institution'
          ? {}
          : user.department
            ? { session: { section: { teacher: { department: user.department } } } }
            : { id: { in: [] as string[] } }
      return { ...adminScope, ...(sessionId ? { sessionId } : {}) }
    }
    if (user.role === 'teacher') return { session: { teacherId: user.id }, ...(sessionId ? { sessionId } : {}) }
    return { studentId: user.id, ...(sessionId ? { sessionId } : {}) }
  }

  private async sessionScope(user: RequestUser) {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return {}
      return user.department
        ? { section: { teacher: { department: user.department } } }
        : { id: { in: [] as string[] } }
    }
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { sectionId: { in: enrollments.map((item) => item.sectionId) } }
  }

  private present(record: AttendanceRecord) {
    return { ...record, coordinates: { latitude: record.latitude, longitude: record.longitude } }
  }
}
