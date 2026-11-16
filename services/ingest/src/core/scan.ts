/**
 * Scan validation — a pure port of `backend/src/attendance/scan-validator.service.ts`.
 *
 * Why a port instead of an import: the NestJS validator is a provider that reads
 * Prisma and Redis directly. The gateway must decide without touching Postgres,
 * so the *decision tree* is reproduced here against a session snapshot, and the
 * drainer re-verifies the teacher signature against the database key before it
 * commits (see queue.ts). Every gate below sits in the same order as the NestJS
 * original so a divergence is a bug in one place, not a difference in policy.
 *
 * Parity is enforced by `test/scan.test.ts`, which mirrors the NestJS cases.
 */
import { verifyMeetingPin, type QRTokenPayload } from '@polycheck/shared'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'
import { haversineDistance } from '@polycheck/shared/utils'

export const MAX_QR_VALIDITY_MINUTES = 15
export const MAX_QR_GRACE_MINUTES = 60
export const MAX_LOCATION_AGE_MS = 2 * 60_000
export const MAX_LOCATION_ACCURACY_METERS = 50
export const MAX_WEB_LOCATION_ACCURACY_METERS = 500
export const MIN_ONLINE_CHECKPOINT_VALIDITY_SECONDS = 60
export const MAX_ONLINE_CHECKPOINT_VALIDITY_SECONDS = 300
export const PIN_ATTEMPT_LIMIT = 6
export const PIN_ATTEMPT_WINDOW_SECONDS = 10 * 60

export type SessionMode = 'in_person' | 'online'
export type Checkpoint = 'start' | 'end'
export type ScanStatus = 'present' | 'late' | 'absent' | 'disputed' | 'incomplete'

export interface DeviceSecurityEvidence {
  rootDetected?: boolean
  hookDetected?: boolean
  emulatorDetected?: boolean
}

/**
 * The subset of a `Session` row the decision tree needs. Written by NestJS
 * activation/end paths into `active-session:<id>`; the gateway is a pure reader.
 */
export interface SessionSnapshot {
  id: string
  sectionId: string
  teacherId: string
  mode?: SessionMode
  isActive: boolean
  endedAt?: string | null
  qrToken?: string | null
  startQrToken?: string | null
  endQrToken?: string | null
  startPinHash?: string | null
  endPinHash?: string | null
  geofenceLatitude?: number | null
  geofenceLongitude?: number | null
  geofenceRadiusMeters?: number | null
  /**
   * Published by the control plane inside the same cache blob as the session
   * (`sessions.service.ts` activation path). After a rotation the next
   * activation republishes it; the writer re-verifies against the database
   * anyway, so a stale value cannot authorise anything on its own.
   */
  teacherPublicKey?: string | null
}

export interface ScanEvidenceInput {
  clientAttemptId?: string
  accuracyMeters?: number
  locationCapturedAt?: string
  mocked?: boolean
  inputChannel?: 'camera' | 'image' | 'manual'
  pin?: string
  deviceSecurity?: DeviceSecurityEvidence
  scannedAt?: string
  latitude?: number
  longitude?: number
  deviceId?: string
  qrToken: string
}

export interface ScanValidation {
  success: boolean
  status: ScanStatus
  reason?: string
  message?: string
  scannedAt: Date
  receivedAt: Date
  mode?: SessionMode
  checkpoint?: Checkpoint
  distanceMeters?: number
  geofenceRadiusMeters?: number
  riskSignals: string[]
  pinVerified?: boolean
  tokenHash?: string
}

const DEVICE_SECURITY_RULES = [
  {
    flag: 'emulatorDetected',
    reason: 'emulator_detected',
    message: 'Emulators are not permitted for attendance check-in.',
  },
  {
    flag: 'rootDetected',
    reason: 'rooted_device',
    message: 'Device integrity is compromised (Root/Jailbreak detected).',
  },
  {
    flag: 'hookDetected',
    reason: 'hook_detected',
    message: 'Dynamic hooking framework detected on device.',
  },
] as const satisfies ReadonlyArray<{
  flag: keyof DeviceSecurityEvidence
  reason: string
  message: string
}>

export function getDeviceSecuritySignals(evidence?: DeviceSecurityEvidence): string[] {
  return DEVICE_SECURITY_RULES.filter(({ flag }) => evidence?.[flag] === true).map(({ reason }) => reason)
}

export function getPrimaryDeviceSecurityDispute(evidence?: DeviceSecurityEvidence) {
  return DEVICE_SECURITY_RULES.find(({ flag }) => evidence?.[flag] === true)
}

export interface ValidateScanParams {
  snapshot: SessionSnapshot
  teacherPublicKey: string
  userId: string
  evidence: ScanEvidenceInput
  offline: boolean
  receivedAt: Date
  /** Injected so the pure validator never reaches Redis itself. */
  consumePinAttempt: (key: string, limit: number, windowSeconds: number) => Promise<boolean>
}

export async function validateScan({
  snapshot: session,
  teacherPublicKey,
  userId,
  evidence,
  offline,
  receivedAt,
  consumePinAttempt,
}: ValidateScanParams): Promise<ScanValidation> {
  const riskSignals: string[] = []
  let mode: SessionMode | undefined
  let checkpoint: Checkpoint | undefined

  if (evidence.mocked === undefined) riskSignals.push('mock_status_unavailable')
  if (evidence.mocked) riskSignals.push('mocked_location')
  riskSignals.push(...getDeviceSecuritySignals(evidence.deviceSecurity))
  if (evidence.inputChannel && evidence.inputChannel !== 'camera') {
    riskSignals.push(`fallback_${evidence.inputChannel}`)
  }

  // Offline replays trust the recorded `scannedAt`; live scans use the device
  // value when present and otherwise the server receive time.
  const scannedAt = evidence.scannedAt ? new Date(evidence.scannedAt) : new Date(receivedAt.getTime())
  let distanceMeters: number | undefined
  let geofenceRadiusMeters: number | undefined

  const failed = (
    status: ScanStatus,
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

  if (Number.isNaN(scannedAt.getTime())) {
    return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['invalid_client_timestamp'])
  }

  mode = session.mode ?? 'in_person'

  const payload: QRTokenPayload | null = verifyQRTokenNative(evidence.qrToken, teacherPublicKey)
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
    // `end()` and the auto-end cron null the armed token columns; a replay whose
    // class already closed falls through to delayed_offline_sync below.
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
  } else if (
    (session.qrToken && evidence.qrToken !== session.qrToken) ||
    payload.sessionId !== session.id ||
    payload.sectionId !== session.sectionId ||
    payload.teacherId !== session.teacherId
  ) {
    return failed('disputed', 'token_mismatch', 'QR token does not match this session')
  }

  if (!session.isActive && !offline) return failed('absent', 'session_inactive', 'Session is not active')
  if (!session.isActive && offline && !session.endedAt) {
    return failed('absent', 'session_inactive', 'Session was never activated')
  }

  const clockBehind = scannedAt.getTime() < payload.issuedAt - 30_000
  if (clockBehind && !offline) {
    return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['implausible_client_timestamp'])
  }
  if (scannedAt.getTime() > receivedAt.getTime() + 5 * 60_000) {
    return failed('disputed', 'invalid_timestamp', 'Scan timestamp is invalid', ['implausible_client_timestamp'])
  }

  if (!online) {
    // ── Zero-GPS exception: geometry runs for in-person sessions only ──
    if (evidence.latitude === undefined || evidence.longitude === undefined) {
      return failed('disputed', 'missing_location', 'Location evidence is required for in-person attendance')
    }
    if (
      session.geofenceLatitude === null ||
      session.geofenceLatitude === undefined ||
      session.geofenceLongitude === null ||
      session.geofenceLongitude === undefined ||
      session.geofenceRadiusMeters === null ||
      session.geofenceRadiusMeters === undefined
    ) {
      return failed('disputed', 'missing_geofence', 'This session has no geofence configured')
    }
    distanceMeters = haversineDistance(
      evidence.latitude,
      evidence.longitude,
      session.geofenceLatitude,
      session.geofenceLongitude,
    )
    const radiusMeters = session.geofenceRadiusMeters
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
      if (Number.isNaN(locationCapturedAt.getTime()) || age < -30_000 || age > MAX_LOCATION_AGE_MS) {
        return withLocation(
          failed('disputed', 'stale_location', 'Location fix is stale or has an invalid timestamp', ['stale_location']),
        )
      }
    }
    if (evidence.accuracyMeters === undefined) riskSignals.push('missing_accuracy')
    if (!evidence.locationCapturedAt) riskSignals.push('missing_location_timestamp')
    if (distanceMeters > radiusMeters) {
      return withLocation(
        failed('absent', 'outside_geofence', 'You are outside the session geofence', ['outside_geofence']),
      )
    }
    const isWeb = Boolean(evidence.deviceId?.startsWith('web-') || evidence.inputChannel === 'image')
    const maxAccuracy = isWeb ? MAX_WEB_LOCATION_ACCURACY_METERS : MAX_LOCATION_ACCURACY_METERS
    if (evidence.accuracyMeters !== undefined && evidence.accuracyMeters > maxAccuracy) {
      return withLocation(
        failed('disputed', 'poor_location_accuracy', 'Location accuracy is too poor to verify attendance', [
          'poor_accuracy',
        ]),
      )
    }
    if (
      !isWeb &&
      evidence.accuracyMeters !== undefined &&
      evidence.accuracyMeters <= radiusMeters &&
      distanceMeters + evidence.accuracyMeters > radiusMeters
    ) {
      return withLocation(
        failed('disputed', 'geofence_uncertain', 'Location uncertainty extends outside the session geofence', [
          'geofence_uncertain',
        ]),
      )
    }
    if (scannedAt.getTime() > graceEnd) {
      return withLocation(
        failed('absent', 'qr_expired', 'The QR attendance window has expired', ['client_scan_outside_window']),
      )
    }
    if (evidence.mocked === true) {
      return withLocation(failed('disputed', 'mocked_location', 'Mocked locations are not accepted'))
    }
  } else {
    // Online sessions are location-free by design (RA 10173 data minimization).
    riskSignals.push('mode_online_no_gps')
    if (evidence.latitude !== undefined || evidence.longitude !== undefined) {
      riskSignals.push('unexpected_location_online')
    }
    if (scannedAt.getTime() > graceEnd) {
      return failed('absent', 'qr_expired', 'The QR attendance window has expired', ['client_scan_outside_window'])
    }
  }

  const deviceSecurityDispute = getPrimaryDeviceSecurityDispute(evidence.deviceSecurity)
  if (deviceSecurityDispute) {
    return failed('disputed', deviceSecurityDispute.reason, deviceSecurityDispute.message)
  }

  if (clockBehind) {
    // Offline replay from a clock-behind device: verified evidence, untrusted
    // client timestamp — keep the record as a dispute for the teacher.
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
      const rateKey = `pin-attempt:${session.id}:${userId}:${checkpoint}`
      const withinLimit = await consumePinAttempt(rateKey, PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_SECONDS)
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
        return { ...failed('absent', 'pin_incorrect', 'The meeting PIN is incorrect'), pinVerified }
      }
      riskSignals.push('pin_verified')
    } else if (evidence.pin) {
      riskSignals.push('pin_supplied_but_disabled')
    }
  }

  const status: ScanStatus = scannedAt.getTime() > validityEnd ? 'late' : 'present'
  return {
    success: true,
    status,
    scannedAt,
    receivedAt,
    mode,
    checkpoint,
    distanceMeters,
    geofenceRadiusMeters,
    riskSignals,
    pinVerified,
  }
}
