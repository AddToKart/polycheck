import { Injectable } from '@nestjs/common'
import { verifyMeetingPin, verifyQRToken } from '@polycheck/shared'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { ScanAttendanceDto, SubmitAttendanceDto } from './dto/attendance.dto'
import { RedisService } from '../infrastructure/redis.service'
import { GeofenceService } from './geofence.service'
import {
  MAX_LOCATION_ACCURACY_METERS,
  MAX_LOCATION_AGE_MS,
  MAX_ONLINE_CHECKPOINT_VALIDITY_SECONDS,
  MAX_WEB_LOCATION_ACCURACY_METERS,
  MIN_ONLINE_CHECKPOINT_VALIDITY_SECONDS,
  PIN_ATTEMPT_LIMIT,
  PIN_ATTEMPT_WINDOW_SECONDS,
  type CachedSession,
  type ScanEvidence,
  type ScanValidation,
} from './types'
import {
  getDeviceSecuritySignals,
  getPrimaryDeviceSecurityDispute,
  matchesStoredDeviceSecurityEvidence,
} from './device-security-policy'

const MAX_QR_VALIDITY_MINUTES = 15
const MAX_QR_GRACE_MINUTES = 60

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
      include: { acceptedAttendanceRecord: true, acceptedCheckInRecord: true, acceptedCheckOutRecord: true },
    })
    if (!attempt) return null
    const clientScannedAt = evidence.scannedAt ? new Date(evidence.scannedAt).getTime() : null
    const locationCapturedAt = evidence.locationCapturedAt ? new Date(evidence.locationCapturedAt).getTime() : null
    const exactReplay =
      attempt.sessionId === evidence.sessionId &&
      attempt.tokenHash === tokenHash &&
      (attempt.latitude ?? null) === (evidence.latitude ?? null) &&
      (attempt.longitude ?? null) === (evidence.longitude ?? null) &&
      (attempt.deviceId ?? undefined) === evidence.deviceId &&
      (attempt.inputChannel ?? undefined) === evidence.inputChannel &&
      (attempt.accuracyMeters ?? undefined) === evidence.accuracyMeters &&
      (attempt.mocked ?? undefined) === evidence.mocked &&
      matchesStoredDeviceSecurityEvidence(evidence.deviceSecurity, attempt.riskSignals) &&
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
    const accepted = [
      attempt.acceptedAttendanceRecord,
      attempt.acceptedCheckInRecord,
      attempt.acceptedCheckOutRecord,
    ].find((record) => record !== null)
    if (!accepted) {
      return {
        success: false,
        status: 'disputed' as const,
        reason: attempt.reason ?? 'replayed_rejection',
        message: attempt.message ?? 'This scan attempt was already rejected',
      }
    }
    return {
      success: true,
      status: attempt.acceptedCheckInRecord?.checkInStatus ?? accepted.status,
      message: 'Attendance was already acknowledged.',
      record: accepted,
    }
  }

  async validateScan(
    user: RequestUser,
    evidence: ScanEvidence,
    offline: boolean,
    receivedAt: Date,
  ): Promise<ScanValidation> {
    const riskSignals: string[] = []
    let mode: ScanValidation['mode'] = undefined
    let checkpoint: 'start' | 'end' | undefined = undefined
    if (evidence.mocked === undefined) riskSignals.push('mock_status_unavailable')
    if (evidence.mocked) riskSignals.push('mocked_location')
    riskSignals.push(...getDeviceSecuritySignals(evidence.deviceSecurity))
    if (evidence.inputChannel && evidence.inputChannel !== 'camera')
      riskSignals.push(`fallback_${evidence.inputChannel}`)
    const scannedAt = this.clientScannedAt(evidence, offline, receivedAt)
    let distanceMeters: number | undefined
    let geofenceRadiusMeters: number | undefined
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
      mode,
      checkpoint,
      riskSignals: [...riskSignals, ...signals],
    })

    const [cached, authoritativeSession] = await Promise.all([
      this.redis.getJson<CachedSession>(`active-session:${evidence.sessionId}`),
      this.prisma.session.findUnique({ where: { id: evidence.sessionId } }),
    ])
    // Redis is advisory metadata only. PostgreSQL always overwrites the cached
    // session state, so a failed DEL/SET or publish-after-end race cannot make
    // an ended session active during validation.
    const session = authoritativeSession ? { ...cached, ...authoritativeSession } : null
    if (!session) return failed('absent', 'session_not_found', 'Session not found')
    // Cached snapshots written before hybrid mode existed (Redis/SQLite blobs)
    // may not carry `mode`; defaulting keeps them in-person as recorded.
    mode = session.mode ?? 'in_person'
    if (Number.isNaN(scannedAt.getTime()))
      return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['invalid_client_timestamp'])

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId: session.sectionId } },
    })
    if (!enrollment) return failed('absent', 'not_enrolled', 'You are not enrolled in this section')
    // The database key is authoritative on every scan. Cached keys may be
    // stale after rotation/revocation and are intentionally never trusted.
    const teacherPublicKey = (
      await this.prisma.user.findUnique({ where: { id: session.teacherId }, select: { teacherPublicKey: true } })
    )?.teacherPublicKey
    if (!teacherPublicKey) return failed('disputed', 'invalid_signature', 'Teacher signing key is unavailable')
    const payload = verifyQRToken(evidence.qrToken, teacherPublicKey)
    if (!payload) return failed('disputed', 'invalid_signature', 'QR token signature is invalid')

    // ── Mode parity ──
    const tokenMode = payload.mode ?? 'in_person'
    if (tokenMode !== mode) {
      return failed('disputed', 'token_mismatch', 'QR token does not match this session mode')
    }

    const online = mode === 'online'
    if (online) {
      checkpoint = payload.checkpoint
      if (checkpoint !== 'start' && checkpoint !== 'end') {
        return failed('disputed', 'token_mismatch', 'QR token is missing its checkpoint')
      }
      if (
        payload.validitySeconds === undefined ||
        !Number.isInteger(payload.validitySeconds) ||
        payload.validitySeconds < MIN_ONLINE_CHECKPOINT_VALIDITY_SECONDS ||
        payload.validitySeconds > MAX_ONLINE_CHECKPOINT_VALIDITY_SECONDS
      ) {
        return failed('disputed', 'token_mismatch', 'QR token timing is outside the allowed policy')
      }
      if (checkpoint === 'end' && payload.gracePeriodMinutes !== 0) {
        return failed('disputed', 'token_mismatch', 'End-of-class QR codes have no grace period')
      }
    } else if (
      !Number.isInteger(payload.validityMinutes) ||
      payload.validityMinutes < 1 ||
      payload.validityMinutes > MAX_QR_VALIDITY_MINUTES ||
      !Number.isInteger(payload.gracePeriodMinutes) ||
      payload.gracePeriodMinutes < 0 ||
      payload.gracePeriodMinutes > MAX_QR_GRACE_MINUTES
    ) {
      return failed('disputed', 'token_mismatch', 'QR token timing is outside the allowed policy')
    }

    const validityMs = online ? (payload.validitySeconds ?? 0) * 1000 : payload.validityMinutes * 60_000
    const validityEnd = payload.issuedAt + validityMs
    const graceMs = online && checkpoint === 'end' ? 0 : payload.gracePeriodMinutes * 60_000
    const graceEnd = validityEnd + graceMs

    if (online) {
      const armedToken = checkpoint === 'start' ? session.startQrToken : session.endQrToken
      const tokenMatchesSession =
        payload.sessionId === session.id &&
        payload.sectionId === session.sectionId &&
        payload.teacherId === session.teacherId
      // `end()` and the auto-end cron null the armed token columns. A live
      // session keeps the strict armed-token gate; an offline replay whose
      // class already closed falls through to the delayed_offline_sync branch
      // below (DD-B4) so verified evidence is kept for teacher review instead
      // of being discarded as `checkpoint_not_armed`.
      if (!armedToken) {
        const replayedAfterClose = offline && (Boolean(session.endedAt) || receivedAt.getTime() > graceEnd)
        if (!replayedAfterClose) {
          return failed('absent', 'checkpoint_not_armed', 'This checkpoint has not been opened yet')
        }
        if (!tokenMatchesSession) {
          return failed('disputed', 'token_mismatch', 'QR token does not match this session')
        }
      } else if (evidence.qrToken !== armedToken || !tokenMatchesSession) {
        return failed('disputed', 'token_mismatch', 'QR token does not match this session')
      }
    } else {
      if (
        (session.qrToken && evidence.qrToken !== session.qrToken) ||
        payload.sessionId !== session.id ||
        payload.sectionId !== session.sectionId ||
        payload.teacherId !== session.teacherId
      ) {
        return failed('disputed', 'token_mismatch', 'QR token does not match this session')
      }
    }

    if (!session.isActive && !offline) return failed('absent', 'session_inactive', 'Session is not active')
    if (!session.isActive && offline && !session.endedAt)
      return failed('absent', 'session_inactive', 'Session was never activated')
    // A device clock behind the QR issuance cannot be a real scan. A live scan
    // stays a hard reject; an offline replay is evidence that must reach the
    // teacher, so it is downgraded to success + disputed below (DD-3c).
    const clockBehind = scannedAt.getTime() < payload.issuedAt - 30_000
    if (clockBehind && !offline)
      return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['implausible_client_timestamp'])
    if (scannedAt.getTime() > receivedAt.getTime() + 5 * 60_000)
      return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['implausible_client_timestamp'])

    if (!online) {
      // ── Zero-GPS exception: geometry checks run for in-person sessions only ──
      if (evidence.latitude === undefined || evidence.longitude === undefined) {
        return failed('disputed', 'missing_location', 'Location evidence is required for in-person attendance')
      }
      const latitude = evidence.latitude
      const longitude = evidence.longitude
      distanceMeters = this.geofence.calculateDistance(
        latitude,
        longitude,
        session.geofenceLatitude!,
        session.geofenceLongitude!,
      )
      const radiusMeters = session.geofenceRadiusMeters!
      geofenceRadiusMeters = radiusMeters
      const withLocation = (validation: ScanValidation): ScanValidation => ({
        ...validation,
        distanceMeters,
        geofenceRadiusMeters: radiusMeters,
      })
      if (evidence.locationCapturedAt) {
        const locationCapturedAt = new Date(evidence.locationCapturedAt)
        const clientTimestamp = evidence.scannedAt ? new Date(evidence.scannedAt) : null
        const locationReference =
          clientTimestamp && !Number.isNaN(clientTimestamp.getTime()) ? clientTimestamp : scannedAt
        const age = locationReference.getTime() - locationCapturedAt.getTime()
        if (Number.isNaN(locationCapturedAt.getTime()) || age < -30_000 || age > MAX_LOCATION_AGE_MS)
          return withLocation(
            failed('disputed', 'stale_location', 'Location fix is stale or has an invalid timestamp', [
              'stale_location',
            ]),
          )
      }
      if (evidence.accuracyMeters === undefined) {
        riskSignals.push('missing_accuracy')
      }
      if (!evidence.locationCapturedAt) {
        riskSignals.push('missing_location_timestamp')
      }
      if (distanceMeters > radiusMeters)
        return withLocation(
          failed('absent', 'outside_geofence', 'You are outside the session geofence', ['outside_geofence']),
        )
      const isWeb = Boolean(evidence.deviceId?.startsWith('web-') || evidence.inputChannel === 'image')
      const maxAccuracy = isWeb ? MAX_WEB_LOCATION_ACCURACY_METERS : MAX_LOCATION_ACCURACY_METERS
      if (evidence.accuracyMeters !== undefined && evidence.accuracyMeters > maxAccuracy)
        return withLocation(
          failed('disputed', 'poor_location_accuracy', 'Location accuracy is too poor to verify attendance', [
            'poor_accuracy',
          ]),
        )
      if (
        !isWeb &&
        evidence.accuracyMeters !== undefined &&
        evidence.accuracyMeters <= radiusMeters &&
        distanceMeters + evidence.accuracyMeters > radiusMeters
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
      if (evidence.mocked === true)
        return withLocation(failed('disputed', 'mocked_location', 'Mocked locations are not accepted'))
    } else {
      // Online sessions are location-free by design (RA 10173 data minimization).
      riskSignals.push('mode_online_no_gps')
      if (evidence.latitude !== undefined || evidence.longitude !== undefined) {
        riskSignals.push('unexpected_location_online')
      }
      if (scannedAt.getTime() > graceEnd)
        return failed('absent', 'qr_expired', 'The QR attendance window has expired', ['client_scan_outside_window'])
    }

    const deviceSecurityDispute = getPrimaryDeviceSecurityDispute(evidence.deviceSecurity)
    if (deviceSecurityDispute) {
      return failed('disputed', deviceSecurityDispute.reason, deviceSecurityDispute.message)
    }
    if (clockBehind) {
      // Offline replay from a clock-behind device: the scan and its evidence
      // were verified, but the client timestamp cannot be trusted. Keep the
      // record as a dispute so the teacher sees it instead of a dead end.
      return {
        success: true,
        status: 'disputed',
        reason: 'implausible_client_timestamp',
        scannedAt,
        receivedAt,
        mode,
        checkpoint,
        message: 'Scan timestamp is implausibly early; the record is flagged for teacher review.',
        distanceMeters,
        geofenceRadiusMeters,
        riskSignals: [
          ...riskSignals,
          'implausible_client_timestamp',
          ...(session.endedAt ? ['received_after_session_end'] : []),
        ],
      }
    }
    if (offline && (receivedAt.getTime() > graceEnd || session.endedAt)) {
      return {
        success: true,
        status: 'disputed',
        reason: 'delayed_offline_sync',
        scannedAt,
        receivedAt,
        mode,
        checkpoint,
        message: 'Offline check-in arrived after the attendance window and requires teacher review.',
        distanceMeters,
        geofenceRadiusMeters,
        riskSignals: [
          ...riskSignals,
          'delayed_offline_sync',
          ...(session.endedAt ? ['received_after_session_end'] : []),
        ],
      }
    }
    const missingCoreEvidence: string[] = []
    if (!evidence.clientAttemptId) missingCoreEvidence.push('missing_client_attempt_id')
    if (!evidence.inputChannel) missingCoreEvidence.push('missing_input_channel')
    if (!online) {
      if (evidence.accuracyMeters === undefined) missingCoreEvidence.push('missing_accuracy')
      if (!evidence.locationCapturedAt) missingCoreEvidence.push('missing_location_timestamp')
    }
    if (missingCoreEvidence.length > 0) {
      return {
        success: true,
        status: 'disputed',
        reason: 'missing_scan_evidence',
        scannedAt,
        receivedAt,
        mode,
        checkpoint,
        message: 'Legacy scan evidence is incomplete and requires teacher review.',
        distanceMeters,
        geofenceRadiusMeters,
        riskSignals: [...riskSignals, ...missingCoreEvidence.filter((signal) => !riskSignals.includes(signal))],
      }
    }

    // ── Meeting PIN gate (online checkpoints only) ──
    let pinVerified: boolean | undefined
    if (online) {
      const pinRequired = payload.pinRequired === true
      if (pinRequired) {
        const storedHash = checkpoint === 'start' ? session.startPinHash : session.endPinHash
        if (!storedHash) {
          return failed('disputed', 'pin_mismatch', 'The meeting PIN state is unavailable for this checkpoint')
        }
        if (payload.pinHash !== storedHash) {
          return failed('disputed', 'pin_mismatch', 'QR token PIN state does not match the session')
        }
        if (!evidence.pin) {
          return failed('absent', 'pin_required', 'Enter the meeting PIN announced by your instructor')
        }
        const rateKey = `pin-attempt:${session.id}:${user.id}:${checkpoint}`
        const withinLimit = await this.redis.consumeRateLimit(rateKey, PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_SECONDS)
        if (!withinLimit) {
          return failed(
            'absent',
            'pin_locked',
            'Too many incorrect meeting PIN attempts. Ask your instructor to verify your attendance.',
            ['pin_locked'],
          )
        }
        const verified = await verifyMeetingPin(evidence.pin, storedHash)
        pinVerified = verified
        if (!verified) {
          return {
            ...failed('absent', 'pin_incorrect', 'The meeting PIN is incorrect'),
            pinVerified,
          }
        }
        riskSignals.push('pin_verified')
      } else if (evidence.pin) {
        riskSignals.push('pin_supplied_but_disabled')
      }
    }

    const status: ScanValidation['status'] = scannedAt.getTime() > validityEnd ? 'late' : 'present'
    return {
      success: true,
      status,
      scannedAt,
      receivedAt,
      mode,
      checkpoint,
      ...(pinVerified !== undefined ? { pinVerified } : {}),
      message:
        online && checkpoint === 'end'
          ? 'End-of-class check-out recorded.'
          : status === 'late'
            ? 'Check-in recorded as late.'
            : 'Check-in successful.',
      distanceMeters,
      geofenceRadiusMeters,
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
      deviceSecurity: dto.deviceSecurity,
      pin: dto.pin,
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
      deviceSecurity: dto.deviceSecurity,
      pin: dto.pin,
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
    // RA 10173: online sessions never persist location, even when a modified
    // client supplies coordinates for an online token.
    const online = validation.mode === 'online'
    return {
      sessionId: evidence.sessionId,
      studentId,
      clientAttemptId: evidence.clientAttemptId,
      timestamp: validation.scannedAt,
      clientScannedAt: evidence.scannedAt ? new Date(evidence.scannedAt) : undefined,
      receivedAt: validation.receivedAt,
      locationCapturedAt: !online && evidence.locationCapturedAt ? new Date(evidence.locationCapturedAt) : undefined,
      latitude: online ? undefined : evidence.latitude,
      longitude: online ? undefined : evidence.longitude,
      accuracyMeters: online ? undefined : evidence.accuracyMeters,
      mocked: online ? undefined : evidence.mocked,
      inputChannel: evidence.inputChannel,
      checkpoint: validation.checkpoint,
      pinVerified: validation.pinVerified,
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
