import { Injectable } from '@nestjs/common'
import { verifyQRToken } from '@polycheck/shared'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { ScanAttendanceDto, SubmitAttendanceDto } from './dto/attendance.dto'
import { RedisService } from '../infrastructure/redis.service'
import { GeofenceService } from './geofence.service'
import {
  MAX_LOCATION_ACCURACY_METERS,
  MAX_LOCATION_AGE_MS,
  type CachedSession,
  type ScanEvidence,
  type ScanValidation,
} from './types'

@Injectable()
export class ScanValidatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geofence: GeofenceService,
  ) {}

  async findReplay(studentId: string, evidence: ScanEvidence, tokenHash: string) {
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
      record: attempt.acceptedAttendanceRecord,
    }
  }

  async validateScan(
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
      status: ScanValidation['status'],
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

    const distanceMeters = this.geofence.calculateDistance(
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
    const status = scannedAt.getTime() > validityEnd ? 'late' : 'present'
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

  scanEvidenceFromScanDto(dto: ScanAttendanceDto): ScanEvidence {
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

  scanEvidenceFromSubmitDto(dto: SubmitAttendanceDto): ScanEvidence {
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

  clientScannedAt(evidence: ScanEvidence, offline: boolean, receivedAt: Date) {
    return offline && evidence.scannedAt ? new Date(evidence.scannedAt) : receivedAt
  }

  buildScanAttemptData(
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
}
