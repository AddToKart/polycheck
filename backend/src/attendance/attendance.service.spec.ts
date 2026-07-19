import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { AttendanceService } from './attendance.service'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import type { RequestUser } from '../auth/authenticated-principal'
import { createHash } from 'crypto'

jest.mock('@polycheck/shared', () => ({
  verifyQRToken: jest.fn(),
  haversineDistance: jest.fn(),
}))

import { verifyQRToken, haversineDistance } from '@polycheck/shared'

const mockedVerifyQRToken = verifyQRToken as jest.MockedFunction<typeof verifyQRToken>
const mockedHaversineDistance = haversineDistance as jest.MockedFunction<typeof haversineDistance>

const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }
const adminUser: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

const VALID_TOKEN = 't'.repeat(100)
const ISSUED_AT = Date.now() - 30_000 // 30 seconds ago
const LOCATION_CAPTURED_AT = new Date().toISOString()

function makeRosterRecord(overrides: any = {}) {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'stu-1',
    studentName: 'Jane Doe',
    studentProgram: 'BSIT',
    timestamp: new Date(ISSUED_AT),
    status: 'pending',
    latitude: 14.6,
    longitude: 121.0,
    deviceId: null,
    tokenSnapshot: null,
    isSynced: true,
    syncedAt: new Date(),
    disputeReason: null,
    disputeDescription: null,
    disputeResolved: false,
    manuallySet: false,
    ...overrides,
  }
}

function cachedSession(overrides: any = {}) {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    subjectName: 'CS 101',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    geofenceLatitude: 14.6,
    geofenceLongitude: 121.0,
    geofenceRadiusMeters: 50,
    isActive: true,
    endedAt: null,
    qrToken: VALID_TOKEN,
    qrTokenExpiresAt: null,
    qrGeneratedAt: new Date(ISSUED_AT).toISOString(),
    teacherPublicKey: 'pk',
    ...overrides,
  }
}

describe('AttendanceService', () => {
  let service: AttendanceService
  let prisma: any
  let realtime: { emitAttendanceUpdated: jest.Mock; emitSessionState: jest.Mock }
  let redis: {
    consumeRateLimit: jest.Mock
    getJson: jest.Mock
    setJson: jest.Mock
    delete: jest.Mock
    setIfAbsent: jest.Mock
  }

  beforeEach(async () => {
    prisma = {
      attendanceRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      section: { findUnique: jest.fn(), findMany: jest.fn() },
      enrollment: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      scanAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    }
    realtime = { emitAttendanceUpdated: jest.fn(), emitSessionState: jest.fn() }
    redis = {
      consumeRateLimit: jest.fn().mockResolvedValue(true),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      delete: jest.fn(),
      setIfAbsent: jest.fn().mockResolvedValue(true),
    }
    mockedVerifyQRToken.mockReset()
    mockedHaversineDistance.mockReset().mockReturnValue(0)
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma))

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AttendanceGateway, useValue: realtime },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()

    service = moduleRef.get(AttendanceService)
  })

  describe('findAll', () => {
    it('preserves the array response expected by web and Android clients', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])

      const result = await service.findAll(adminUser, { startDate: '2026-07-01', endDate: '2026-07-14' })

      expect(Array.isArray(result)).toBe(true)
      expect(result[0].coordinates).toEqual({ latitude: 14.6, longitude: 121 })
    })

    it('offers pagination through the dedicated page method', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      prisma.attendanceRecord.count.mockResolvedValue(4)

      const result = await service.findPage(
        adminUser,
        { startDate: '2026-07-01', endDate: '2026-07-14' },
        { limit: 1, offset: 2 },
      )

      expect(prisma.attendanceRecord.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({ take: 1, skip: 2 }))
      expect(result).toEqual(expect.objectContaining({ total: 4, limit: 1, offset: 2, hasMore: true }))
    })

    it('rejects unscoped staff history queries before touching attendance records', async () => {
      await expect(service.findAll(teacherUser)).rejects.toThrow('Staff attendance lists require')
      expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
    })

    it('keeps session rosters explicitly capped at 1000 records', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])

      await service.findAll(teacherUser, { sessionId: 'sess-1' })

      expect(prisma.attendanceRecord.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({ take: 1000 }))
    })
  })

  describe('report', () => {
    it('uses grouped counts and a bounded session date predicate without loading raw records', async () => {
      prisma.attendanceRecord.groupBy.mockResolvedValue([
        { sectionId: 'sec-1', status: 'present', _count: { _all: 8 } },
        { sectionId: 'sec-1', status: 'late', _count: { _all: 2 } },
      ])
      prisma.session.groupBy.mockResolvedValue([{ sectionId: 'sec-1', _count: { _all: 3 } }])
      prisma.section.findMany.mockResolvedValue([{ id: 'sec-1', subject: { name: 'Algorithms' } }])

      const result = await service.report(adminUser, { startDate: '2026-07-01', endDate: '2026-07-14' })

      expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.groupBy.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ AND: expect.any(Array) }),
      )
      expect(prisma.session.groupBy.mock.calls[0][0].where.AND).toContainEqual({
        date: { gte: '2026-07-01', lte: '2026-07-14' },
      })
      expect(prisma.session.groupBy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ take: 1001, orderBy: { sectionId: 'asc' } }),
      )
      expect(result.totals).toEqual(expect.objectContaining({ totalRecords: 10, totalSessions: 3 }))
      expect(result.summaries[0]).toEqual(expect.objectContaining({ subjectName: 'Algorithms', present: 8, late: 2 }))
    })

    it('rejects report ranges wider than 366 days', async () => {
      await expect(service.report(adminUser, { startDate: '2025-01-01', endDate: '2026-07-14' })).rejects.toThrow(
        'limited to 366 days',
      )
      expect(prisma.attendanceRecord.groupBy).not.toHaveBeenCalled()
    })
  })

  // Happy path token payload
  const validPayload = (overrides: any = {}) => ({
    version: 1,
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    issuedAt: ISSUED_AT,
    validityMinutes: 10,
    gracePeriodMinutes: 5,
    teacherName: 'T',
    ...overrides,
  })

  describe('validateScan (via check)', () => {
    const checkArgs = {
      sessionId: 'sess-1',
      lat: 14.6,
      lon: 121.0,
      qrToken: VALID_TOKEN,
      clientAttemptId: 'check-attempt-1',
      accuracyMeters: 5,
      locationCapturedAt: LOCATION_CAPTURED_AT,
      inputChannel: 'camera' as const,
    }

    it('returns session_not_found when session missing', async () => {
      redis.getJson.mockResolvedValue(null)
      prisma.session.findUnique.mockResolvedValue(null)
      // For recordScanAttempt: session findUnique should return null too then return early
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('session_not_found')
    })

    it('returns not_enrolled when student is not enrolled', async () => {
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue(null)
      // recordScanAttempt: session not fetched since we use cached path... but recordScanAttempt re-fetches by id.
      // Provide a session so enrollment lookup happens (returns null -> return).
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('not_enrolled')
    })

    it('returns invalid_signature when teacher signing key unavailable', async () => {
      redis.getJson.mockResolvedValue({ ...cachedSession(), teacherPublicKey: undefined })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: null })
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_signature')
      expect(result.status).toBe('disputed')
    })

    it('returns invalid_signature when verifyQRToken returns null', async () => {
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(null)
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_signature')
    })

    it('returns token_mismatch when payload sessionId does not match session', async () => {
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload({ sessionId: 'sess-other' }))
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('token_mismatch')
    })

    it('returns token_mismatch when token differs from session.qrToken', async () => {
      redis.getJson.mockResolvedValue(cachedSession({ qrToken: 'other-stored-token' }))
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('token_mismatch')
    })

    it('returns outside_geofence when coordinates fall outside radius', async () => {
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(100)
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('outside_geofence')
      expect(result.status).toBe('absent')
    })

    it('returns present for valid scan within validity window', async () => {
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(true)
      expect(result.status).toBe('present')
      expect(result.message).toContain('successful')
    })

    it('returns late for valid scan after validity window expired', async () => {
      // validity is 10 minutes; issued 30s ago -> not late yet. Make issuedAt 11+ minutes ago.
      const issuedAtLate = Date.now() - 11 * 60_000
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt: issuedAtLate }))
      mockedHaversineDistance.mockReturnValue(0)
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(true)
      expect(result.status).toBe('late')
      expect(result.message).toContain('late')
    })

    it('rejects scans after both validity and grace windows expire', async () => {
      const issuedAtExpired = Date.now() - 16 * 60_000
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt: issuedAtExpired }))
      mockedHaversineDistance.mockReturnValue(0)

      const result = await service.check(studentUser, {
        ...checkArgs,
        scannedAt: new Date(issuedAtExpired + 60_000).toISOString(),
        locationCapturedAt: new Date(issuedAtExpired + 60_000).toISOString(),
      })

      expect(result.success).toBe(false)
      expect(result.reason).toBe('qr_expired')
    })
  })

  describe('check (rate limit)', () => {
    const checkArgs = {
      sessionId: 'sess-1',
      lat: 14.6,
      lon: 121.0,
      qrToken: VALID_TOKEN,
      clientAttemptId: 'check-rate-attempt-1',
      accuracyMeters: 5,
      locationCapturedAt: LOCATION_CAPTURED_AT,
      inputChannel: 'camera' as const,
    }

    it('returns rate_limited when consumeRateLimit returns false', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('rate_limited')
      expect(result.status).toBe('absent')
      expect(redis.consumeRateLimit).toHaveBeenCalledWith('scan:stu-1:sess-1', 30, 60)
    })
  })

  describe('submit', () => {
    const submitArgs = {
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      latitude: 14.6,
      longitude: 121.0,
      deviceId: 'device-A',
      qrToken: VALID_TOKEN,
      clientAttemptId: 'submit-attempt-1',
      accuracyMeters: 5,
      locationCapturedAt: LOCATION_CAPTURED_AT,
      inputChannel: 'camera' as const,
    }

    it('returns rate_limited when consumeRateLimit returns false', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)
      // recordScanAttempt calls session.findUnique to record attempt:
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      const result = await service.submit(studentUser, submitArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('rate_limited')
    })

    it('rejects duplicate submission (updateMany count 0)', async () => {
      // ensureOfflineActivation: session has qrToken so returns early.
      prisma.session.findUnique.mockResolvedValueOnce(cachedSession())
      // validateScan uses cache:
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      // existing roster entry already submitted (non-pending or has token)
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRosterRecord({ status: 'present', tokenSnapshot: VALID_TOKEN }),
      )
      // suspicious coordinates lookup returns nothing
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      // updateMany returns 0 -> duplicate
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 0 })
      // recordScanAttempt after duplicate path: still needs session lookup
      // prisma.session.findUnique already mocked via cachedSession() once above; re-mock
      prisma.session.findUnique.mockResolvedValue(cachedSession())

      const result = await service.submit(studentUser, submitArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('duplicate')
      expect(realtime.emitAttendanceUpdated).not.toHaveBeenCalled()
    })

    it('successful submission updates record and emits attendance updated', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'present', tokenSnapshot: VALID_TOKEN, deviceId: 'device-A' }),
      )
      // For recordScanAttempt after success:
      // session.findUnique already mocked; enrollment already mocked.

      const result = (await service.submit(studentUser, submitArgs)) as any
      expect(result.success).toBe(true)
      expect(result.status).toBe('present')
      expect(result.record).toBeDefined()
      expect(result.record.coordinates).toEqual({ latitude: 14.6, longitude: 121.0 })
      const updateArgs = prisma.attendanceRecord.updateMany.mock.calls[0][0]?.data
      expect(updateArgs.status).toBe('present')
      expect(updateArgs.tokenSnapshot).toBe(VALID_TOKEN)
      expect(updateArgs.isSynced).toBe(true)
      expect(realtime.emitAttendanceUpdated).toHaveBeenCalled()
    })

    it('accepts legacy missing evidence only as disputed and audits the missing fields', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'missing_scan_evidence' }),
      )

      const result = await service.submit(studentUser, {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        latitude: 14.6,
        longitude: 121,
        deviceId: 'legacy-device',
        qrToken: VALID_TOKEN,
      })

      expect(result).toEqual(expect.objectContaining({ success: true, status: 'disputed' }))
      expect(prisma.scanAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'flagged',
          reason: 'missing_scan_evidence',
          riskSignals: expect.arrayContaining([
            'missing_client_attempt_id',
            'missing_accuracy',
            'missing_location_timestamp',
            'missing_input_channel',
          ]),
        }),
      })
    })

    it('persists accepted evidence and links it atomically to attendance', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(8)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))

      await service.submit(studentUser, {
        ...submitArgs,
        clientAttemptId: 'attempt-client-1',
        accuracyMeters: 4,
        locationCapturedAt: new Date().toISOString(),
        mocked: false,
        inputChannel: 'camera',
      })

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.scanAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientAttemptId: 'attempt-client-1',
          accuracyMeters: 4,
          mocked: false,
          inputChannel: 'camera',
          distanceMeters: 8,
          geofenceRadiusMeters: 50,
          receivedAt: expect.any(Date),
        }),
      })
      expect(prisma.attendanceRecord.updateMany.mock.calls[0][0].data.acceptedScanAttemptId).toBe('attempt-1')
    })

    it('denies mocked location while preserving evidence without mutating attendance', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())

      const result = await service.submit(studentUser, {
        ...submitArgs,
        clientAttemptId: 'attempt-mocked',
        accuracyMeters: 5,
        locationCapturedAt: new Date().toISOString(),
        mocked: true,
        inputChannel: 'camera',
      })

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'mocked_location' }))
      expect(prisma.scanAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mocked: true,
          outcome: 'denied',
          riskSignals: expect.arrayContaining(['mocked_location']),
        }),
      })
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
      expect(realtime.emitAttendanceUpdated).not.toHaveBeenCalled()
    })

    it('denies geofence uncertainty when accuracy extends beyond the radius', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(45)

      const result = await service.submit(studentUser, {
        ...submitArgs,
        accuracyMeters: 10,
        locationCapturedAt: new Date().toISOString(),
        mocked: false,
      })

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'geofence_uncertain' }))
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
    })

    it.each([
      ['stale_location', { accuracyMeters: 5, locationCapturedAt: new Date(Date.now() - 3 * 60_000).toISOString() }],
      ['poor_location_accuracy', { accuracyMeters: 51, locationCapturedAt: new Date().toISOString() }],
    ])('denies %s evidence without changing attendance', async (reason, evidence) => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())

      const result = await service.submit(studentUser, { ...submitArgs, ...evidence, mocked: false })

      expect(result).toEqual(expect.objectContaining({ success: false, reason }))
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
    })

    it('measures location freshness in the client clock domain', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))
      const clientTimestamp = new Date(Date.now() + 10 * 60_000).toISOString()

      const result = await service.submit(studentUser, {
        ...submitArgs,
        scannedAt: clientTimestamp,
        locationCapturedAt: clientTimestamp,
        mocked: false,
      })

      expect(result).toEqual(expect.objectContaining({ success: true, status: 'present' }))
    })

    it('acknowledges an exact accepted clientAttemptId replay before rate limiting', async () => {
      const accepted = makeRosterRecord({ status: 'present', acceptedScanAttemptId: 'attempt-1' })
      prisma.scanAttempt.findUnique.mockResolvedValue({
        sessionId: 'sess-1',
        tokenHash: createHash('sha256').update(VALID_TOKEN).digest('hex'),
        latitude: 14.6,
        longitude: 121,
        deviceId: 'device-A',
        inputChannel: 'camera',
        accuracyMeters: 5,
        mocked: null,
        clientScannedAt: null,
        locationCapturedAt: new Date(LOCATION_CAPTURED_AT),
        acceptedAttendanceRecord: accepted,
      })

      const result = await service.submit(studentUser, { ...submitArgs, clientAttemptId: 'attempt-client-1' })

      expect(result).toEqual(expect.objectContaining({ success: true, status: 'present' }))
      expect(redis.consumeRateLimit).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects an expired signed token before offline activation can claim the session', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ isActive: false, qrToken: null }))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt: Date.now() - 20 * 60_000 }))

      const result = await service.submit(studentUser, submitArgs)

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'qr_expired' }))
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
    })

    it('disputes submission with suspicious coordinates', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      // previous records exist with identical coords:
      prisma.attendanceRecord.findMany.mockResolvedValue([
        {
          latitude: 14.6,
          longitude: 121.0,
          session: { geofenceLatitude: 14.6, geofenceLongitude: 121.0 },
        },
        {
          latitude: 14.6,
          longitude: 121.0,
          session: { geofenceLatitude: 14.6, geofenceLongitude: 121.0 },
        },
      ])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({
          status: 'disputed',
          disputeReason: 'suspicious_coordinates',
          tokenSnapshot: VALID_TOKEN,
        }),
      )

      const result = (await service.submit(studentUser, submitArgs)) as any
      expect(result.success).toBe(true)
      const updateArgs = prisma.attendanceRecord.updateMany.mock.calls[0][0]?.data
      expect(updateArgs.status).toBe('disputed')
      expect(updateArgs.disputeReason).toBe('suspicious_coordinates')
      // scan attempt outcome should be flagged
      expect(prisma.scanAttempt.create).toHaveBeenCalled()
      const attemptArgs = prisma.scanAttempt.create.mock.calls.at(-1)[0]?.data
      expect(attemptArgs.outcome).toBe('flagged')
      expect(attemptArgs.reason).toBe('suspicious_coordinates')
    })

    it('throws NotFoundException when roster entry missing', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      // validateScan may also lookup enrollment via prisma.enrollment.findUnique (already mocked)
      prisma.attendanceRecord.findUnique.mockResolvedValue(null)

      await expect(service.submit(studentUser, submitArgs)).rejects.toThrow(NotFoundException)
    })

    it('marks a valid but delayed offline sync as disputed', async () => {
      const issuedAt = Date.now() - 20 * 60_000
      const scannedAt = new Date(issuedAt + 2 * 60_000).toISOString()
      prisma.session.findUnique.mockResolvedValue(cachedSession({ isActive: false, endedAt: new Date() }))
      redis.getJson.mockResolvedValue(cachedSession({ isActive: false, endedAt: new Date() }))
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt }))
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord({ status: 'absent' }))
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )

      const result = await service.syncScan(studentUser, {
        ...submitArgs,
        lat: 14.6,
        lon: 121,
        scannedAt,
        locationCapturedAt: scannedAt,
      })

      expect('error' in result).toBe(false)
      expect(prisma.attendanceRecord.updateMany.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )
      expect(prisma.attendanceRecord.updateMany.mock.calls[0][0].where.status).toEqual({
        in: ['pending', 'absent'],
      })
    })

    it('materializes an expired offline activation and preserves its signed scan as disputed', async () => {
      const issuedAt = Date.now() - 20 * 60_000
      const scannedAt = new Date(issuedAt + 2 * 60_000).toISOString()
      const unactivated = makeSession({ isActive: false, endedAt: null, qrToken: null })
      const ended = makeSession({ isActive: false, endedAt: new Date(), qrToken: null })
      prisma.session.findUnique.mockResolvedValueOnce(unactivated).mockResolvedValue(ended)
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      prisma.session.findUniqueOrThrow.mockResolvedValue(ended)
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'stu-1', student: { fullName: 'Jane Doe', program: 'BSIT' } },
      ])
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord({ status: 'absent' }))
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt }))
      mockedHaversineDistance.mockReturnValue(0)

      const result = await service.syncScan(studentUser, {
        ...submitArgs,
        lat: 14.6,
        lon: 121,
        scannedAt,
        locationCapturedAt: scannedAt,
      })

      expect('error' in result).toBe(false)
      expect(prisma.session.updateMany.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ isActive: false, qrToken: null, endedAt: expect.any(Date) }),
      )
      expect(prisma.attendanceRecord.createMany.mock.calls[0][0].data[0].status).toBe('absent')
      expect(prisma.attendanceRecord.updateMany.mock.calls.at(-1)[0].data).toEqual(
        expect.objectContaining({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )
      expect(realtime.emitSessionState).toHaveBeenCalledWith(ended, 'ended')
      expect(redis.setJson).not.toHaveBeenCalled()
    })

    it('preserves delayed offline scans issued by legacy clients within the previous timing caps', async () => {
      const issuedAt = Date.now() - 70 * 60_000
      const scannedAt = new Date(issuedAt + 2 * 60_000).toISOString()
      const unactivated = makeSession({ isActive: false, endedAt: null, qrToken: null })
      const ended = makeSession({
        isActive: false,
        endedAt: new Date(),
        qrToken: null,
        qrValidityMinutes: 60,
        gracePeriodMinutes: 5,
      })
      prisma.session.findUnique.mockResolvedValueOnce(unactivated).mockResolvedValue(ended)
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      prisma.session.findUniqueOrThrow.mockResolvedValue(ended)
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 'stu-1', student: { fullName: 'Jane Doe', program: 'BSIT' } },
      ])
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord({ status: 'absent' }))
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt, validityMinutes: 60, gracePeriodMinutes: 5 }))

      const result = await service.syncScan(studentUser, {
        ...submitArgs,
        lat: 14.6,
        lon: 121,
        scannedAt,
        locationCapturedAt: scannedAt,
      })

      expect('error' in result).toBe(false)
      expect(prisma.session.updateMany.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ qrValidityMinutes: 60, gracePeriodMinutes: 5 }),
      )
      expect(prisma.attendanceRecord.updateMany.mock.calls.at(-1)[0].data.status).toBe('disputed')
    })
  })

  describe('updateStatus', () => {
    it('updates record for teacher who owns the session', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...makeRosterRecord({ status: 'pending' }),
        session: { teacherId: 'teacher-1' },
      })
      prisma.attendanceRecord.update.mockResolvedValue(makeRosterRecord({ status: 'present', manuallySet: true }))
      const result = await service.updateStatus(teacherUser, 'rec-1', 'present')
      const args = prisma.attendanceRecord.update.mock.calls[0][0]
      expect(args.where.id).toBe('rec-1')
      expect(args.data.status).toBe('present')
      expect(args.data.manuallySet).toBe(true)
      expect(result.status).toBe('present')
      expect(realtime.emitAttendanceUpdated).toHaveBeenCalled()
    })

    it('throws ForbiddenException when teacher does not own the session', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...makeRosterRecord(),
        session: { teacherId: 'teacher-other' },
      })
      await expect(service.updateStatus(teacherUser, 'rec-1', 'present')).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when record missing', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null)
      await expect(service.updateStatus(teacherUser, 'missing', 'present')).rejects.toThrow(NotFoundException)
    })

    it('forbids super_admin from changing day-to-day attendance', async () => {
      await expect(service.updateStatus(adminUser, 'rec-1', 'late')).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.findUnique).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('forbids students even when the service is called outside the controller', async () => {
      await expect(service.updateStatus(studentUser, 'rec-1', 'late')).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('createManual', () => {
    const dto = {
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      studentId: 'stu-2',
      status: 'present' as const,
    }

    it('forbids super_admin from creating manual attendance', async () => {
      await expect(service.createManual(adminUser, dto)).rejects.toThrow(ForbiddenException)
      expect(prisma.session.findUnique).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled()
    })

    it('forbids students even when the service is called outside the controller', async () => {
      await expect(service.createManual(studentUser, dto)).rejects.toThrow(ForbiddenException)
      expect(prisma.session.findUnique).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when session missing', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(service.createManual(teacherUser, dto)).rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when session sectionId differs from dto', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ sectionId: 'sec-other' }))
      await expect(service.createManual(teacherUser, dto)).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException when teacher does not own the session', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ sectionId: 'sec-1', teacherId: 'teacher-other' }))
      await expect(service.createManual(teacherUser, dto)).rejects.toThrow(ForbiddenException)
    })

    it('throws NotFoundException when student not enrolled in section', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ sectionId: 'sec-1', teacherId: 'teacher-1' }))
      prisma.enrollment.findUnique.mockResolvedValue(null)
      await expect(service.createManual(teacherUser, dto)).rejects.toThrow(NotFoundException)
    })

    it('upserts an attendance record and emits update', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ sectionId: 'sec-1', teacherId: 'teacher-1' }))
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Bob Doe', program: 'BSIT' },
      })
      const upserted = makeRosterRecord({ studentId: 'stu-2', status: 'present', manuallySet: true })
      prisma.attendanceRecord.upsert.mockResolvedValue(upserted)
      const result = await service.createManual(teacherUser, dto)
      const args = prisma.attendanceRecord.upsert.mock.calls[0][0]
      expect(args.where.sessionId_studentId).toEqual({ sessionId: 'sess-1', studentId: 'stu-2' })
      expect(args.create.studentName).toBe('Bob Doe')
      expect(args.create.deviceId).toBe('manual')
      expect(args.create.manuallySet).toBe(true)
      expect(args.update.manuallySet).toBe(true)
      expect(result.status).toBe('present')
      expect(realtime.emitAttendanceUpdated).toHaveBeenCalled()
    })
  })

  describe('forStudent', () => {
    it('forbids students from viewing other students attendance', async () => {
      await expect(service.forStudent(studentUser, 'stu-2', 'sec-1')).rejects.toThrow(ForbiddenException)
    })

    it('allows student to view own attendance', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      const result = await service.forStudent(studentUser, 'stu-1')
      expect(result.length).toBe(1)
      expect(prisma.attendanceRecord.findMany.mock.calls[0][0]?.where.studentId).toBe('stu-1')
    })

    it('forbids teacher not owning the section when sectionId provided', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other' })
      await expect(service.forStudent(teacherUser, 'stu-1', 'sec-1')).rejects.toThrow(ForbiddenException)
    })

    it('rejects unscoped staff student-attendance queries', async () => {
      await expect(service.forStudent(teacherUser, 'stu-1')).rejects.toThrow('require a sectionId')
      expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
    })

    it('allows teacher to view when they own the provided section', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      const result = await service.forStudent(teacherUser, 'stu-1', 'sec-1')
      expect(result.length).toBe(1)
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.sectionId).toBe('sec-1')
      expect(prisma.attendanceRecord.findMany.mock.calls[0][0]?.take).toBe(1000)
    })

    it('allows super_admin to view any student', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      const result = await service.forStudent(adminUser, 'stu-2', 'sec-1')
      expect(result.length).toBe(1)
    })
  })
})

function makeSession(overrides: any = {}) {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    subjectName: 'CS 101',
    date: '2026-07-14',
    startTime: '10:00',
    endTime: '11:00',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    geofenceLatitude: 14.6,
    geofenceLongitude: 121.0,
    geofenceRadiusMeters: 50,
    isActive: true,
    endedAt: null,
    qrToken: VALID_TOKEN,
    ...overrides,
  }
}
