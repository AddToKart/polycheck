import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { AttendanceService } from './attendance.service'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

jest.mock('@polycheck/shared', () => ({
  verifyQRToken: jest.fn(),
  isWithinGeofence: jest.fn(),
}))

import { verifyQRToken, isWithinGeofence } from '@polycheck/shared'

const mockedVerifyQRToken = verifyQRToken as jest.MockedFunction<typeof verifyQRToken>
const mockedIsWithinGeofence = isWithinGeofence as jest.MockedFunction<typeof isWithinGeofence>

const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }
const adminUser: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

const VALID_TOKEN = 't'.repeat(100)
const ISSUED_AT = Date.now() - 30_000 // 30 seconds ago

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
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      session: { findUnique: jest.fn(), findMany: jest.fn() },
      section: { findUnique: jest.fn() },
      enrollment: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      scanAttempt: { create: jest.fn() },
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
    mockedIsWithinGeofence.mockReset()

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

      const result = await service.findAll(adminUser)

      expect(Array.isArray(result)).toBe(true)
      expect(result[0].coordinates).toEqual({ latitude: 14.6, longitude: 121 })
    })

    it('offers pagination through the dedicated page method', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      prisma.attendanceRecord.count.mockResolvedValue(4)

      const result = await service.findPage(adminUser, undefined, { limit: 1, offset: 2 })

      expect(prisma.attendanceRecord.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({ take: 1, skip: 2 }))
      expect(result).toEqual(expect.objectContaining({ total: 4, limit: 1, offset: 2, hasMore: true }))
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
      mockedIsWithinGeofence.mockReturnValue(false)
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
      mockedIsWithinGeofence.mockReturnValue(true)
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
      mockedIsWithinGeofence.mockReturnValue(true)
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
      mockedIsWithinGeofence.mockReturnValue(true)

      const result = await service.check(studentUser, {
        ...checkArgs,
        scannedAt: new Date(issuedAtExpired + 60_000).toISOString(),
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
    }

    it('returns rate_limited when consumeRateLimit returns false', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)
      const result = await service.check(studentUser, checkArgs)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('rate_limited')
      expect(result.status).toBe('absent')
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
      mockedIsWithinGeofence.mockReturnValue(true)
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
      mockedIsWithinGeofence.mockReturnValue(true)
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

    it('disputes submission with suspicious coordinates', async () => {
      prisma.session.findUnique.mockResolvedValue(cachedSession())
      redis.getJson.mockResolvedValue(cachedSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      mockedVerifyQRToken.mockReturnValue(validPayload())
      mockedIsWithinGeofence.mockReturnValue(true)
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
      mockedIsWithinGeofence.mockReturnValue(true)
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
      mockedIsWithinGeofence.mockReturnValue(true)
      prisma.attendanceRecord.findUnique.mockResolvedValue(makeRosterRecord({ status: 'absent' }))
      prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 1 })
      prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue(
        makeRosterRecord({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )

      const result = await service.syncScan(studentUser, { ...submitArgs, lat: 14.6, lon: 121, scannedAt })

      expect('error' in result).toBe(false)
      expect(prisma.attendanceRecord.updateMany.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ status: 'disputed', disputeReason: 'delayed_offline_sync' }),
      )
      expect(prisma.attendanceRecord.updateMany.mock.calls[0][0].where.status).toEqual({
        in: ['pending', 'absent'],
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

    it('forbids teacher when student not enrolled in any of their sections (no sectionId)', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(null)
      await expect(service.forStudent(teacherUser, 'stu-1')).rejects.toThrow(ForbiddenException)
    })

    it('allows teacher to view when they own the provided section', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      const result = await service.forStudent(teacherUser, 'stu-1', 'sec-1')
      expect(result.length).toBe(1)
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.sectionId).toBe('sec-1')
    })

    it('allows teacher when student enrolled in their section (no sectionId)', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' })
      prisma.attendanceRecord.findMany.mockResolvedValue([makeRosterRecord()])
      const result = await service.forStudent(teacherUser, 'stu-1')
      expect(result.length).toBe(1)
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
