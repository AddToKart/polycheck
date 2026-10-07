import { Test } from '@nestjs/testing'
import { ScanValidatorService } from './scan-validator.service'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { GeofenceService } from './geofence.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { ISSUED_AT, makeCachedSession, makeEvidence, validPayload } from '../../test/test-fixtures'

jest.mock('@polycheck/shared', () => ({
  verifyQRToken: jest.fn(),
  haversineDistance: jest.fn(),
}))

import { verifyQRToken, haversineDistance } from '@polycheck/shared'

const mockedVerify = verifyQRToken as jest.MockedFunction<typeof verifyQRToken>
const mockedHaversine = haversineDistance as jest.MockedFunction<typeof haversineDistance>

const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }

describe('ScanValidatorService', () => {
  let service: ScanValidatorService
  let prisma: any
  let redis: any
  let geofence: any

  beforeEach(async () => {
    prisma = {
      session: { findUnique: jest.fn() },
      enrollment: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      scanAttempt: { findUnique: jest.fn() },
    }
    redis = { getJson: jest.fn() }
    geofence = { calculateDistance: jest.fn().mockReturnValue(5) }

    const module = await Test.createTestingModule({
      providers: [
        ScanValidatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: GeofenceService, useValue: geofence },
      ],
    }).compile()
    service = module.get(ScanValidatorService)
    jest.clearAllMocks()
    mockedHaversine.mockReturnValue(5)
  })

  describe('validateScan — core validation flow', () => {
    const cached = makeCachedSession()

    beforeEach(() => {
      redis.getJson.mockResolvedValue(cached)
      prisma.session.findUnique.mockResolvedValue(cached)
      prisma.enrollment.findUnique.mockResolvedValue({ studentId: 'stu-1', sectionId: 'sec-1' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk-test' })
      mockedVerify.mockReturnValue(validPayload() as any)
    })

    it('returns absent when session not found', async () => {
      redis.getJson.mockResolvedValue(null)
      prisma.session.findUnique.mockResolvedValue(null)
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('absent')
      expect(result.reason).toBe('session_not_found')
    })

    it('returns absent when student is not enrolled', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null)
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('absent')
      expect(result.reason).toBe('not_enrolled')
    })

    it('returns disputed when teacher signing key is unavailable', async () => {
      redis.getJson.mockResolvedValue({ ...cached, teacherPublicKey: undefined })
      prisma.user.findUnique.mockResolvedValue(null)
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('invalid_signature')
    })

    it('returns disputed when QR token signature is invalid', async () => {
      mockedVerify.mockReturnValue(null as any)
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('invalid_signature')
    })

    it('returns disputed when token does not match session', async () => {
      mockedVerify.mockReturnValue(validPayload({ sessionId: 'other-sess' }) as any)
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.reason).toBe('token_mismatch')
    })

    it('rejects a signed token whose timing exceeds policy', async () => {
      mockedVerify.mockReturnValue(validPayload({ validityMinutes: 60 }) as any)
      const result = await service.validateScan(studentUser, makeEvidence(), true, new Date())
      expect(result.success).toBe(false)
      expect(result.reason).toBe('token_mismatch')
    })

    it('returns absent when session is inactive (online)', async () => {
      prisma.session.findUnique.mockResolvedValue({ ...cached, isActive: false })
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('absent')
      expect(result.reason).toBe('session_inactive')
    })

    it('rejects stale active cache when PostgreSQL says the session ended', async () => {
      redis.getJson.mockResolvedValue({ ...cached, isActive: true, endedAt: null })
      prisma.session.findUnique.mockResolvedValue({ ...cached, isActive: false, endedAt: new Date() })

      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'session_inactive' }))
      expect(mockedVerify).toHaveBeenCalledWith(expect.any(String), 'pk-test')
    })

    it('rejects a stale cached key after PostgreSQL rotates the teacher key', async () => {
      redis.getJson.mockResolvedValue({ ...cached, teacherPublicKey: 'old-key' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'new-key' })
      mockedVerify.mockImplementation((_token, key) => (key === 'new-key' ? null : (validPayload() as any)))

      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'invalid_signature' }))
      expect(mockedVerify).toHaveBeenCalledWith(expect.any(String), 'new-key')
    })

    it('rejects a stale cached key after PostgreSQL revokes the teacher key', async () => {
      redis.getJson.mockResolvedValue({ ...cached, teacherPublicKey: 'revoked-key' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: null })

      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'invalid_signature' }))
      expect(mockedVerify).not.toHaveBeenCalled()
    })

    it('returns disputed for mocked location', async () => {
      const result = await service.validateScan(studentUser, makeEvidence({ mocked: true }), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('mocked_location')
    })

    it('returns absent when outside geofence', async () => {
      geofence.calculateDistance.mockReturnValue(100)
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('absent')
      expect(result.reason).toBe('outside_geofence')
    })

    it('returns absent when outside geofence even with broad accuracy circle', async () => {
      geofence.calculateDistance.mockReturnValue(100)
      const result = await service.validateScan(studentUser, makeEvidence({ accuracyMeters: 80 }), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('absent')
      expect(result.reason).toBe('outside_geofence')
    })

    it('returns disputed when location uncertainty extends outside geofence', async () => {
      geofence.calculateDistance.mockReturnValue(45) // 45 + 10 accuracy = 55 > 50 radius
      const result = await service.validateScan(studentUser, makeEvidence({ accuracyMeters: 10 }), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('geofence_uncertain')
    })

    it('returns disputed for stale location', async () => {
      const staleTime = new Date(ISSUED_AT - 5 * 60_000).toISOString() // 5 min before ISSUED_AT
      const result = await service.validateScan(
        studentUser,
        makeEvidence({ locationCapturedAt: staleTime }),
        false,
        new Date(),
      )
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('stale_location')
    })

    it('returns disputed for poor location accuracy', async () => {
      const result = await service.validateScan(studentUser, makeEvidence({ accuracyMeters: 100 }), false, new Date())
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('poor_location_accuracy')
    })

    it('returns success with present status for valid scan within validity window', async () => {
      const result = await service.validateScan(studentUser, makeEvidence(), false, new Date())
      expect(result.success).toBe(true)
      expect(result.status).toBe('present')
      expect(result.distanceMeters).toBe(5)
    })

    it('requires teacher review when an on-time offline scan arrives after expiry', async () => {
      const result = await service.validateScan(studentUser, makeEvidence(), true, new Date(ISSUED_AT + 90 * 60_000))
      expect(result).toMatchObject({ success: true, status: 'disputed', reason: 'delayed_offline_sync' })
    })

    it('rejects offline evidence when enrollment was removed before sync', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null)
      const result = await service.validateScan(studentUser, makeEvidence(), true, new Date(ISSUED_AT + 60_000))
      expect(result).toMatchObject({ success: false, reason: 'not_enrolled' })
    })

    it('returns late status when scanned after validity window but within grace', async () => {
      const lateTime = ISSUED_AT + 12 * 60_000 // 12 min after issued (validity=10)
      mockedVerify.mockReturnValue(validPayload({ validityMinutes: 10, gracePeriodMinutes: 5 }) as any)
      const result = await service.validateScan(
        studentUser,
        makeEvidence({
          scannedAt: new Date(lateTime).toISOString(),
          locationCapturedAt: new Date(lateTime - 2_000).toISOString(), // 2s before scan
        }),
        false,
        new Date(lateTime),
      )
      expect(result.success).toBe(true)
      expect(result.status).toBe('late')
    })

    it('flags emulator as disputed with emulator_detected reason', async () => {
      const result = await service.validateScan(
        studentUser,
        makeEvidence({ deviceSecurity: { emulatorDetected: true } }),
        false,
        new Date(ISSUED_AT + 60_000),
      )
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('emulator_detected')
      expect(result.riskSignals).toContain('emulator_detected')
    })

    it('flags rooted device as disputed with rooted_device reason', async () => {
      const result = await service.validateScan(
        studentUser,
        makeEvidence({ deviceSecurity: { rootDetected: true } }),
        false,
        new Date(ISSUED_AT + 60_000),
      )
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('rooted_device')
      expect(result.riskSignals).toContain('rooted_device')
      expect(result.riskSignals?.filter((signal) => signal === 'rooted_device')).toHaveLength(1)
    })

    it('enforces the geofence before retaining rooted-device evidence for review', async () => {
      geofence.calculateDistance.mockReturnValue(100)

      const result = await service.validateScan(
        studentUser,
        makeEvidence({ deviceSecurity: { rootDetected: true } }),
        false,
        new Date(ISSUED_AT + 60_000),
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe('absent')
      expect(result.reason).toBe('outside_geofence')
      expect(result.riskSignals).toContain('rooted_device')
    })

    it('flags hooking framework as disputed with hook_detected reason', async () => {
      const result = await service.validateScan(
        studentUser,
        makeEvidence({ deviceSecurity: { hookDetected: true } }),
        false,
        new Date(ISSUED_AT + 60_000),
      )
      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('hook_detected')
      expect(result.riskSignals).toContain('hook_detected')
    })
  })

  describe('findReplay', () => {
    it('returns null when no clientAttemptId', async () => {
      const result = await service.findReplay('stu-1', makeEvidence({ clientAttemptId: undefined }), 'hash')
      expect(result).toBeNull()
    })

    it('returns null when attempt not found', async () => {
      prisma.scanAttempt.findUnique.mockResolvedValue(null)
      const result = await service.findReplay('stu-1', makeEvidence(), 'hash')
      expect(result).toBeNull()
    })

    it('returns disputed when exact replay with different payload', async () => {
      prisma.scanAttempt.findUnique.mockResolvedValue({
        sessionId: 'other-sess',
        tokenHash: 'hash',
        latitude: 99,
        longitude: 99,
        deviceId: 'device-1',
        inputChannel: 'camera',
        accuracyMeters: 10,
        mocked: false,
        clientScannedAt: new Date(ISSUED_AT),
        locationCapturedAt: new Date(ISSUED_AT + 2_000),
        acceptedAttendanceRecord: null,
        reason: null,
        message: null,
      })
      const result = await service.findReplay('stu-1', makeEvidence(), 'hash')
      expect(result).not.toBeNull()
      expect(result!.success).toBe(false)
      expect(result!.status).toBe('disputed')
    })

    it('returns success when exact replay with accepted record', async () => {
      const record = { id: 'rec-1', status: 'present' }
      prisma.scanAttempt.findUnique.mockResolvedValue({
        sessionId: 'sess-1',
        tokenHash: 'hash',
        latitude: 14.5863,
        longitude: 121.0,
        deviceId: 'device-1',
        inputChannel: 'camera',
        accuracyMeters: 10,
        mocked: false,
        clientScannedAt: new Date(ISSUED_AT),
        locationCapturedAt: new Date(ISSUED_AT + 2_000),
        acceptedAttendanceRecord: record,
        reason: null,
        message: null,
      })
      const result = await service.findReplay('stu-1', makeEvidence(), 'hash')
      expect(result).not.toBeNull()
      expect(result!.success).toBe(true)
      expect(result!.record).toBe(record)
    })

    it('treats changed device-security evidence as a conflicting replay', async () => {
      prisma.scanAttempt.findUnique.mockResolvedValue({
        sessionId: 'sess-1',
        tokenHash: 'hash',
        latitude: 14.5863,
        longitude: 121.0,
        deviceId: 'device-1',
        inputChannel: 'camera',
        accuracyMeters: 10,
        mocked: false,
        clientScannedAt: new Date(ISSUED_AT),
        locationCapturedAt: new Date(ISSUED_AT + 2_000),
        riskSignals: [],
        acceptedAttendanceRecord: { id: 'rec-1', status: 'present' },
        reason: null,
        message: null,
      })

      const result = await service.findReplay('stu-1', makeEvidence({ deviceSecurity: { rootDetected: true } }), 'hash')

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'client_attempt_conflict' }))
    })
  })
})
