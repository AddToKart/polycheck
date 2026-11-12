import { describe, expect, it } from 'vitest'
import { createSigningKeyPair, signQRToken } from '@polycheck/shared'
import { hashMeetingPin } from '@polycheck/shared/utils'
import {
  MAX_LOCATION_AGE_MS,
  validateScan,
  type ScanEvidenceInput,
  type SessionSnapshot,
} from '../src/core/scan'

const keys = createSigningKeyPair()
const otherKeys = createSigningKeyPair()

// 60 s after issue: inside a 15-minute in-person window AND inside the 120 s
// online checkpoint window, so each describe block tests the gate it intends.
const now = new Date('2026-11-13T00:01:00.000Z')
const issuedAt = new Date('2026-11-13T00:00:00.000Z').getTime()

function inPersonSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    mode: 'in_person',
    isActive: true,
    geofenceLatitude: 14.8697,
    geofenceLongitude: 120.9991,
    geofenceRadiusMeters: 100,
    qrToken: null,
    ...overrides,
  }
}

function signInPerson(overrides: Record<string, unknown> = {}): string {
  return signQRToken(
    {
      version: 1,
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      teacherName: 'Prof',
      issuedAt,
      validityMinutes: 15,
      gracePeriodMinutes: 10,
      mode: 'in_person',
      pinRequired: false,
      ...overrides,
    } as never,
    keys.secretKey,
  )
}

const completeEvidence = (overrides: Partial<ScanEvidenceInput> = {}): ScanEvidenceInput => ({
  qrToken: signInPerson(),
  clientAttemptId: 'attempt-1',
  inputChannel: 'camera',
  accuracyMeters: 12,
  locationCapturedAt: new Date(now.getTime() - 5_000).toISOString(),
  scannedAt: now.toISOString(),
  latitude: 14.86975,
  longitude: 120.99915,
  deviceId: 'mobile-abc',
  ...overrides,
})

const allowPin = async () => true

const run = (evidence: ScanEvidenceInput, snapshot = inPersonSnapshot(), offline = false) =>
  validateScan({
    snapshot,
    teacherPublicKey: keys.publicKey,
    userId: 'student-1',
    evidence,
    offline,
    receivedAt: now,
    consumePinAttempt: allowPin,
  })

describe('validateScan — in-person parity', () => {
  it('accepts an inside-geofence scan within the validity window as present', async () => {
    const result = await run(completeEvidence())
    expect(result.success).toBe(true)
    expect(result.status).toBe('present')
    expect(result.distanceMeters).toBeLessThan(100)
  })

  it('marks scans after validity but inside grace as late', async () => {
    const late = new Date(issuedAt + 16 * 60_000)
    const result = await validateScan({
      snapshot: inPersonSnapshot(),
      teacherPublicKey: keys.publicKey,
      userId: 'student-1',
      evidence: completeEvidence({ scannedAt: late.toISOString(), locationCapturedAt: new Date(late.getTime() - 1_000).toISOString() }),
      offline: false,
      receivedAt: late,
      consumePinAttempt: allowPin,
    })
    expect(result.status).toBe('late')
  })

  it('rejects beyond the grace window as an expired QR', async () => {
    const expired = new Date(issuedAt + 40 * 60_000)
    const result = await validateScan({
      snapshot: inPersonSnapshot(),
      teacherPublicKey: keys.publicKey,
      userId: 'student-1',
      evidence: completeEvidence({
        scannedAt: expired.toISOString(),
        locationCapturedAt: new Date(expired.getTime() - 1_000).toISOString(),
      }),
      offline: false,
      receivedAt: expired,
      consumePinAttempt: allowPin,
    })
    expect(result.success).toBe(false)
    expect(result.reason).toBe('qr_expired')
    expect(result.status).toBe('absent')
  })

  it('rejects scans outside the geofence', async () => {
    const result = await run(completeEvidence({ latitude: 14.88, longitude: 120.9991 }))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('outside_geofence')
  })

  it('rejects a token signed by a different key', async () => {
    const forged = signQRToken(
      {
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        teacherName: 'Prof',
        issuedAt,
        validityMinutes: 15,
        gracePeriodMinutes: 10,
        mode: 'in_person',
        pinRequired: false,
      } as never,
      otherKeys.secretKey,
    )
    const result = await run(completeEvidence({ qrToken: forged }))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('invalid_signature')
    expect(result.status).toBe('disputed')
  })

  it('rejects a token whose mode does not match the session', async () => {
    const result = await run(completeEvidence(), inPersonSnapshot({ mode: 'online' }))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('token_mismatch')
  })

  it('requires location evidence for in-person sessions', async () => {
    const result = await run(completeEvidence({ latitude: undefined, longitude: undefined }))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('missing_location')
  })

  it('flags incomplete legacy evidence as disputed instead of rejecting', async () => {
    const result = await run(completeEvidence({ clientAttemptId: undefined }))
    expect(result.success).toBe(true)
    expect(result.status).toBe('disputed')
    expect(result.reason).toBe('missing_scan_evidence')
    expect(result.riskSignals).toContain('missing_client_attempt_id')
  })

  it('rejects a stale location fix', async () => {
    const result = await run(
      completeEvidence({ locationCapturedAt: new Date(now.getTime() - MAX_LOCATION_AGE_MS - 5_000).toISOString() }),
    )
    expect(result.success).toBe(false)
    expect(result.reason).toBe('stale_location')
  })

  it('rejects an inactive session for live scans', async () => {
    const result = await run(completeEvidence(), inPersonSnapshot({ isActive: false }))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('session_inactive')
  })
})

describe('validateScan — offline replay', () => {
  it('keeps verified evidence as disputed when the class already ended', async () => {
    const result = await run(
      completeEvidence(),
      inPersonSnapshot({ endedAt: new Date(issuedAt + 30 * 60_000).toISOString() }),
      true,
    )
    expect(result.success).toBe(true)
    expect(result.status).toBe('disputed')
    expect(result.reason).toBe('delayed_offline_sync')
  })
})

describe('validateScan — online checkpoints and meeting PIN', () => {
  const pin = '4321'

  async function onlineFixture() {
    const pinHash = (await hashMeetingPin(pin, { iterations: 10_000 })).serialized
    const snapshot: SessionSnapshot = {
      id: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      mode: 'online',
      isActive: true,
      startPinHash: pinHash,
      endPinHash: pinHash,
    }
    const token = signQRToken(
      {
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        teacherName: 'Prof',
        issuedAt,
        validityMinutes: 15,
        gracePeriodMinutes: 0,
        mode: 'online',
        checkpoint: 'start',
        validitySeconds: 120,
        pinRequired: true,
        pinHash,
      } as never,
      keys.secretKey,
    )
    snapshot.startQrToken = token
    return { snapshot, token }
  }

  it('accepts an online checkpoint with the correct PIN and no GPS', async () => {
    const { snapshot, token } = await onlineFixture()
    const result = await run(
      {
        qrToken: token,
        clientAttemptId: 'attempt-online',
        inputChannel: 'camera',
        pin,
        scannedAt: now.toISOString(),
      },
      snapshot,
    )
    expect(result.success).toBe(true)
    expect(result.status).toBe('present')
    expect(result.pinVerified).toBe(true)
    expect(result.riskSignals).toContain('mode_online_no_gps')
  })

  it('requires the PIN when the checkpoint is PIN-protected', async () => {
    const { snapshot, token } = await onlineFixture()
    const result = await run(
      { qrToken: token, clientAttemptId: 'a', inputChannel: 'camera', scannedAt: now.toISOString() },
      snapshot,
    )
    expect(result.success).toBe(false)
    expect(result.reason).toBe('pin_required')
  })

  it('rejects an incorrect PIN without persisting anything', async () => {
    const { snapshot, token } = await onlineFixture()
    const result = await run(
      { qrToken: token, clientAttemptId: 'a', inputChannel: 'camera', pin: '0000', scannedAt: now.toISOString() },
      snapshot,
    )
    expect(result.success).toBe(false)
    expect(result.reason).toBe('pin_incorrect')
    expect(result.pinVerified).toBe(false)
  })

  it('locks out after too many attempts', async () => {
    const { snapshot, token } = await onlineFixture()
    const result = await validateScan({
      snapshot,
      teacherPublicKey: keys.publicKey,
      userId: 'student-1',
      evidence: { qrToken: token, clientAttemptId: 'a', inputChannel: 'camera', pin, scannedAt: now.toISOString() },
      offline: false,
      receivedAt: now,
      consumePinAttempt: async () => false,
    })
    expect(result.success).toBe(false)
    expect(result.reason).toBe('pin_locked')
  })

  it('rejects an online checkpoint that was never armed', async () => {
    const { snapshot } = await onlineFixture()
    const unarmed: SessionSnapshot = { ...snapshot, startQrToken: null }
    const { token } = await onlineFixture()
    const result = await run(
      { qrToken: token, clientAttemptId: 'a', inputChannel: 'camera', pin, scannedAt: now.toISOString() },
      unarmed,
    )
    expect(result.success).toBe(false)
    expect(result.reason).toBe('checkpoint_not_armed')
  })
})
