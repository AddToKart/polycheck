import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type {
  AttendanceListQueryDto,
  AttendanceReportQueryDto,
  CreateManualAttendanceDto,
  DecideExcuseDto,
  ListExcusesQueryDto,
  RequestExcuseDto,
  ScanAttendanceDto,
  SubmitAttendanceDto,
} from './dto/attendance.dto'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import { RedisService } from '../infrastructure/redis.service'
import { createHash } from 'crypto'
import type { AttendanceRecord, AttendanceStatus, Prisma } from '../prisma/client'
import { ScanValidatorService } from './scan-validator.service'
import { AttendanceScopeService } from './attendance-scope.service'
import { AttendanceReportService } from './attendance-report.service'
import { GeofenceService } from './geofence.service'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'
import { academicOversightDepartment } from '../common/designations/department-pin'
import { RAW_ATTENDANCE_LIMIT, type ScanEvidence, type ScanValidation } from './types'
import { assertStudentInAdminScope, adminRecordWhere } from '../common/admin-scope'
import { lockStudentSection } from '../common/student-section-lock'
import { ProofStorageService } from '../proofs/proof-storage.service'
import { decodeImageDataUrl } from '../proofs/image-evidence'
import { NotificationsService } from '../notifications/notifications.service'
import { DeviceBindingService } from '../users/device-binding.service'
import { LedgerService } from './ledger.service'
import type { ScanAttemptView } from '@polycheck/shared'

const OFFLINE_ACTIVATION_LOCK_TTL_SECONDS = 10
const OFFLINE_ACTIVATION_WAIT_ATTEMPTS = 5
const OFFLINE_ACTIVATION_WAIT_MS = 50
// Cache-hygiene lease only. Scan validation re-reads PostgreSQL session state
// and signing keys, so this lease does not require security fencing.
const KEY_ROTATION_LOCK_TTL_SECONDS = 10
const EXCUSE_REQUEST_RATE_LIMIT = 10
const EXCUSE_REQUEST_RATE_WINDOW_SECONDS = 24 * 60 * 60
const EXCUSE_LIST_LIMIT = 500

// Env-tunable concurrency-conflict policy (see plan/vulnerability-hardening-plan.md V2).
const CONCURRENT_SESSION_CONFLICT_DETECTION = envFlag(process.env.CONCURRENT_SESSION_CONFLICT_DETECTION, true)
const CONCURRENT_SESSION_LOOKBACK_MINUTES = positiveInt(process.env.CONCURRENT_SESSION_LOOKBACK_MINUTES, 30)

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

function parseClockMinutes(value: string | undefined | null): number | null {
  const match = typeof value === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value) : null
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Half-open HH:mm window overlap so back-to-back classes never trip the
 * conflict flag. Malformed clocks skip the intersection test (the recency
 * predicate decides).
 */
function scheduleWindowsIntersect(
  current: { date: string; startTime: string; endTime: string },
  other: { date: string; startTime: string; endTime: string },
): boolean {
  if (!current.date || !other.date || current.date !== other.date) return false
  const currentStart = parseClockMinutes(current.startTime)
  const currentEnd = parseClockMinutes(current.endTime)
  const otherStart = parseClockMinutes(other.startTime)
  const otherEnd = parseClockMinutes(other.endTime)
  if (currentStart === null || currentEnd === null || otherStart === null || otherEnd === null) return true
  return currentStart < otherEnd && otherStart < currentEnd
}

// These checks are client-reported heuristics, not cryptographic proof. They
// are persisted as disputed attendance so teachers can review the event and
// the server retains an auditable trail instead of silently dropping it.
const PERSISTABLE_SECURITY_DISPUTE_REASONS = new Set([
  'rooted_device',
  'hook_detected',
  'emulator_detected',
  'missing_location',
  'concurrent_session_conflict',
])

// F2 (WF-LD4): denial reasons that deserve a live radar anomaly marker —
// geolocation/geofence evidence failures plus duplicate/replay denials. PIN
// failures (`pin_incorrect`, `pin_locked`, `pin_required`) are authenticated
// students mistyping a secret, not geolocation anomalies, and online-mode
// events are never emitted: without coordinates there is nothing to plot.
const SCAN_ANOMALY_DENIAL_REASONS = new Set([
  'outside_geofence',
  'mocked_location',
  'poor_location_accuracy',
  'geofence_uncertain',
  'stale_location',
  'client_attempt_conflict',
  'replayed_rejection',
  'duplicate',
])

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: AttendanceGateway,
    private readonly redis: RedisService,
    private readonly scanValidator: ScanValidatorService,
    private readonly scope: AttendanceScopeService,
    private readonly reportService: AttendanceReportService,
    private readonly geofence: GeofenceService,
    private readonly ledger: LedgerService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly storage?: ProofStorageService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly deviceBinding?: DeviceBindingService,
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
    await assertStudentInAdminScope(user, studentId, this.prisma, sectionId)
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

  async findAttempts(user: RequestUser, sessionId?: string): Promise<(ScanAttemptView & ScanAttemptRawRow)[]> {
    const sessionWhere = await this.scope.sessionScope(user)
    const attempts = await this.prisma.scanAttempt.findMany({
      where: { ...(sessionId ? { sessionId } : {}), session: sessionWhere },
      include: {
        student: { select: { fullName: true, studentId: true } },
        session: { select: { subjectName: true, sectionId: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 1_000,
    })
    return attempts.map((attempt) => this.presentAttempt(attempt))
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
    if (!('record' in result)) return { error: result.message ?? 'Check-in rejected' }
    return result.record
  }

  async syncScan(user: RequestUser, dto: ScanAttendanceDto) {
    if (!dto.scannedAt) {
      return { error: 'Offline attendance records require the original scan timestamp', retryable: false as const }
    }
    const result = await this.processScanSubmission(user, this.scanValidator.scanEvidenceFromScanDto(dto), true)
    if (!('record' in result))
      return { error: result.message ?? 'Offline check-in rejected', retryable: false as const }
    return result.record
  }

  /**
   * V2 anti-teleportation: an otherwise-valid scan for a session whose
   * schedule overlaps an accepted check-in the student just landed elsewhere
   * (credit-bearing status, or an accepted online check-in leg) is flagged as
   * disputed for teacher review — never silently penalized. Runs only on
   * scans that already passed their own token/PIN/geofence validation so a
   * second diagnosis never replaces the first.
   */
  private async applyConcurrentSessionConflict(
    studentId: string,
    sessionId: string,
    validation: ScanValidation,
    receivedAt: Date,
  ): Promise<void> {
    if (!CONCURRENT_SESSION_CONFLICT_DETECTION) return
    const lookback = new Date(receivedAt.getTime() - CONCURRENT_SESSION_LOOKBACK_MINUTES * 60_000)
    const conflicting = await this.prisma.attendanceRecord.findFirst({
      where: {
        studentId,
        sessionId: { not: sessionId },
        timestamp: { gte: lookback },
        OR: [{ status: { in: ['present', 'late'] } }, { status: 'pending', checkInToken: { not: null } }],
      },
      orderBy: { timestamp: 'desc' },
      select: {
        status: true,
        session: { select: { subjectName: true, date: true, startTime: true, endTime: true, isActive: true } },
      },
    })
    if (!conflicting) return

    // Only adjudicate genuinely adjacent classes: matched calendar day with
    // overlapping meeting windows. The windows decide even for still-active
    // sessions (a stale zombie class never opened for today's slot must not
    // veto an unrelated upcoming section); when clocks are unparseable, the
    // recency predicate (already applied by the query) stands alone.
    const currentSession = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { date: true, startTime: true, endTime: true },
    })
    if (!currentSession || scheduleWindowsIntersect(currentSession, conflicting.session)) {
      validation.success = false
      validation.status = 'disputed'
      validation.reason = 'concurrent_session_conflict'
      validation.message = `Student is already recorded as present in concurrent session ${conflicting.session.subjectName}.`
      validation.riskSignals.push('concurrent_session_conflict')
    }
  }

  private async processScanSubmission(user: RequestUser, evidence: ScanEvidence, offline: boolean) {
    // Defensive device-cooldown gate: unregister revokes sessions, so a cooled
    // student normally cannot reach this path, but a session created just
    // before the unregister committed (or a manual DB edit) must not scan.
    await this.deviceBinding?.assertScanAllowed(user.id)
    const receivedAt = new Date()
    const tokenHash = createHash('sha256').update(evidence.qrToken).digest('hex')
    const replay = await this.scanValidator.findReplay(user.id, evidence, tokenHash)
    if (replay) {
      // F2: replayed denials are duplicate anomalies (same funnel rules as a
      // fresh rejection, minus a validation object — mode/distance are derived
      // from the session row by the emitter).
      if (!replay.success) {
        await this.maybeEmitScanAnomaly(user, evidence, replay.reason ?? 'replayed_rejection', {
          scannedAt: evidence.scannedAt ? new Date(evidence.scannedAt) : receivedAt,
        })
      }
      return replay
    }

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
    if (validation.success) {
      await this.applyConcurrentSessionConflict(user.id, evidence.sessionId, validation, receivedAt)
    }
    const persistableSecurityDispute =
      !validation.success &&
      validation.status === 'disputed' &&
      validation.reason !== undefined &&
      PERSISTABLE_SECURITY_DISPUTE_REASONS.has(validation.reason)
    if (!validation.success && !persistableSecurityDispute) {
      await this.recordScanAttempt(user, evidence, validation, 'denied', offline)
      return validation
    }
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: evidence.sessionId, studentId: user.id } },
    })
    // Online sessions are location-free (RA 10173): the plausibility heuristic
    // runs only for in-person evidence that actually carries coordinates.
    const suspiciousCoordinates =
      validation.mode === 'in_person' &&
      validation.status !== 'disputed' &&
      evidence.latitude !== undefined &&
      evidence.longitude !== undefined &&
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
    let transactionResult: { record: AttendanceRecord | null; priorStatus: AttendanceStatus }
    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        let rosterRecord = existing
        if (!rosterRecord) {
          const session = await tx.session.findUnique({
            where: { id: evidence.sessionId },
            select: {
              id: true,
              sectionId: true,
              mode: true,
              geofenceLatitude: true,
              geofenceLongitude: true,
            },
          })
          if (!session) throw new NotFoundException('Session not found')
          await lockStudentSection(tx, user.id, session.sectionId)
          const enrollment = await tx.enrollment.findUnique({
            where: { studentId_sectionId: { studentId: user.id, sectionId: session.sectionId } },
            include: { student: { select: { fullName: true, program: true } } },
          })
          if (!enrollment) throw new ForbiddenException('You are not enrolled in this section')

          rosterRecord = await tx.attendanceRecord.upsert({
            where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
            create: {
              sessionId: session.id,
              sectionId: session.sectionId,
              studentId: user.id,
              studentName: enrollment.student.fullName,
              studentProgram: enrollment.student.program,
              timestamp: validation.scannedAt,
              status: 'pending',
              latitude: session.mode === 'online' ? null : session.geofenceLatitude,
              longitude: session.mode === 'online' ? null : session.geofenceLongitude,
              isSynced: true,
              syncedAt: receivedAt,
            },
            update: {},
          })
        } else {
          // Re-check enrollment inside the transaction: a student removed after
          // the validator's earlier check (but before this write commits) must
          // not receive an attendance record.
          await lockStudentSection(tx, user.id, rosterRecord.sectionId)
          const enrollment = await tx.enrollment.findUnique({
            where: { studentId_sectionId: { studentId: user.id, sectionId: rosterRecord.sectionId } },
            select: { id: true },
          })
          if (!enrollment) throw new ForbiddenException('You are not enrolled in this section')
        }
        const attempt = await tx.scanAttempt.create({
          data: this.scanValidator.buildScanAttemptData(user.id, evidence, validation, outcome, offline),
        })
        const online = validation.mode === 'online'
        const updated = online
          ? await tx.attendanceRecord.updateMany({
              where: {
                id: rosterRecord.id,
                status: disputed ? { in: ['pending', 'absent'] } : 'pending',
                manuallySet: false,
                ...(validation.checkpoint === 'start' ? { checkInToken: null } : { checkOutToken: null }),
              },
              data: {
                ...(validation.checkpoint === 'start'
                  ? {
                      checkInTime: validation.scannedAt,
                      checkInStatus: validation.status,
                      checkInToken: evidence.qrToken,
                      checkInAttemptId: attempt.id,
                      timestamp: validation.scannedAt,
                    }
                  : {
                      checkOutTime: validation.scannedAt,
                      checkOutStatus: 'present' as const,
                      checkOutToken: evidence.qrToken,
                      checkOutAttemptId: attempt.id,
                    }),
                latitude: null,
                longitude: null,
                deviceId: evidence.deviceId,
                isSynced: true,
                syncedAt: receivedAt,
                // Between checkpoints the row stays pending; the final
                // present/late/incomplete/absent resolution runs at session end.
                ...(disputed
                  ? {
                      status: 'disputed' as const,
                      disputeReason: suspiciousCoordinates ? 'suspicious_coordinates' : validation.reason,
                      disputeDescription: suspiciousCoordinates
                        ? 'Coordinates were implausibly identical across multiple sessions and require review.'
                        : validation.message,
                    }
                  : {}),
              },
            })
          : await tx.attendanceRecord.updateMany({
              where: {
                id: rosterRecord.id,
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
          return { record: null, priorStatus: rosterRecord.status }
        }
        const committed = await tx.attendanceRecord.findUniqueOrThrow({ where: { id: rosterRecord.id } })
        // Tamper evidence (F9/WF-LD11): the chain write lives inside the same
        // transaction as the record commit. Any ledger failure rolls back the
        // attendance commit entirely (fail closed); offline sync batches land
        // here too (arrival order is the linkage order), as do online scans.
        await this.ledger.appendLedger(tx, {
          id: committed.id,
          sessionId: committed.sessionId,
          studentId: committed.studentId,
          timestamp: committed.timestamp,
        })
        return {
          record: committed,
          priorStatus: rosterRecord.status,
        }
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const concurrentReplay = await this.scanValidator.findReplay(user.id, evidence, tokenHash)
        if (concurrentReplay && concurrentReplay.success && 'record' in concurrentReplay) return concurrentReplay
      }
      throw error
    }
    if (!transactionResult.record) {
      // F2: replay anomalies include duplicate submissions for the same session.
      await this.maybeEmitScanAnomaly(user, evidence, 'duplicate', {
        mode: validation.mode,
        distanceMeters: validation.distanceMeters,
        geofenceRadiusMeters: validation.geofenceRadiusMeters,
        scannedAt: validation.scannedAt,
      })
      return {
        success: false,
        status: transactionResult.priorStatus,
        reason: 'duplicate',
        message: 'Attendance was already submitted for this session',
      }
    }
    // Lazy device binding on the first accepted scan for students whose account
    // predates device binding. Failures must not undo the committed record.
    if (this.deviceBinding) {
      try {
        await this.deviceBinding.registerBinding(user.id, evidence.deviceId, user.role)
      } catch (error) {
        this.logger.warn(
          `Could not bind device for student ${user.id} after accepted scan: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
    this.realtime.emitAttendanceUpdated(transactionResult.record)
    return { ...validation, status: finalStatus, record: this.present(transactionResult.record) }
  }

  // ── Manual status updates ──

  async updateStatus(
    user: RequestUser,
    id: string,
    status: 'present' | 'late' | 'absent' | 'pending' | 'disputed' | 'incomplete',
  ) {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can update attendance statuses')
    }
    // `pending` is reserved for system resolution; a manual pending row can
    // never be resolved by the online closer (DD-B6).
    if (status === 'pending') {
      throw new BadRequestException('Pending is a system state and cannot be set manually')
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
    const now = new Date()
    const record = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: dto.sessionId, studentId: dto.studentId } },
        create: {
          sessionId: dto.sessionId,
          sectionId: dto.sectionId,
          studentId: dto.studentId,
          studentName: enrollment.student.fullName,
          studentProgram: enrollment.student.program,
          timestamp: now,
          status: dto.status,
          latitude: session.geofenceLatitude,
          longitude: session.geofenceLongitude,
          deviceId: 'manual',
          isSynced: true,
          syncedAt: now,
          manuallySet: true,
        },
        // A manual re-mark never rewrites the timestamp: the stored recordHash
        // covers the scan/seed moment and chain nodes are immutable. Recency
        // remains visible through updatedAt.
        update: { status: dto.status, manuallySet: true },
      })
      await this.ledger.appendLedger(tx, {
        id: row.id,
        sessionId: row.sessionId,
        studentId: row.studentId,
        timestamp: row.timestamp,
      })
      return row
    })
    this.realtime.emitAttendanceUpdated(record)
    return this.present(record)
  }

  // ── Excuse workflow ──

  async requestExcuse(user: RequestUser, recordId: string, dto: RequestExcuseDto) {
    if (user.role !== 'student') {
      throw new ForbiddenException('Only students can request attendance excuses')
    }
    const withinLimit = await this.redis.consumeRateLimit(
      `attendance:excuse:request:${user.id}`,
      EXCUSE_REQUEST_RATE_LIMIT,
      EXCUSE_REQUEST_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many excuse requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        session: { select: { teacherId: true, subjectName: true, date: true } },
      },
    })
    if (!record) throw new NotFoundException('Attendance record not found')
    if (record.studentId !== user.id) {
      throw new ForbiddenException('You can only request an excuse for your own attendance')
    }
    if (record.status !== 'absent' && record.status !== 'late' && record.status !== 'incomplete') {
      throw new BadRequestException('Only absent, late, or incomplete attendance can be excused')
    }
    if (record.excuseStatus === 'requested') {
      throw new ConflictException('This attendance record already has an open excuse request')
    }
    if (record.excuseStatus === 'approved') {
      throw new ConflictException('This attendance record already has an approved excuse')
    }

    let evidencePath: string | undefined
    if (dto.evidenceData) {
      if (!this.storage) throw new BadRequestException('Evidence storage is not configured')
      const maxBytes = this.config?.get<number>('MAX_PROOF_BYTES') ?? 5_000_000
      const image = decodeImageDataUrl(dto.evidenceData, maxBytes, 'Excuse evidence')
      evidencePath = await this.storage.store(image.buffer, image.extension, image.mime)
    }

    let updated: AttendanceRecord
    try {
      updated = await this.prisma.attendanceRecord.update({
        where: { id: recordId },
        data: {
          excuseStatus: 'requested',
          excuseReason: dto.reason,
          excuseDescription: dto.description.trim(),
          excuseEvidencePath: evidencePath ?? record.excuseEvidencePath ?? null,
          excuseReviewedBy: null,
          excuseReviewedAt: null,
          excuseReviewNote: null,
        },
      })
    } catch (error) {
      if (evidencePath) {
        try {
          await this.storage?.remove(evidencePath)
        } catch (removeError) {
          this.logger.warn(`Could not remove unused excuse evidence: ${String(removeError)}`)
        }
      }
      throw error
    }
    if (evidencePath && record.excuseEvidencePath && record.excuseEvidencePath !== evidencePath) {
      try {
        await this.storage?.remove(record.excuseEvidencePath)
      } catch (error) {
        this.logger.warn(`Could not remove replaced excuse evidence: ${String(error)}`)
      }
    }

    await this.notifications?.notify(record.session.teacherId, {
      type: 'excuse_requested',
      title: 'New excuse request',
      body: `${record.studentName} requested an excuse for ${record.session.subjectName} on ${record.session.date}.`,
      link: '/faculty/excuses',
    })
    await this.recordExcuseAudit(user, 'attendance.excuse.requested', recordId, {
      sectionId: record.sectionId,
      sessionId: record.sessionId,
      reason: dto.reason,
      hasEvidence: Boolean(evidencePath),
    })
    return this.present(updated)
  }

  async listExcuses(user: RequestUser, query: ListExcusesQueryDto = {}) {
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      throw new ForbiddenException('Attendance excuses are only available to teachers and administrators')
    }
    if (query.startDate && query.endDate && query.endDate < query.startDate) {
      throw new BadRequestException('endDate must be on or after startDate')
    }
    const oversight = academicOversightDepartment(user)
    const scope: Prisma.AttendanceRecordWhereInput =
      user.role === 'teacher'
        ? oversight
          ? { session: { section: { teacher: { department: { equals: oversight, mode: 'insensitive' } } } } }
          : { session: { teacherId: user.id } }
        : adminRecordWhere(user)
    const where: Prisma.AttendanceRecordWhereInput = {
      AND: [
        scope,
        { excuseStatus: { not: null } },
        ...(query.status ? [{ excuseStatus: query.status }] : []),
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
        ...(query.startDate || query.endDate
          ? [
              {
                session: {
                  date: {
                    ...(query.startDate ? { gte: query.startDate } : {}),
                    ...(query.endDate ? { lte: query.endDate } : {}),
                  },
                },
              },
            ]
          : []),
      ],
    }
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: EXCUSE_LIST_LIMIT,
      include: {
        session: { select: { date: true, startTime: true, endTime: true, subjectName: true } },
        section: { select: { section: true, subject: { select: { name: true, code: true } } } },
        student: { select: { id: true, studentId: true, fullName: true, program: true } },
      },
    })
    return records.map((record) => this.present(record))
  }

  async decideExcuse(user: RequestUser, recordId: string, dto: DecideExcuseDto) {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can decide attendance excuses')
    }
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        session: {
          select: {
            teacherId: true,
            subjectName: true,
            date: true,
            section: { select: { teacher: { select: { department: true } } } },
          },
        },
      },
    })
    if (!record) throw new NotFoundException('Attendance record not found')
    const oversight = academicOversightDepartment(user)
    const departmentMatch =
      oversight !== null && record.session.section.teacher.department?.toLowerCase() === oversight.toLowerCase()
    if (record.session.teacherId !== user.id && !departmentMatch) {
      throw new ForbiddenException(
        oversight
          ? 'You can only decide excuses in your own sessions or within your department'
          : 'You can only decide excuses in your own sessions',
      )
    }
    if (record.excuseStatus !== 'requested') {
      throw new ConflictException('This excuse request has already been decided')
    }
    const approved = dto.decision === 'approve'
    const reviewedAt = new Date()
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        ...(approved ? { status: 'excused' as const } : {}),
        excuseStatus: approved ? 'approved' : 'rejected',
        excuseReviewedBy: user.id,
        excuseReviewedAt: reviewedAt,
        excuseReviewNote: dto.note?.trim() || null,
      },
    })
    await this.notifications?.notify(record.studentId, {
      type: 'excuse_decided',
      title: approved ? 'Excuse approved' : 'Excuse rejected',
      body: `Your excuse request for ${record.session.subjectName} on ${record.session.date} was ${
        approved ? 'approved' : 'rejected'
      }.`,
      link: '/student/dashboard',
    })
    await this.recordExcuseAudit(
      user,
      approved ? 'attendance.excuse.approved' : 'attendance.excuse.rejected',
      recordId,
      {
        sectionId: record.sectionId,
        sessionId: record.sessionId,
        studentId: record.studentId,
        reason: record.excuseReason ?? undefined,
      },
    )
    return this.present(updated)
  }

  private async recordExcuseAudit(
    user: RequestUser,
    action: string,
    recordId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action,
          entityType: 'attendance',
          entityId: recordId,
          metadata,
        },
      })
    } catch (error) {
      this.logger.warn(`Could not write ${action} audit row for record ${recordId}: ${String(error)}`)
    }
  }

  private async ensureOfflineActivation(sessionId: string, qrToken: string, receivedAt: Date, offline: boolean) {
    // Serialize concurrent offline-activation attempts per session to prevent
    // two scans from both passing the qrToken-null check and creating duplicate state.
    const lockKey = `offline-activation:${sessionId}`
    const lockToken = await this.redis.acquireLock(lockKey, OFFLINE_ACTIVATION_LOCK_TTL_SECONDS)
    if (!lockToken) return this.waitForConcurrentOfflineActivation(sessionId, qrToken, receivedAt, offline)
    try {
      return await this.performOfflineActivation(sessionId, qrToken, receivedAt, offline)
    } finally {
      await this.redis.releaseLock(lockKey, lockToken)
    }
  }

  private async waitForConcurrentOfflineActivation(
    sessionId: string,
    qrToken: string,
    receivedAt: Date,
    offline: boolean,
  ) {
    for (let attempt = 0; attempt < OFFLINE_ACTIVATION_WAIT_ATTEMPTS; attempt += 1) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: { qrToken: true, endedAt: true },
      })
      if (!session || session.qrToken || session.endedAt) return 'unchanged' as const
      if (attempt < OFFLINE_ACTIVATION_WAIT_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, OFFLINE_ACTIVATION_WAIT_MS))
      }
    }

    // The database claim below is still authoritative. If the lock owner is
    // committing, updateMany waits for that row and loses the claim safely;
    // if the lock was abandoned, this request can recover the activation.
    return this.performOfflineActivation(sessionId, qrToken, receivedAt, offline)
  }

  private async performOfflineActivation(sessionId: string, qrToken: string, receivedAt: Date, offline: boolean) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) return 'unchanged' as const
    // Online checkpoints are armed by the teacher cockpit only; a student sync
    // must never create checkpoint state (the teacher's signed token is the
    // authority for the window and PIN hash).
    if (session.mode === 'online') return 'unchanged' as const
    if (session.qrToken || session.endedAt) return 'unchanged' as const
    const teacher = await this.prisma.user.findUnique({
      where: { id: session.teacherId },
      select: { teacherPublicKey: true },
    })
    if (!teacher?.teacherPublicKey) return 'unchanged' as const
    const payload = verifyQRTokenNative(qrToken, teacher.teacherPublicKey)
    if (
      !payload ||
      payload.sessionId !== session.id ||
      payload.sectionId !== session.sectionId ||
      payload.teacherId !== session.teacherId
    )
      return 'unchanged' as const
    if (
      payload.validityMinutes < 1 ||
      payload.validityMinutes > 15 ||
      payload.gracePeriodMinutes < 0 ||
      payload.gracePeriodMinutes > 60
    )
      return 'unchanged' as const
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
          // Mirrors activateInPerson: without a deadline the auto-end cron
          // (filter `autoEndAt: { not: null }`) never sweeps this session and
          // every seeded roster row stays `pending` forever (DD-B1).
          autoEndAt: expired ? receivedAt : new Date(expiresAt.getTime() + payload.gracePeriodMinutes * 60_000),
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
        try {
          // Serialize against key rotation so a revoked key cannot be
          // re-published, and re-read the key at publish time (fail closed).
          const lockKey = `key-rotation:${activated.teacherId}`
          const lockToken = await this.redis.acquireLock(lockKey, KEY_ROTATION_LOCK_TTL_SECONDS)
          if (!lockToken) {
            Logger.warn(
              `Skipping offline activation cache publish for session ${activated.id}: signing key rotation in progress`,
              'AttendanceService',
            )
          } else {
            try {
              const [currentSession, currentKey] = await Promise.all([
                this.prisma.session.findUnique({ where: { id: activated.id } }),
                this.prisma.user.findUnique({
                  where: { id: activated.teacherId },
                  select: { teacherPublicKey: true },
                }),
              ])
              if (!currentSession?.isActive || currentSession.endedAt || !currentSession.qrToken) {
                const deleted = await this.redis.delete(`active-session:${activated.id}`)
                if (!deleted) {
                  Logger.warn(
                    `Could not distribute offline activation cache invalidation for ended session ${activated.id}`,
                    'AttendanceService',
                  )
                }
              } else {
                const ttlSeconds = Math.max(
                  300,
                  (currentSession.qrValidityMinutes + currentSession.gracePeriodMinutes) * 60,
                )
                const published = await this.redis.setJson(
                  `active-session:${currentSession.id}`,
                  { ...currentSession, teacherPublicKey: currentKey?.teacherPublicKey ?? undefined },
                  ttlSeconds,
                )
                if (!published) {
                  Logger.warn(
                    `Offline activation cache publication was not distributed for session ${currentSession.id}`,
                    'AttendanceService',
                  )
                }
              }
            } finally {
              await this.redis.releaseLock(lockKey, lockToken)
            }
          }
        } catch (error) {
          Logger.error(
            `Failed to publish offline activation cache for session ${activated.id}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
            'AttendanceService',
          )
        }
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
    const session = await this.prisma.session.findUnique({
      where: { id: evidence.sessionId },
      select: { id: true, mode: true, geofenceLatitude: true, geofenceLongitude: true, geofenceRadiusMeters: true },
    })
    if (!session) return
    try {
      await this.prisma.scanAttempt.create({
        data: this.scanValidator.buildScanAttemptData(user.id, evidence, validation, outcome, offline),
      })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error
    }
    await this.maybeEmitScanAnomaly(user, evidence, validation.reason ?? '', validation)
  }

  // ── Private: F2 anomaly broadcast ──

  /**
   * F2 (WF-LD4): emits `attendance:anomaly` to the session room for denied
   * in-person attempts carrying coordinates. The validator stays pure; all
   * denial funnels route through here. Never throws: a realtime outage must
   * not break the scan response or the persisted attempt.
   */
  private async maybeEmitScanAnomaly(
    user: RequestUser,
    evidence: ScanEvidence,
    reason: string,
    context: Pick<ScanValidation, 'mode' | 'distanceMeters' | 'geofenceRadiusMeters' | 'scannedAt'>,
  ) {
    try {
      if (!SCAN_ANOMALY_DENIAL_REASONS.has(reason)) return
      if (evidence.latitude === undefined || evidence.longitude === undefined) return
      // Online sessions are location-free (RA 10173): no coordinates, no event.
      let mode = context.mode
      let distanceMeters = context.distanceMeters
      let geofenceRadiusMeters = context.geofenceRadiusMeters
      if (mode === undefined || distanceMeters === undefined) {
        const session = await this.prisma.session.findUnique({
          where: { id: evidence.sessionId },
          select: { id: true, mode: true, geofenceLatitude: true, geofenceLongitude: true, geofenceRadiusMeters: true },
        })
        if (!session) return
        mode = mode ?? session.mode ?? 'in_person'
        if (distanceMeters === undefined && session.geofenceLatitude !== null && session.geofenceLongitude !== null) {
          distanceMeters = this.geofence.calculateDistance(
            evidence.latitude,
            evidence.longitude,
            session.geofenceLatitude,
            session.geofenceLongitude,
          )
        }
        if (geofenceRadiusMeters === undefined && session.geofenceRadiusMeters !== null) {
          geofenceRadiusMeters = session.geofenceRadiusMeters
        }
      }
      if (mode !== 'in_person') return
      const student = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true, studentId: true },
      })
      this.realtime.emitAttendanceAnomaly(
        { id: evidence.sessionId },
        {
          sessionId: evidence.sessionId,
          studentId: user.id,
          ...(student?.fullName ? { studentName: student.fullName } : {}),
          ...(student?.studentId ? { studentNumber: student.studentId } : {}),
          latitude: evidence.latitude,
          longitude: evidence.longitude,
          distanceMeters: distanceMeters ?? null,
          geofenceRadiusMeters: geofenceRadiusMeters ?? null,
          reason,
          timestamp: (
            context.scannedAt ?? this.scanValidator.clientScannedAt(evidence, false, new Date())
          ).toISOString(),
        },
      )
    } catch (error) {
      this.logger.warn(
        `Could not emit attendance anomaly for session ${evidence.sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  // ── Private: presentation helper ──

  private present(record: AttendanceRecord) {
    return { ...record, coordinates: { latitude: record.latitude, longitude: record.longitude } }
  }

  private presentAttempt(attempt: ScanAttemptWithJoins): ScanAttemptView & ScanAttemptRawRow {
    const { latitude, longitude, deviceId, outcome, reason } = attempt
    const viewOutcome =
      outcome === 'denied' ? ('denied' as const) : outcome === 'flagged' ? ('pending' as const) : ('accepted' as const)
    return {
      ...attempt,
      timestamp: attempt.timestamp.toISOString(),
      clientScannedAt: attempt.clientScannedAt?.toISOString() ?? null,
      receivedAt: attempt.receivedAt.toISOString(),
      studentName: attempt.student?.fullName ?? '',
      studentNumber: attempt.student?.studentId ?? undefined,
      coordinates: { latitude, longitude },
      accuracyMeters: attempt.accuracyMeters,
      distanceMeters: attempt.distanceMeters,
      geofenceRadiusMeters: attempt.geofenceRadiusMeters,
      mocked: attempt.mocked,
      pinVerified: attempt.pinVerified,
      offline: attempt.offline,
      inputChannel: attempt.inputChannel,
      checkpoint: attempt.checkpoint,
      outcome: viewOutcome,
      denialReason: reason,
      deviceIdMasked: maskDeviceId(deviceId),
    }
  }
}

type ScanAttemptWithJoins = Prisma.ScanAttemptGetPayload<{
  include: {
    student: { select: { fullName: true; studentId: true } }
    session: { select: { subjectName: true; sectionId: true } }
  }
}>

type ScanAttemptRawRow = Omit<
  ScanAttemptWithJoins,
  'outcome' | 'timestamp' | 'clientScannedAt' | 'receivedAt' | 'locationCapturedAt' | 'createdAt'
>

function maskDeviceId(deviceId: string | null | undefined) {
  return deviceId ? `…${deviceId.slice(-4)}` : null
}
