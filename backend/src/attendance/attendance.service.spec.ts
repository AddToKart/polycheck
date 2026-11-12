import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { AttendanceService } from './attendance.service'
import { AttendanceScopeService } from './attendance-scope.service'
import { AttendanceReportService } from './attendance-report.service'
import { GeofenceService } from './geofence.service'
import { ScanValidatorService } from './scan-validator.service'
import { LedgerService } from './ledger.service'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import type { RequestUser } from '../auth/authenticated-principal'
import { createHash } from 'crypto'
import {
  ISSUED_AT,
  LOCATION_CAPTURED_AT,
  VALID_TOKEN,
  makeCachedSession,
  makeRosterRecord,
  makeSession,
  validPayload,
} from '../../test/test-fixtures'

jest.mock('@polycheck/shared', () => ({
  verifyQRToken: jest.fn(),
  verifyMeetingPin: jest.fn(),
  haversineDistance: jest.fn(),
}))

import { verifyQRToken, verifyMeetingPin, haversineDistance } from '@polycheck/shared'

const mockedVerifyQRToken = verifyQRToken as jest.MockedFunction<typeof verifyQRToken>
const mockedVerifyMeetingPin = verifyMeetingPin as jest.MockedFunction<typeof verifyMeetingPin>
const mockedHaversineDistance = haversineDistance as jest.MockedFunction<typeof haversineDistance>

const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }
const adminUser: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

describe('AttendanceService', () => {
  let service: AttendanceService
  let moduleRef: TestingModule
  let prisma: any
  let realtime: {
    emitAttendanceUpdated: jest.Mock
    emitSessionState: jest.Mock
    emitAttendanceAnomaly: jest.Mock
  }
  let redis: {
    consumeRateLimit: jest.Mock
    getJson: jest.Mock
    setJson: jest.Mock
    delete: jest.Mock
    setIfAbsent: jest.Mock
    acquireLock: jest.Mock
    releaseLock: jest.Mock
  }

  beforeEach(async () => {
    prisma = {
      attendanceRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
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
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
    }
    realtime = { emitAttendanceUpdated: jest.fn(), emitSessionState: jest.fn(), emitAttendanceAnomaly: jest.fn() }
    redis = {
      consumeRateLimit: jest.fn().mockResolvedValue(true),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      delete: jest.fn(),
      setIfAbsent: jest.fn().mockResolvedValue(true),
      acquireLock: jest.fn().mockResolvedValue('lock-token'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    } as any
    mockedVerifyQRToken.mockReset()
    mockedVerifyMeetingPin.mockReset()
    mockedHaversineDistance.mockReset().mockReturnValue(0)
    prisma.session.findUnique.mockResolvedValue(makeCachedSession())
    prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma))

    const builtModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        AttendanceScopeService,
        AttendanceReportService,
        GeofenceService,
        ScanValidatorService,
        LedgerService,
        { provide: PrismaService, useValue: prisma },
        { provide: AttendanceGateway, useValue: realtime },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()

    moduleRef = builtModule
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
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue(null)
      // recordScanAttempt: session not fetched since we use cached path... but recordScanAttempt re-fetches by id.
      // Provide a session so enrollment lookup happens (returns null -> return).
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('not_enrolled')
    })

    it('returns invalid_signature when teacher signing key unavailable', async () => {
      redis.getJson.mockResolvedValue({ ...makeCachedSession(), teacherPublicKey: undefined })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: null })
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_signature')
      expect(result.status).toBe('disputed')
    })

    it('returns invalid_signature when verifyQRToken returns null', async () => {
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(null)
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_signature')
    })

    it('returns token_mismatch when payload sessionId does not match session', async () => {
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload({ sessionId: 'sess-other' }))
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('token_mismatch')
    })

    it('returns token_mismatch when token differs from session.qrToken', async () => {
      redis.getJson.mockResolvedValue(makeCachedSession({ qrToken: 'other-stored-token' }))
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      prisma.session.findUnique.mockResolvedValue({ id: 'sess-1', sectionId: 'sec-1' })
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('token_mismatch')
    })

    it('returns outside_geofence when coordinates fall outside radius', async () => {
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      prisma.session.findUnique.mockResolvedValueOnce(makeCachedSession())
      // validateScan uses cache:
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      // prisma.session.findUnique already mocked via makeCachedSession() once above; re-mock
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())

      const result = await service.submit(studentUser, submitArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('duplicate')
      expect(realtime.emitAttendanceUpdated).not.toHaveBeenCalled()
    })

    it('successful submission updates record and emits attendance updated', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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

    it('persists rooted-device evidence as a disputed attendance event for review', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'rooted_device' }),
      )

      const result = await service.submit(studentUser, {
        ...submitArgs,
        clientAttemptId: 'attempt-rooted',
        accuracyMeters: 5,
        locationCapturedAt: new Date().toISOString(),
        mocked: false,
        inputChannel: 'camera',
        deviceSecurity: { rootDetected: true },
      })

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'rooted_device' }))
      expect(prisma.scanAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'flagged',
          riskSignals: expect.arrayContaining(['rooted_device']),
        }),
      })
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: { in: ['pending', 'absent'] } }),
        data: expect.objectContaining({ status: 'disputed', disputeReason: 'rooted_device' }),
      })
      expect(realtime.emitAttendanceUpdated).toHaveBeenCalled()
    })

    it('denies geofence uncertainty when accuracy extends beyond the radius', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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

    // ── V2: concurrent-session conflict ("impossible teleportation") ──

    const conflictingRecord = (overrides: Record<string, unknown> = {}) => ({
      status: 'present',
      session: {
        subjectName: 'Physical Ed',
        date: '2026-07-14',
        startTime: '10:00',
        endTime: '11:00',
        isActive: false,
        ...overrides,
      },
    })

    it('flags a second scan as disputed when another session just accepted the student', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'concurrent_session_conflict' }),
      )
      // Second processScanSubmission session lookup (switching session window)
      prisma.session.findUnique.mockResolvedValue({
        date: '2026-07-14',
        startTime: '10:00',
        endTime: '11:00',
      })
      prisma.attendanceRecord.findFirst.mockResolvedValue(conflictingRecord())

      const result = (await service.submit(studentUser, { ...submitArgs, clientAttemptId: 'attempt-conflict' })) as any

      expect(result.success).toBe(false)
      expect(result.status).toBe('disputed')
      expect(result.reason).toBe('concurrent_session_conflict')
      expect(result.message).toContain('Physical Ed')
      expect(prisma.scanAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'flagged',
          reason: 'concurrent_session_conflict',
          riskSignals: expect.arrayContaining(['concurrent_session_conflict']),
        }),
      })
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: ['pending', 'absent'] } }),
          data: expect.objectContaining({
            status: 'disputed',
            disputeReason: 'concurrent_session_conflict',
            disputeDescription: expect.stringContaining('Physical Ed'),
          }),
        }),
      )
    })

    it('flags online mid-checkpoint rows through the accepted check-in leg', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'concurrent_session_conflict' }),
      )
      prisma.session.findUnique.mockResolvedValue({
        date: '2026-07-14',
        startTime: '10:00',
        endTime: '11:00',
      })
      prisma.attendanceRecord.findFirst.mockResolvedValue(conflictingRecord({ status: 'pending' }))

      const result = (await service.submit(studentUser, {
        ...submitArgs,
        clientAttemptId: 'attempt-online-conflict',
      })) as any

      expect(result.reason).toBe('concurrent_session_conflict')
    })

    it('does not flag back-to-back meetings whose windows only touch', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))
      prisma.session.findUnique.mockResolvedValue({
        date: '2026-07-14',
        startTime: '10:00',
        endTime: '11:00',
      })
      // Staggered window: other class 11:00–12:00 (half-open semantics: a
      // 10:00–11:00 session and an 11:00–12:00 session never overlap).
      prisma.attendanceRecord.findFirst.mockResolvedValue(conflictingRecord({ startTime: '11:00', endTime: '12:00' }))

      const result = (await service.submit(studentUser, {
        ...submitArgs,
        clientAttemptId: 'attempt-back-to-back',
      })) as any

      expect(result.success).toBe(true)
      expect(result.status).toBe('present')
    })

    it('treats an active-but-old accepted check-in as a conflict regardless of recency', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'concurrent_session_conflict' }),
      )
      prisma.session.findUnique.mockResolvedValue({
        date: '2026-07-14',
        startTime: '10:00',
        endTime: '11:00',
      })
      prisma.attendanceRecord.findFirst.mockResolvedValue(
        conflictingRecord({ startTime: '08:00', endTime: '12:00', isActive: true }),
      )

      const result = (await service.submit(studentUser, {
        ...submitArgs,
        clientAttemptId: 'attempt-active-conflict',
      })) as any

      expect(result.reason).toBe('concurrent_session_conflict')
    })

    it('keeps the own first diagnosis when the scan already failed geofence validation', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(999)
      prisma.attendanceRecord.findFirst.mockResolvedValue(conflictingRecord())

      const result = await service.submit(studentUser, { ...submitArgs, clientAttemptId: 'attempt-outside' })

      expect(result.reason).toBe('outside_geofence')
      // The conflict hook never ran for a scan that failed its own validation.
      expect(prisma.attendanceRecord.findFirst).not.toHaveBeenCalled()
    })

    it.each([
      ['stale_location', { accuracyMeters: 5, locationCapturedAt: new Date(Date.now() - 3 * 60_000).toISOString() }],
      ['poor_location_accuracy', { accuracyMeters: 51, locationCapturedAt: new Date().toISOString() }],
    ])('denies %s evidence without changing attendance', async (reason, evidence) => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())

      const result = await service.submit(studentUser, { ...submitArgs, ...evidence, mocked: false })

      expect(result).toEqual(expect.objectContaining({ success: false, reason }))
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
    })

    it('measures location freshness in the client clock domain', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
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

    it('creates a missing roster row transactionally for a currently enrolled late student', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Jane Doe', program: 'BSIT' },
      })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      // The ledger probes chain state with a `recordHash` select inside the
      // transaction; the submit pre-check probes by session+student.
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: null } : null,
      )
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.upsert.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))

      const result = await service.submit(studentUser, submitArgs)

      expect(result).toEqual(expect.objectContaining({ success: true, status: 'present' }))
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith({
        where: { sessionId_studentId: { sessionId: 'sess-1', studentId: 'stu-1' } },
        create: expect.objectContaining({
          sessionId: 'sess-1',
          sectionId: 'sec-1',
          studentId: 'stu-1',
          studentName: 'Jane Doe',
          status: 'pending',
        }),
        update: {},
      })
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'rec-1', status: 'pending' }) }),
      )
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2)
      expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.attendanceRecord.upsert.mock.invocationCallOrder[0],
      )
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('does not create a missing roster row if enrollment disappears before the transaction', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enr-1' }).mockResolvedValueOnce(null)
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(null)
      prisma.attendanceRecord.findMany.mockResolvedValue([])

      await expect(service.submit(studentUser, submitArgs)).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled()
    })

    it('rejects a scan when enrollment disappears after validation but before the roster write', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      // Validator check passes; the in-transaction recheck sees the removal.
      prisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enr-1' }).mockResolvedValueOnce(null)
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])

      await expect(service.submit(studentUser, submitArgs)).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
    })

    it('waits for a competing offline activation instead of rejecting the legitimate scan', async () => {
      const unactivated = makeSession({ isActive: false, endedAt: null, qrToken: null })
      const activated = makeCachedSession()
      redis.acquireLock.mockResolvedValue(null)
      redis.getJson.mockResolvedValue(activated)
      prisma.session.findUnique.mockResolvedValueOnce(unactivated).mockResolvedValue(activated)
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))

      const result = await service.submit(studentUser, submitArgs)

      expect(result).toEqual(expect.objectContaining({ success: true, status: 'present' }))
      // Concurrent-activation wait plus the DB-authoritative validation read.
      expect(prisma.session.findUnique).toHaveBeenCalledTimes(3)
      expect(redis.releaseLock).not.toHaveBeenCalled()
    })

    it('marks a valid but delayed offline sync as disputed', async () => {
      const issuedAt = Date.now() - 20 * 60_000
      const scannedAt = new Date(issuedAt + 2 * 60_000).toISOString()
      prisma.session.findUnique.mockResolvedValue(makeCachedSession({ isActive: false, endedAt: new Date() }))
      redis.getJson.mockResolvedValue(makeCachedSession({ isActive: false, endedAt: new Date() }))
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

      expect(result).toBeDefined()
      expect('error' in result!).toBe(false)
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

      expect(result).toBeDefined()
      expect('error' in result!).toBe(false)
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

    it('does not publish offline activation cache after a concurrent end commits', async () => {
      const unactivated = makeSession({ isActive: false, endedAt: null, qrToken: null })
      const activated = makeSession({ isActive: true, endedAt: null, qrToken: VALID_TOKEN })
      const ended = makeSession({ isActive: false, endedAt: new Date(), qrToken: null })
      prisma.session.findUnique.mockResolvedValueOnce(unactivated).mockResolvedValue(ended)
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      prisma.session.findUniqueOrThrow.mockResolvedValue(activated)
      prisma.enrollment.findMany.mockResolvedValue([])
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 })
      mockedVerifyQRToken.mockReturnValue(validPayload())

      const result = await (service as any).performOfflineActivation('sess-1', VALID_TOKEN, new Date(), false)

      expect(result).toBe('activated')
      expect(redis.setJson).not.toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: true }),
        expect.any(Number),
      )
      expect(redis.delete).toHaveBeenCalledWith('active-session:sess-1')
    })

    it('writes the autoEndAt deadline so the cron can sweep a scan-armed session', async () => {
      const issuedAt = Date.now() - 2 * 60_000
      const unactivated = makeSession({ isActive: false, endedAt: null, qrToken: null })
      const activated = makeSession({ isActive: true, endedAt: null, qrToken: VALID_TOKEN })
      prisma.session.findUnique.mockResolvedValueOnce(unactivated).mockResolvedValue(activated)
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      prisma.session.findUniqueOrThrow.mockResolvedValue(activated)
      prisma.enrollment.findMany.mockResolvedValue([])
      prisma.attendanceRecord.createMany.mockResolvedValue({ count: 0 })
      mockedVerifyQRToken.mockReturnValue(validPayload({ issuedAt, validityMinutes: 10, gracePeriodMinutes: 5 }))

      const result = await (service as any).performOfflineActivation('sess-1', VALID_TOKEN, new Date(), true)

      expect(result).toBe('activated')
      const data = prisma.session.updateMany.mock.calls[0][0].data
      expect(data.isActive).toBe(true)
      // The cron filters on `autoEndAt: { not: null }`; a null deadline would
      // leave the session live and every roster row pending forever (DD-B1).
      expect(data.autoEndAt).toEqual(new Date(issuedAt + (10 + 5) * 60_000))
    })

    it('rejects delayed offline scans that exceed the current timing caps', async () => {
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

      expect(result).toBeDefined()
      expect('error' in result!).toBe(true)
      expect(prisma.session.updateMany).not.toHaveBeenCalled()
    })

    describe('online dual-checkpoint submissions', () => {
      const PIN_HASH = 'p1$pbkdf2-sha256$10000$c2FsdA$aGFzaA'
      const onlineSession = () =>
        makeCachedSession({
          mode: 'online',
          isActive: true,
          qrToken: null,
          qrTokenExpiresAt: null,
          qrGeneratedAt: null,
          startQrToken: VALID_TOKEN,
          startTokenExpiresAt: new Date(ISSUED_AT + 90_000),
          startQrGeneratedAt: new Date(ISSUED_AT),
          startQrValiditySeconds: 90,
          startGraceMinutes: 10,
          startPinHash: PIN_HASH,
          endQrToken: null,
          endTokenExpiresAt: null,
          endQrGeneratedAt: null,
          endQrValiditySeconds: 90,
          endGraceMinutes: 0,
          endPinHash: null,
          autoEndAt: new Date(ISSUED_AT + 120 * 60_000),
          geofenceLatitude: null,
          geofenceLongitude: null,
          geofenceRadiusMeters: null,
        })
      const onlinePayload = () =>
        validPayload({
          mode: 'online',
          checkpoint: 'start',
          pinRequired: true,
          pinHash: PIN_HASH,
          validitySeconds: 90,
          gracePeriodMinutes: 10,
          validityMinutes: 2,
        })
      const onlineArgs = {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        deviceId: 'device-online',
        qrToken: VALID_TOKEN,
        clientAttemptId: 'online-attempt-1',
        inputChannel: 'image' as const,
        pin: '83',
      }

      beforeEach(() => {
        prisma.session.findUnique.mockResolvedValue(onlineSession())
        redis.getJson.mockResolvedValue(onlineSession())
        prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
        prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
        mockedVerifyQRToken.mockReturnValue(onlinePayload())
        mockedVerifyMeetingPin.mockResolvedValue(true)
      })

      it('records an online check-in with null coordinates and checkpoint fields (RA 10173)', async () => {
        prisma.attendanceRecord.findUnique.mockResolvedValue(
          makeRosterRecord({ status: 'pending', latitude: null, longitude: null }),
        )
        prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
        prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
          makeRosterRecord({
            status: 'pending',
            latitude: null,
            longitude: null,
            checkInStatus: 'present',
            checkInToken: VALID_TOKEN,
          }),
        )

        // A modified client may still send coordinates for an online token;
        // they must never be persisted (RA 10173 data minimization).
        const result = (await service.submit(studentUser, {
          ...onlineArgs,
          latitude: 14.6,
          longitude: 121,
        })) as any

        expect(result.success).toBe(true)
        const update = prisma.attendanceRecord.updateMany.mock.calls[0][0].data
        expect(update.latitude).toBeNull()
        expect(update.longitude).toBeNull()
        expect(update.checkInToken).toBe(VALID_TOKEN)
        expect(update.checkInStatus).toBe('present')
        // The record stays pending until the session closes (dual resolution).
        expect(update.status).toBeUndefined()
        // Zero-GPS: no coordinate plausibility profiling for online scans.
        expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
        const attempt = prisma.scanAttempt.create.mock.calls[0][0].data
        expect(attempt.checkpoint).toBe('start')
        expect(attempt.pinVerified).toBe(true)
        expect(attempt.latitude).toBeUndefined()
        expect(attempt.longitude).toBeUndefined()
        expect(attempt.accuracyMeters).toBeUndefined()
        expect(attempt.mocked).toBeUndefined()
        expect(mockedVerifyMeetingPin).toHaveBeenCalledWith('83', PIN_HASH)
      })

      it('denies an incorrect meeting PIN without touching attendance', async () => {
        mockedVerifyMeetingPin.mockResolvedValue(false)

        const result = await service.submit(studentUser, onlineArgs)

        expect(result.success).toBe(false)
        expect(result.reason).toBe('pin_incorrect')
        expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
        expect(prisma.attendanceRecord.findUnique).not.toHaveBeenCalled()
        expect(prisma.scanAttempt.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ outcome: 'denied', reason: 'pin_incorrect', pinVerified: false }),
          }),
        )
      })

      it('requires the meeting PIN when the checkpoint token demands it', async () => {
        const result = await service.submit(studentUser, { ...onlineArgs, pin: undefined })

        expect(result.success).toBe(false)
        expect(result.reason).toBe('pin_required')
        expect(mockedVerifyMeetingPin).not.toHaveBeenCalled()
        expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled()
      })
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
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: null } : undefined,
      )
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

  describe('attendance hash-chain wiring (F9)', () => {
    const ledgerSubmitArgs = {
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      latitude: 14.6,
      longitude: 121.0,
      deviceId: 'device-A',
      qrToken: VALID_TOKEN,
      clientAttemptId: 'ledger-attempt-1',
      accuracyMeters: 5,
      locationCapturedAt: LOCATION_CAPTURED_AT,
      inputChannel: 'camera' as const,
    }
    let ledger: { appendLedger: jest.Mock }

    beforeEach(() => {
      ledger = moduleRef.get(LedgerService, { strict: false }) as unknown as { appendLedger: jest.Mock }
      jest.spyOn(ledger, 'appendLedger').mockResolvedValue('chain-hash')
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
    })

    it('appends the chain inside the same transaction as an accepted scan commit', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Jane Doe', program: 'BSIT' },
      })
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: null } : makeRosterRecord(),
      )
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'present', timestamp: new Date(ISSUED_AT) }),
      )

      const result = await service.submit(studentUser, ledgerSubmitArgs)

      expect(result).toEqual(expect.objectContaining({ success: true, status: 'present' }))
      expect(ledger.appendLedger).toHaveBeenCalledTimes(1)
      const [tx, record] = ledger.appendLedger.mock.calls[0] as unknown as [
        unknown,
        { id: string; sessionId: string; studentId: string; timestamp: Date },
      ]
      expect(record).toEqual({ id: 'rec-1', sessionId: 'sess-1', studentId: 'stu-1', timestamp: new Date(ISSUED_AT) })
      // The advisory lock plus row update run through the transaction handle.
      expect(tx).toBe(prisma)
      expect(ledger.appendLedger.mock.invocationCallOrder[0]).toBeGreaterThan(
        prisma.attendanceRecord.updateMany.mock.invocationCallOrder[0],
      )
      expect(ledger.appendLedger.mock.invocationCallOrder[0]).toBeLessThan(
        realtime.emitAttendanceUpdated.mock.invocationCallOrder[0],
      )
    })

    it('rolls the whole attendance commit back when the ledger append fails (fail closed)', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Jane Doe', program: 'BSIT' },
      })
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: null } : makeRosterRecord(),
      )
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))
      const thrown = new Error('ledger storage refusing writes')
      ledger.appendLedger.mockRejectedValue(thrown)

      await expect(service.submit(studentUser, ledgerSubmitArgs)).rejects.toThrow('ledger storage refusing writes')
      expect(realtime.emitAttendanceUpdated).not.toHaveBeenCalled()
      expect(prisma.scanAttempt.update).not.toHaveBeenCalled()
    })

    it('does not append when the record commit loses the claim (duplicate scan)', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Jane Doe', program: 'BSIT' },
      })
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined
          ? { recordHash: 'already-chained' }
          : makeRosterRecord({ status: 'present', tokenSnapshot: VALID_TOKEN }),
      )
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.submit(studentUser, ledgerSubmitArgs)

      expect(result).toEqual(expect.objectContaining({ success: false, reason: 'duplicate' }))
      expect(ledger.appendLedger).not.toHaveBeenCalled()
    })

    it('chains only once for the online check-in leg, skipping the check-out commit', async () => {
      const enrolled = makeRosterRecord({ status: 'pending', latitude: null, longitude: null })
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: 'chain-from-check-in' } : enrolled,
      )
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'pending', latitude: null, longitude: null }),
      )
      const onlineSession = makeCachedSession({
        mode: 'online',
        isActive: true,
        qrToken: null,
        qrGeneratedAt: null,
        startQrToken: VALID_TOKEN,
        startQrGeneratedAt: new Date(ISSUED_AT),
        startQrValiditySeconds: 90,
        startGraceMinutes: 10,
        startPinHash: 'p1$pbkdf2-sha256$10000$c2FsdA$aGFzaA',
        geofenceLatitude: null,
        geofenceLongitude: null,
        geofenceRadiusMeters: null,
      })
      prisma.session.findUnique.mockResolvedValue(onlineSession)
      redis.getJson.mockResolvedValue(onlineSession)
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(
        validPayload({
          mode: 'online',
          checkpoint: 'start',
          pinRequired: true,
          pinHash: 'p1$pbkdf2-sha256$10000$c2FsdA$aGFzaA',
          validitySeconds: 90,
          gracePeriodMinutes: 10,
          validityMinutes: 2,
        }),
      )
      mockedVerifyMeetingPin.mockResolvedValue(true)
      redis.consumeRateLimit.mockResolvedValue(true)

      const result = await service.scan(studentUser, {
        sessionId: 'sess-1',
        lat: 14.6,
        lon: 121.0,
        deviceId: 'device-online',
        qrToken: VALID_TOKEN,
        clientAttemptId: 'online-attempt-2',
        inputChannel: 'image' as const,
        pin: '83',
      })

      expect(ledger.appendLedger).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ status: 'pending', coordinates: { latitude: null, longitude: null } })
    })

    it('chains manual attendance commits inside their own transaction', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ sectionId: 'sec-1', teacherId: 'teacher-1' }))
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Bob Doe', program: 'BSIT' },
      })
      const upserted = makeRosterRecord({ studentId: 'stu-2', status: 'absent', manuallySet: true })
      prisma.attendanceRecord.upsert.mockResolvedValue(upserted)
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: null } : undefined,
      )

      await service.createManual(teacherUser, {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        studentId: 'stu-2',
        status: 'absent' as const,
      })

      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(1)
      expect(ledger.appendLedger).toHaveBeenCalledTimes(1)
      const [tx, record] = ledger.appendLedger.mock.calls[0] as unknown as [unknown, { id: string; studentId: string }]
      expect(tx).toBe(prisma)
      expect(record.studentId).toBe('stu-2')
    })

    it('never modifies an already-committed timestamp on manual re-mark', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ sectionId: 'sec-1', teacherId: 'teacher-1' }))
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        student: { fullName: 'Bob Doe', program: 'BSIT' },
      })
      const upserted = makeRosterRecord({ studentId: 'stu-2', status: 'present', manuallySet: true })
      prisma.attendanceRecord.upsert.mockResolvedValue(upserted)
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: 'chain-hash-committed' } : undefined,
      )

      const result = await service.createManual(teacherUser, {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        studentId: 'stu-2',
        status: 'present' as const,
      })

      const args = prisma.attendanceRecord.upsert.mock.calls[0][0]
      expect(args.update).toEqual({ status: 'present', manuallySet: true })
      expect(result.status).toBe('present')
      // Idempotent ledger append sees the committed row and stays a no-op.
      expect(ledger.appendLedger).toHaveBeenCalledTimes(1)
    })

    it('keeps roster seed rows off the chain during offline activation', async () => {
      const onlineSessionInactive = makeCachedSession({ isActive: false, qrToken: null, endedAt: null })
      prisma.session.findUnique.mockResolvedValueOnce(onlineSessionInactive).mockResolvedValue(makeCachedSession())
      prisma.session.updateMany.mockResolvedValue({ count: 1 })
      redis.getJson.mockResolvedValue(null)
      redis.acquireLock.mockResolvedValue('lock-1')
      redis.releaseLock.mockResolvedValue(undefined)
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.enrollment.findMany.mockResolvedValue([])
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.findUnique.mockImplementation(async (args: { select?: { recordHash?: unknown } }) =>
        args?.select?.recordHash !== undefined ? { recordHash: null } : makeRosterRecord(),
      )
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))

      const result = await service.syncScan(studentUser, {
        ...ledgerSubmitArgs,
        scannedAt: new Date(ISSUED_AT).toISOString(),
        locationCapturedAt: new Date(ISSUED_AT).toISOString(),
      })

      expect(prisma.attendanceRecord.createMany).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ status: 'present' })
      // Only the scan commit chains; the seeded placeholder rows were never hashed.
      expect(ledger.appendLedger).toHaveBeenCalledTimes(1)
    })
  })

  describe('F2 attendance:anomaly emission (denied scans)', () => {
    const denialArgs = {
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      latitude: 14.7,
      longitude: 121.2,
      deviceId: 'device-A',
      qrToken: VALID_TOKEN,
      clientAttemptId: 'anomaly-attempt-1',
      accuracyMeters: 5,
      locationCapturedAt: LOCATION_CAPTURED_AT,
      scannedAt: new Date(ISSUED_AT).toISOString(),
      inputChannel: 'camera' as const,
    }

    const PIN_HASH = 'p1$pbkdf2-sha256$10000$c2FsdA$aGFzaA'
    const onlineSession = () =>
      makeCachedSession({
        mode: 'online',
        isActive: true,
        qrToken: null,
        qrTokenExpiresAt: null,
        qrGeneratedAt: null,
        startQrToken: VALID_TOKEN,
        startTokenExpiresAt: new Date(Date.now() + 120_000),
        startQrGeneratedAt: new Date(),
        startQrValiditySeconds: 90,
        startGraceMinutes: 10,
        startPinHash: PIN_HASH,
        geofenceLatitude: null,
        geofenceLongitude: null,
        geofenceRadiusMeters: null,
      })
    const onlinePayload = () =>
      validPayload({
        mode: 'online',
        checkpoint: 'start',
        pinRequired: true,
        pinHash: PIN_HASH,
        validitySeconds: 90,
        gracePeriodMinutes: 10,
        validityMinutes: 2,
      })
    const onlineArgs = {
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      deviceId: 'device-online',
      qrToken: VALID_TOKEN,
      clientAttemptId: 'online-attempt-9',
      inputChannel: 'image' as const,
      pin: '83',
    }

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        teacherPublicKey: 'pk',
        fullName: 'Juan Dela Cruz',
        studentId: '2023-0001',
      })
    })

    it('emits an anomaly for a denied in-person attempt with coordinates', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(120)

      await service.submit(studentUser, denialArgs)

      expect(realtime.emitAttendanceAnomaly).toHaveBeenCalledWith(
        { id: 'sess-1' },
        expect.objectContaining({
          sessionId: 'sess-1',
          studentId: 'stu-1',
          studentName: 'Juan Dela Cruz',
          studentNumber: '2023-0001',
          latitude: 14.7,
          longitude: 121.2,
          distanceMeters: 120,
          geofenceRadiusMeters: 50,
          reason: 'outside_geofence',
          timestamp: expect.any(String),
        }),
      )
    })

    it('emits anomalies for mocked-location denials with coordinates', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)

      await service.submit(studentUser, { ...denialArgs, clientAttemptId: 'mocked-attempt-1', mocked: true })

      expect(realtime.emitAttendanceAnomaly).toHaveBeenCalledWith(
        { id: 'sess-1' },
        expect.objectContaining({ reason: 'mocked_location', latitude: 14.7 }),
      )
    })

    it('never emits for PIN failures (authenticated students mistyping a secret, not geolocation anomalies)', async () => {
      prisma.session.findUnique.mockResolvedValue(onlineSession())
      redis.getJson.mockResolvedValue(onlineSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(onlinePayload())
      mockedVerifyMeetingPin.mockResolvedValue(false)

      const result = await service.submit(studentUser, onlineArgs)

      expect(result.reason).toBe('pin_incorrect')
      expect(realtime.emitAttendanceAnomaly).not.toHaveBeenCalled()
    })

    it('never emits for online-mode denials (RA 10173: no coordinates are plotted)', async () => {
      // Online + wrong PIN even when a modified client sends coordinates:
      // still an online-mode failure, no geolocation anomaly event.
      prisma.session.findUnique.mockResolvedValue(onlineSession())
      redis.getJson.mockResolvedValue(onlineSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(onlinePayload())
      mockedVerifyMeetingPin.mockResolvedValue(false)

      await service.submit(studentUser, { ...onlineArgs, pin: '00', latitude: 14.6, longitude: 121 })

      expect(realtime.emitAttendanceAnomaly).not.toHaveBeenCalled()
    })

    it('never emits a denial that carries no coordinates', async () => {
      // Replay of a previously denied attempt whose original evidence had no fix.
      prisma.session.findUnique.mockResolvedValue(makeCachedSession({ qrToken: null, isActive: false }))
      prisma.scanAttempt.findUnique.mockResolvedValue({
        sessionId: 'sess-1',
        tokenHash: createHash('sha256').update(VALID_TOKEN).digest('hex'),
        latitude: null,
        longitude: null,
        deviceId: 'device-A',
        inputChannel: 'camera',
        accuracyMeters: undefined,
        mocked: undefined,
        riskSignals: null,
        clientScannedAt: new Date(ISSUED_AT),
        locationCapturedAt: new Date(LOCATION_CAPTURED_AT),
        reason: 'outside_geofence',
        message: '',
        acceptedAttendanceRecord: null,
        acceptedCheckInRecord: null,
        acceptedCheckOutRecord: null,
      })

      const result = await service.submit(studentUser, { ...denialArgs, latitude: undefined, longitude: undefined })

      expect(result.success).toBe(false)
      expect(realtime.emitAttendanceAnomaly).not.toHaveBeenCalled()
    })

    it('emits replayed rejections through the replay funnel', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      prisma.scanAttempt.findUnique.mockResolvedValue({
        sessionId: 'sess-1',
        tokenHash: createHash('sha256').update(VALID_TOKEN).digest('hex'),
        latitude: 14.7,
        longitude: 121.2,
        deviceId: 'device-A',
        inputChannel: 'camera',
        accuracyMeters: 5,
        mocked: undefined,
        riskSignals: null,
        clientScannedAt: new Date(ISSUED_AT),
        locationCapturedAt: new Date(LOCATION_CAPTURED_AT),
        reason: 'outside_geofence',
        message: '',
        acceptedAttendanceRecord: null,
        acceptedCheckInRecord: null,
        acceptedCheckOutRecord: null,
      })

      await service.submit(studentUser, denialArgs)

      expect(prisma.scanAttempt.create).not.toHaveBeenCalled()
      expect(realtime.emitAttendanceAnomaly).toHaveBeenCalledWith(
        { id: 'sess-1' },
        expect.objectContaining({
          reason: 'outside_geofence',
          studentId: 'stu-1',
          studentName: 'Juan Dela Cruz',
          distanceMeters: expect.any(Number),
          geofenceRadiusMeters: 50,
        }),
      )
    })

    it('emits duplicate-submission denials as replay anomalies', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRosterRecord({ status: 'present', tokenSnapshot: VALID_TOKEN }),
      )
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.submit(studentUser, denialArgs)

      expect(result.reason).toBe('duplicate')
      expect(realtime.emitAttendanceAnomaly).toHaveBeenCalledWith(
        { id: 'sess-1' },
        expect.objectContaining({ reason: 'duplicate', sessionId: 'sess-1', studentId: 'stu-1' }),
      )
    })

    it('never emits for rate-limited attempts or accepted scans', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)

      await service.submit(studentUser, denialArgs)

      expect(realtime.emitAttendanceAnomaly).not.toHaveBeenCalled()

      redis.consumeRateLimit.mockResolvedValue(true)
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))

      await service.submit(studentUser, denialArgs)

      expect(realtime.emitAttendanceUpdated).toHaveBeenCalled()
      expect(realtime.emitAttendanceAnomaly).not.toHaveBeenCalled()
    })

    it('keeps the scan response intact when the anomaly broadcast fails', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(120)
      realtime.emitAttendanceAnomaly.mockImplementation(() => {
        throw new Error('socket.io room gone')
      })

      const result = await service.submit(studentUser, denialArgs)

      expect(result.success).toBe(false)
      expect(result.reason).toBe('outside_geofence')
    })

    it('sends attendance:updated with the enrolled student name for the kiosk ticker', async () => {
      prisma.session.findUnique.mockResolvedValue(makeCachedSession())
      redis.getJson.mockResolvedValue(makeCachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedHaversineDistance.mockReturnValue(0)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord())
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(makeRosterRecord({ status: 'present' }))

      await service.submit(studentUser, denialArgs)

      expect(realtime.emitAttendanceUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ studentName: 'Jane Doe', studentId: 'stu-1', status: 'present' }),
      )
    })
  })
})
