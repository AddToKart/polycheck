import { Test } from '@nestjs/testing'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { SessionsService } from './sessions.service'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import type { RequestUser } from '../auth/authenticated-principal'
import type { ActivateSessionDto, CreateBulkSessionsDto, CreateSessionDto } from './dto/create-session.dto'

jest.mock('@polycheck/shared', () => ({
  decodePinHashRecord: jest.fn(),
  haversineDistance: jest.fn(),
}))

jest.mock('@polycheck/shared/token-node', () => ({
  verifyQRTokenNative: jest.fn(),
}))

import { decodePinHashRecord, haversineDistance } from '@polycheck/shared'
import { verifyQRTokenNative } from '@polycheck/shared/token-node'

const mockedVerifyQRToken = verifyQRTokenNative as jest.MockedFunction<typeof verifyQRTokenNative>
const mockedDecodePinHash = decodePinHashRecord as jest.MockedFunction<typeof decodePinHashRecord>
const mockedHaversineDistance = haversineDistance as jest.MockedFunction<typeof haversineDistance>

const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }
const adminUser: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

function makeSession(overrides: any = {}) {
  return {
    id: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    subjectName: 'CS 101',
    date: '2026-07-14',
    startTime: '10:00',
    endTime: '11:00',
    room: 'R-1',
    mode: 'in_person',
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
    startQrValiditySeconds: null,
    startGraceMinutes: null,
    endQrValiditySeconds: null,
    endGraceMinutes: 0,
    startQrToken: null,
    startTokenExpiresAt: null,
    startQrGeneratedAt: null,
    startPinHash: null,
    endQrToken: null,
    endTokenExpiresAt: null,
    endQrGeneratedAt: null,
    endPinHash: null,
    autoEndAt: null,
    geofenceLatitude: 14.6,
    geofenceLongitude: 121.0,
    geofenceRadiusMeters: 50,
    isActive: false,
    endedAt: null,
    qrToken: null,
    qrTokenExpiresAt: null,
    qrGeneratedAt: null,
    isRescheduled: false,
    createdAt: new Date('2026-07-14'),
    ...overrides,
  }
}

describe('SessionsService', () => {
  let service: SessionsService
  let prisma: any
  let realtime: {
    emitAttendanceUpdated: jest.Mock
    emitSessionState: jest.Mock
    emitSessionFinale: jest.Mock
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
      session: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      section: { findUnique: jest.fn(), findFirst: jest.fn() },
      enrollment: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(4) },
      attendanceRecord: { createMany: jest.fn(), updateMany: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
      sectionRole: { findUnique: jest.fn() },
      sessionPermission: { findFirst: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
    }
    realtime = {
      emitAttendanceUpdated: jest.fn(),
      emitSessionState: jest.fn(),
      emitSessionFinale: jest.fn(),
    }
    redis = {
      consumeRateLimit: jest.fn().mockResolvedValue(true),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
      setIfAbsent: jest.fn().mockResolvedValue(true),
      acquireLock: jest.fn().mockResolvedValue('owner-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    }
    mockedVerifyQRToken.mockReset()
    mockedHaversineDistance.mockReset().mockReturnValue(20)

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AttendanceGateway, useValue: realtime },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()

    service = moduleRef.get(SessionsService)
  })

  describe('findAll', () => {
    it('super_admin sees all sessions (no scope filter, no teacherId filter)', async () => {
      prisma.session.findMany.mockResolvedValue([makeSession()])
      prisma.user.findMany.mockResolvedValue([{ id: 'teacher-1', teacherPublicKey: 'pk' }])
      const result = await service.findAll(adminUser)
      const where = prisma.session.findMany.mock.calls[0][0]?.where
      expect(where).toEqual({})
      expect(result[0].teacherPublicKey).toBe('pk')
      expect(result[0].geofence).toEqual({ latitude: 14.6, longitude: 121.0, radiusMeters: 50 })
    })

    it('teacher only sees their sessions (teacherId filter)', async () => {
      prisma.session.findMany.mockResolvedValue([])
      prisma.user.findMany.mockResolvedValue([])
      await service.findAll(teacherUser)
      const where = prisma.session.findMany.mock.calls[0][0]?.where
      expect(where.teacherId).toBe('teacher-1')
    })

    it('student filters by enrolled sections', async () => {
      prisma.enrollment.findMany.mockResolvedValue([{ sectionId: 'sec-1' }, { sectionId: 'sec-2' }])
      prisma.session.findMany.mockResolvedValue([])
      prisma.user.findMany.mockResolvedValue([])
      await service.findAll(studentUser)
      const where = prisma.session.findMany.mock.calls[0][0]?.where
      expect(where.sectionId).toEqual({ in: ['sec-1', 'sec-2'] })
    })

    it('does not let an explicit section filter escape a student enrollment scope', async () => {
      prisma.enrollment.findMany.mockResolvedValue([{ sectionId: 'sec-1' }])
      prisma.session.findMany.mockResolvedValue([])
      prisma.user.findMany.mockResolvedValue([])

      await service.findAll(studentUser, 'sec-other')

      expect(prisma.session.findMany.mock.calls[0][0]?.where).toEqual({
        AND: [{ sectionId: { in: ['sec-1'] } }, { sectionId: 'sec-other' }],
      })
    })

    it('passes sectionId filter when provided', async () => {
      prisma.session.findMany.mockResolvedValue([])
      prisma.user.findMany.mockResolvedValue([])
      await service.findAll(teacherUser, 'sec-9')
      const where = prisma.session.findMany.mock.calls[0][0]?.where
      expect(where.sectionId).toBe('sec-9')
    })

    it('offers pagination through the dedicated page method without changing the array contract', async () => {
      prisma.session.findMany.mockResolvedValue([makeSession()])
      prisma.session.count.mockResolvedValue(3)
      prisma.user.findMany.mockResolvedValue([{ id: 'teacher-1', teacherPublicKey: 'pk' }])

      const result = await service.findPage(adminUser, undefined, { limit: 1, offset: 1 })

      expect(prisma.session.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({ take: 1, skip: 1 }))
      expect(result.data).toHaveLength(1)
      expect(result).toEqual(expect.objectContaining({ total: 3, limit: 1, offset: 1, hasMore: true }))
    })
  })

  describe('findOne', () => {
    it('returns presented session for super_admin', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.findOne('sess-1', adminUser)
      expect(result.teacherPublicKey).toBe('pk')
      expect(result.geofence?.radiusMeters).toBe(50)
    })

    it('throws NotFoundException when session missing', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(service.findOne('missing', adminUser)).rejects.toThrow(NotFoundException)
    })

    it('allows teacher who owns the session', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ teacherId: 'teacher-1' }))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.findOne('sess-1', teacherUser)
      expect(result).toBeDefined()
    })

    it('forbids student not enrolled in section', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.enrollment.findUnique.mockResolvedValue(null)
      await expect(service.findOne('sess-1', studentUser)).rejects.toThrow(ForbiddenException)
    })

    it('allows enrolled student', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ qrToken: 'secret-qr-token' }))
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.findOne('sess-1', studentUser)
      expect(result.id).toBe('sess-1')
      expect(result.qrToken).toBeUndefined()
    })
  })

  describe('create', () => {
    const dto: CreateSessionDto = {
      sectionId: 'sec-1',
      subjectName: 'CS 101',
      date: '2026-07-14',
      startTime: '10:00',
      endTime: '11:00',
      qrValidityMinutes: 10,
      gracePeriodMinutes: 5,
      geofence: { latitude: 14.6, longitude: 121.0, radiusMeters: 50 },
      room: 'R-1',
    }

    it('creates a session for teacher who owns the section', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } }) },
        session: { create: jest.fn().mockResolvedValue(makeSession()) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.create(dto, teacherUser)
      const args = tx.session.create.mock.calls[0][0]?.data
      expect(args.teacherId).toBe('teacher-1')
      expect(args.geofenceLatitude).toBe(14.6)
      expect(args.geofenceRadiusMeters).toBe(50)
      expect(args.geofence).toBeUndefined()
      expect(realtime.emitSessionState).toHaveBeenCalled()
      expect(result.teacherPublicKey).toBe('pk')
    })

    it('forbids teacher who does not own the section', async () => {
      const tx = {
        section: {
          findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-other', subject: { name: 'CS 101' } }),
        },
        session: { create: jest.fn() },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      await expect(service.create(dto, teacherUser)).rejects.toThrow(ForbiddenException)
      expect(tx.session.create).not.toHaveBeenCalled()
    })

    it('rejects impossible calendar dates before writing a session', async () => {
      await expect(service.create({ ...dto, date: '2026-02-30' }, teacherUser)).rejects.toThrow(BadRequestException)
      expect(prisma.section.findUnique).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when section does not exist', async () => {
      const tx = { section: { findUnique: jest.fn().mockResolvedValue(null) } }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      await expect(service.create(dto, teacherUser)).rejects.toThrow(NotFoundException)
    })

    it('allows student with president role and active session permission', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } }) },
        enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
        sectionRole: { findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }) },
        sessionPermission: { findFirst: jest.fn().mockResolvedValue({ id: 'perm-1' }) },
        session: { create: jest.fn().mockResolvedValue(makeSession()) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.create(dto, studentUser)
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.enrollment.findUnique.mock.invocationCallOrder[0],
      )
      expect(tx.session.create.mock.calls[0][0]?.data.teacherId).toBe('teacher-1')
      expect(result).toBeDefined()
    })

    it('forbids student without president role or permission', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } }) },
        enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
        sectionRole: { findUnique: jest.fn().mockResolvedValue(null) },
        sessionPermission: { findFirst: jest.fn().mockResolvedValue(null) },
        session: { create: jest.fn() },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      await expect(service.create(dto, studentUser)).rejects.toThrow(ForbiddenException)
      expect(tx.session.create).not.toHaveBeenCalled()
    })

    it('forbids student with role but inactive permission', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } }) },
        enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
        sectionRole: { findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }) },
        sessionPermission: { findFirst: jest.fn().mockResolvedValue(null) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      await expect(service.create(dto, studentUser)).rejects.toThrow(ForbiddenException)
    })

    it('forbids a removed student even when stale president role and permission rows remain', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } }) },
        enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
        sectionRole: { findUnique: jest.fn().mockResolvedValue({ id: 'stale-role' }) },
        sessionPermission: { findFirst: jest.fn().mockResolvedValue({ id: 'stale-permission' }) },
        session: { create: jest.fn() },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await expect(service.create(dto, studentUser)).rejects.toThrow('must be enrolled')
      expect(tx.session.create).not.toHaveBeenCalled()
    })
  })

  describe('activate', () => {
    const dto: ActivateSessionDto = { validityMinutes: 10, token: 'a'.repeat(80) }
    const issuedAt = Date.now() - 1000

    it('throws NotFoundException when session missing', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(service.activate('missing', dto, teacherUser)).rejects.toThrow(NotFoundException)
    })

    it('rejects activation timing above the hardened caps without changing persisted session values', async () => {
      await expect(service.activate('sess-1', { ...dto, validityMinutes: 16 }, teacherUser)).rejects.toThrow(
        BadRequestException,
      )
      await expect(service.activate('sess-1', { ...dto, gracePeriodMinutes: 61 }, teacherUser)).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.session.findUnique).not.toHaveBeenCalled()
    })

    it('forbids teacher who does not own the section', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other', subject: { name: 'CS 101' } })
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(ForbiddenException)
    })

    it('throws BadRequest when teacher has no signing key', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: null })
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequest when token signature is invalid', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue(null)
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequest when token does not match session', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-other',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequest when validity minutes mismatch', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 99,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(BadRequestException)
    })

    it('materializes an expired signed offline activation as ended with an absent roster', async () => {
      const session = makeSession()
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt: Date.now() - 20 * 60_000,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
        enrollment: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ studentId: 'stu-1', student: { fullName: 'Jane Doe', program: 'BSIT' } }]),
        },
        attendanceRecord: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

      const result = await service.activate('sess-1', dto, teacherUser)

      expect(tx.session.updateMany.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ isActive: false, qrToken: null, endedAt: expect.any(Date) }),
      )
      expect(tx.attendanceRecord.createMany.mock.calls[0][0].data[0].status).toBe('absent')
      expect(tx.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess-1', status: 'pending' },
        data: { status: 'absent', manuallySet: false },
      })
      expect(realtime.emitSessionState).toHaveBeenCalledWith(ended, 'ended')
      expect(redis.delete).toHaveBeenCalledWith('active-session:sess-1')
      expect(redis.setJson).not.toHaveBeenCalled()
      expect(result.isActive).toBe(false)
    })

    it('activates session, seeds pending attendance records, caches, and emits state', async () => {
      const session = makeSession()
      const activated = { ...session, isActive: true, qrToken: dto.token }
      prisma.session.findUnique.mockResolvedValueOnce(session).mockResolvedValue(activated)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)

      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(activated),
        },
        enrollment: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 'stu-1',
              student: { fullName: 'Jane Doe', program: 'BSIT' },
            },
          ]),
        },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))

      const result = await service.activate('sess-1', dto, teacherUser)
      expect(tx.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sess-1', isActive: false, endedAt: null, qrToken: null } }),
      )
      expect(tx.attendanceRecord.createMany).toHaveBeenCalled()
      const createArgs = tx.attendanceRecord.createMany.mock.calls[0][0]?.data
      expect(createArgs[0].status).toBe('pending')
      expect(realtime.emitSessionState).toHaveBeenCalledWith(expect.anything(), 'activated')
      expect(redis.setJson).toHaveBeenCalled()
      expect(result.teacherPublicKey).toBe('pk')
    })

    it('rejects a concurrent activation that loses the atomic claim', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      const tx = {
        session: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() },
        enrollment: { findMany: jest.fn() },
        attendanceRecord: { createMany: jest.fn() },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(ConflictException)
      expect(tx.enrollment.findMany).not.toHaveBeenCalled()
      expect(realtime.emitSessionState).not.toHaveBeenCalled()
    })

    it('keeps an already-committed activation successful when the Redis cache write fails', async () => {
      prisma.session.findUnique.mockResolvedValueOnce(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      const activated = { ...makeSession(), isActive: true, qrToken: dto.token }
      prisma.session.findUnique.mockResolvedValue(activated)
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(activated),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      redis.setJson.mockRejectedValue(new Error('redis unavailable'))

      const result = await service.activate('sess-1', dto, teacherUser)
      expect(result.id).toBe('sess-1')
      expect(result.qrToken).toBe(dto.token)
    })

    it('publishes the current signing key to the cache when a rotation happened during activation', async () => {
      prisma.session.findUnique.mockResolvedValueOnce(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique
        .mockResolvedValueOnce({ teacherPublicKey: 'old-key' })
        .mockResolvedValueOnce({ teacherPublicKey: 'new-key' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      const activated = { ...makeSession(), isActive: true, qrToken: dto.token }
      prisma.session.findUnique.mockResolvedValue(activated)
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(activated),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await service.activate('sess-1', dto, teacherUser)
      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ teacherPublicKey: 'new-key' }),
        expect.any(Number),
      )
    })

    it('does not publish active cache after a concurrent end commits', async () => {
      const initial = makeSession()
      const activated = makeSession({ isActive: true, qrToken: dto.token })
      const ended = makeSession({ isActive: false, endedAt: new Date(), qrToken: null })
      prisma.session.findUnique.mockResolvedValueOnce(initial).mockResolvedValue(ended)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(activated),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await service.activate('sess-1', dto, teacherUser)

      expect(redis.setJson).not.toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: true }),
        expect.any(Number),
      )
      expect(redis.delete).toHaveBeenCalledWith('active-session:sess-1')
    })

    it('skips the cache publish when a key rotation holds the rotation lock', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue({
        version: 1,
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt,
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        teacherName: '',
      } as any)
      const activated = { ...makeSession(), isActive: true, qrToken: dto.token }
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(activated),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      redis.acquireLock.mockResolvedValue(null)

      const result = await service.activate('sess-1', dto, teacherUser)
      expect(result.id).toBe('sess-1')
      expect(redis.setJson).not.toHaveBeenCalled()
    })

    it.each([
      ['an already active session', { isActive: true }],
      ['an ended session', { endedAt: new Date() }],
    ])('rejects reactivation of %s', async (_label, overrides) => {
      prisma.session.findUnique.mockResolvedValue(makeSession(overrides))
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })

      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(ConflictException)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('activate — online checkpoints', () => {
    const PIN_HASH = 'p1$pbkdf2-sha256$10000$c2FsdA$aGFzaA'
    const onlineSession = (overrides: any = {}) =>
      makeSession({
        mode: 'online',
        qrToken: null,
        qrTokenExpiresAt: null,
        qrGeneratedAt: null,
        startQrValiditySeconds: 90,
        startGraceMinutes: 10,
        endQrValiditySeconds: 90,
        endGraceMinutes: 0,
        geofenceLatitude: null,
        geofenceLongitude: null,
        geofenceRadiusMeters: null,
        ...overrides,
      })
    const onlinePayload = (overrides: any = {}) => ({
      version: 1,
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      teacherName: 'T',
      issuedAt: Date.now() - 1_000,
      validityMinutes: 2,
      gracePeriodMinutes: 10,
      mode: 'online',
      checkpoint: 'start',
      pinRequired: true,
      pinHash: PIN_HASH,
      validitySeconds: 90,
      ...overrides,
    })
    const onlineDto: ActivateSessionDto = {
      checkpoint: 'start',
      validitySeconds: 90,
      token: 'a'.repeat(80),
    }

    beforeEach(() => {
      mockedDecodePinHash.mockReturnValue({ iterations: 10_000, salt: new Uint8Array(16), digest: new Uint8Array(32) })
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
    })

    it('arms the start checkpoint, seeds a zero-GPS roster, and stores the signed PIN hash', async () => {
      const session = onlineSession()
      prisma.session.findUnique.mockResolvedValue(session)
      mockedVerifyQRToken.mockReturnValue(onlinePayload() as never)
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...session, isActive: true, startQrToken: 'token' }),
        },
        enrollment: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ studentId: 'stu-1', student: { fullName: 'Jane', program: 'BSIT' } }]),
        },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      const result = await service.activate('sess-1', onlineDto, teacherUser)

      expect(result.isActive).toBe(true)
      const claim = tx.session.updateMany.mock.calls[0][0]
      expect(claim.where).toEqual({
        id: 'sess-1',
        mode: 'online',
        isActive: false,
        endedAt: null,
        startQrToken: null,
      })
      expect(claim.data.startPinHash).toBe(PIN_HASH)
      expect(claim.data.startGraceMinutes).toBe(10)
      expect(claim.data.autoEndAt).toBeInstanceOf(Date)
      const seeded = tx.attendanceRecord.createMany.mock.calls[0][0].data[0]
      expect(seeded.latitude).toBeNull()
      expect(seeded.longitude).toBeNull()
      expect(seeded.status).toBe('pending')
    })

    it('refuses an expired start-of-class window without ending the session', async () => {
      const session = onlineSession()
      prisma.session.findUnique.mockResolvedValue(session)
      mockedVerifyQRToken.mockReturnValue(onlinePayload({ issuedAt: Date.now() - 10 * 60_000 }) as never)

      await expect(service.activate('sess-1', onlineDto, teacherUser)).rejects.toThrow(BadRequestException)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses an end checkpoint before the start checkpoint is armed', async () => {
      prisma.session.findUnique.mockResolvedValue(onlineSession({ isActive: false }))
      mockedVerifyQRToken.mockReturnValue(
        onlinePayload({ checkpoint: 'end', pinRequired: false, pinHash: undefined, gracePeriodMinutes: 0 }) as never,
      )

      await expect(
        service.activate('sess-1', { checkpoint: 'end', validitySeconds: 90, token: 'a'.repeat(80) }, teacherUser),
      ).rejects.toThrow(ConflictException)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('arms the end checkpoint with zero grace and an expiry-based auto-end deadline', async () => {
      const session = onlineSession({ isActive: true, startQrToken: 'start-token' })
      prisma.session.findUnique.mockResolvedValue(session)
      mockedVerifyQRToken.mockReturnValue(
        onlinePayload({ checkpoint: 'end', pinRequired: false, pinHash: undefined, gracePeriodMinutes: 0 }) as never,
      )
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...session, endQrToken: 'end-token' }),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await service.activate('sess-1', { checkpoint: 'end', validitySeconds: 90, token: 'a'.repeat(80) }, teacherUser)

      const claim = tx.session.updateMany.mock.calls[0][0]
      expect(claim.where).toEqual({
        id: 'sess-1',
        mode: 'online',
        isActive: true,
        endedAt: null,
        endQrToken: null,
      })
      expect(claim.data.endGraceMinutes).toBe(0)
      expect(claim.data.endPinHash).toBeNull()
      expect(claim.data.autoEndAt).toEqual(claim.data.endTokenExpiresAt)
    })

    it('refuses regeneration once the checkpoint window is closed', async () => {
      prisma.session.findUnique.mockResolvedValue(
        onlineSession({
          isActive: true,
          startQrToken: 'old-token',
          startTokenExpiresAt: new Date(Date.now() - 30 * 60_000),
          startQrGeneratedAt: new Date(Date.now() - 40 * 60_000),
        }),
      )
      mockedVerifyQRToken.mockReturnValue(onlinePayload() as never)

      await expect(service.activate('sess-1', { ...onlineDto, regenerate: true }, teacherUser)).rejects.toThrow(
        'regenerate is no longer possible',
      )
    })
  })

  describe('activate — teacher location gate (V4)', () => {
    function inPersonTxHarness() {
      const session = makeSession({ isActive: false })
      // First read: the activate() pre-gate lookup. Second read: the
      // post-activation cache publish re-check (must observe the active row).
      prisma.session.findUnique
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce({ ...session, isActive: true, qrToken: 't-token' })
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...session, isActive: true }),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      mockedVerifyQRToken.mockReturnValue(validPayloadForSession())
      return { session, tx }
    }

    // In-person token shape: legacy payload (validityMinutes path), issued now.
    function validPayloadForSession(overrides: Record<string, unknown> = {}): any {
      return {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        teacherId: 'teacher-1',
        issuedAt: Date.now(),
        validityMinutes: 10,
        gracePeriodMinutes: 5,
        mode: undefined,
        checkpoint: undefined,
        pinRequired: false,
        ...overrides,
      }
    }

    it('plans the gate only for in-person activations: online arms never consult a location', async () => {
      const session = makeSession({ isActive: false, mode: 'online' })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const onlineTx: any = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...session, isActive: true, startQrToken: 't-online-arm' }),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(onlineTx))
      mockedDecodePinHash.mockReturnValue({ salt: 's', digest: 'd', iterations: 1, format: 'p1' } as never)
      mockedVerifyQRToken.mockReturnValue(
        validPayloadForSession({
          mode: 'online',
          checkpoint: 'start',
          validitySeconds: 120,
          gracePeriodMinutes: 5,
          pinRequired: false,
          pinHash: undefined,
        }),
      )

      await service.activate(
        'sess-1',
        {
          token: 't-online-arm',
          checkpoint: 'start',
          validitySeconds: 120,
          gracePeriodMinutes: 5,
          latitude: -50,
          longitude: -100,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )

      // The gate is mode-gated: an off-campus coordinate never rejected the
      // online arm (RA 10173) and no audit row was ever written.
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('activates silently when the teacher fix is inside the tolerance floor', async () => {
      inPersonTxHarness()
      mockedHaversineDistance.mockReturnValue(20)

      await service.activate(
        'sess-1',
        {
          token: 't-in-person-inside',
          validityMinutes: 10,
          gracePeriodMinutes: 5,
          latitude: 14.6,
          longitude: 121,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: true }),
        expect.anything(),
      )
    })

    it('rejects an off-campus fix with a typed 409 before claiming the session', async () => {
      inPersonTxHarness()
      mockedHaversineDistance.mockReturnValue(50_000)

      const promise = service.activate(
        'sess-1',
        {
          token: 't-in-person-away',
          validityMinutes: 10,
          gracePeriodMinutes: 5,
          latitude: 14.0,
          longitude: 120.5,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )
      await expect(promise).rejects.toThrow(ConflictException)
      const error = (await promise.catch((caught: { getResponse?: () => unknown }) => caught)) as {
        getResponse?: () => unknown
      }
      expect(error.getResponse?.()).toMatchObject({
        code: 'teacher_location_outside_geofence',
        distanceMeters: 50_000,
        allowedDistanceMeters: 150,
        canRequestOverride: true,
      })
      expect(prisma.session.updateMany).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled()
    })

    it('honors a confirmed override, activates, and writes an audit row (fail-open)', async () => {
      inPersonTxHarness()
      mockedHaversineDistance.mockReturnValue(50_000)

      await service.activate(
        'sess-1',
        {
          token: 't-in-person-override',
          validityMinutes: 10,
          gracePeriodMinutes: 5,
          latitude: 14.0,
          longitude: 120.5,
          overrideTeacherLocation: true,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )

      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: true }),
        expect.anything(),
      )
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'teacher-1',
          action: 'session.activation_override',
          entityType: 'session',
          entityId: 'sess-1',
          metadata: expect.objectContaining({
            distanceMeters: 50_000,
            allowedDistanceMeters: 150,
            override: true,
          }),
        }),
      })
    })

    it('still activates when the audit insert fails (fail-open audit policy)', async () => {
      inPersonTxHarness()
      mockedHaversineDistance.mockReturnValue(50_000)
      prisma.auditLog.create.mockRejectedValueOnce(new Error('audit table unavailable'))

      await service.activate(
        'sess-1',
        {
          token: 't-in-person-audit-fail',
          validityMinutes: 10,
          gracePeriodMinutes: 5,
          latitude: 14.0,
          longitude: 120.5,
          overrideTeacherLocation: true,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )

      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: true }),
        expect.anything(),
      )
    })

    it('uses max(geofence radius, tolerance) so large-radius rooms never false-flag', async () => {
      // radius 300 ⇒ allowed 300; a 200 m fix is inside.
      const session = makeSession({ isActive: false, geofenceRadiusMeters: 300 })
      prisma.session.findUnique
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce({ ...session, isActive: true, qrToken: 't-token' })
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...session, isActive: true }),
        },
        enrollment: { findMany: jest.fn().mockResolvedValue([]) },
        attendanceRecord: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      mockedVerifyQRToken.mockReturnValue(validPayloadForSession())
      mockedHaversineDistance.mockReturnValue(200)

      await service.activate(
        'sess-1',
        {
          token: 't-in-person-large-room',
          validityMinutes: 10,
          gracePeriodMinutes: 5,
          latitude: 14.6,
          longitude: 121,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )

      expect(redis.setJson).toHaveBeenCalled()
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('skips the gate entirely when the activation carries no coordinates', async () => {
      inPersonTxHarness()
      mockedHaversineDistance.mockReturnValue(50_000)

      await service.activate(
        'sess-1',
        {
          token: 't-in-person-nofix',
          validityMinutes: 10,
          gracePeriodMinutes: 5,
        } as unknown as ActivateSessionDto,
        teacherUser,
      )

      // Absent fix = unchanged behavior (offline activation path).
      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: true }),
        expect.anything(),
      )
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })
  })

  describe('end', () => {
    it('throws NotFoundException when session missing', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(service.end('missing', teacherUser)).rejects.toThrow(NotFoundException)
    })

    it('forbids teacher who does not own the section', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other', subject: { name: 'CS 101' } })
      await expect(service.end('sess-1', teacherUser)).rejects.toThrow(ForbiddenException)
    })

    it('ends session, marks pending records absent, deletes redis cache', async () => {
      const session = makeSession({ isActive: true })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const tx = {
        attendanceRecord: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ studentId: 'stu-1' }, { studentId: 'stu-2' }, { studentId: 'stu-3' }]),
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...session, isActive: false, endedAt: new Date() }),
        },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })

      const result = await service.end('sess-1', teacherUser)
      expect(tx.attendanceRecord.updateMany.mock.calls[0][0]?.where).toEqual({
        sessionId: 'sess-1',
        status: 'pending',
      })
      expect(tx.attendanceRecord.updateMany.mock.calls[0][0]?.data.status).toBe('absent')
      expect(tx.session.updateMany.mock.calls[0][0]?.where).toEqual({ id: 'sess-1', isActive: true })
      expect(realtime.emitSessionState).toHaveBeenCalledWith(expect.anything(), 'ended')
      expect(redis.delete).toHaveBeenCalledWith('active-session:sess-1')
      expect(result.isActive).toBe(false)
    })

    it('resolves never-armed online ends to check-in credit instead of missed_checkout (V1)', async () => {
      const session = makeSession({ mode: 'online', isActive: true, startQrToken: 's-tok' })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([
            { studentId: 'stu-1', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' },
            { studentId: 'stu-2', checkInToken: null, checkOutToken: null, checkInStatus: null },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })

      await service.end('sess-1', teacherUser)

      const updates = tx.attendanceRecord.updateMany.mock.calls.map((call: any[]) => call[0])
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: expect.objectContaining({ sessionId: 'sess-1', studentId: { in: ['stu-1'] } }),
            data: expect.objectContaining({ status: 'present' }),
          }),
          expect.objectContaining({
            where: expect.objectContaining({ sessionId: 'sess-1', studentId: { in: ['stu-2'] } }),
            data: expect.objectContaining({ status: 'absent' }),
          }),
        ]),
      )
      // The derived endArmed flag must survive into the resolver: present rows
      // keep the leg value even though the claim nulls the stored token.
      const present = updates.find((update: any) => update.data.status === 'present')
      expect(Object.keys(present.where)).not.toContain('checkOutToken')
      expect(updates.some((update: any) => update.data.notes === 'missed_checkout')).toBe(false)
    })

    it('keeps the incomplete penalty when the teacher did arm the end checkpoint', async () => {
      const session = makeSession({ mode: 'online', isActive: true, endQrToken: 'e-tok', startQrToken: 's-tok' })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        attendanceRecord: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { studentId: 'stu-1', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' },
            ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })

      await service.end('sess-1', teacherUser)

      expect(tx.attendanceRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ studentId: { in: ['stu-1'] }, checkOutToken: null }),
          data: expect.objectContaining({ status: 'incomplete', notes: 'missed_checkout' }),
        }),
      )
    })

    it('throws ConflictException when session is not active (optimistic concurrency guard)', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ isActive: false }))
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const tx = {
        attendanceRecord: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: jest.fn(),
        },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      await expect(service.end('sess-1', teacherUser)).rejects.toThrow(ConflictException)
      expect(redis.delete).not.toHaveBeenCalled()
    })

    it('republishes the ended state to the cache when the cache delete fails', async () => {
      const session = makeSession({ isActive: true })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
      }
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      redis.delete.mockRejectedValueOnce(new Error('redis unavailable'))

      const result = await service.end('sess-1', teacherUser)
      expect(result.isActive).toBe(false)
      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: false, qrToken: null }),
        300,
      )
    })

    it('republishes the ended state when the Redis wrapper reports disconnection', async () => {
      const session = makeSession({ isActive: true })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      redis.delete.mockResolvedValue(false)

      await service.end('sess-1', teacherUser)

      expect(redis.setJson).toHaveBeenCalledWith(
        'active-session:sess-1',
        expect.objectContaining({ isActive: false, qrToken: null }),
        300,
      )
    })

    it('notifies only students whose pending records are marked absent', async () => {
      const session = makeSession({ isActive: true })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([{ studentId: 'stu-1' }, { studentId: 'stu-2' }]),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const notifications = { notifyAttendanceAbsent: jest.fn().mockResolvedValue(true) }
      const serviceWithNotifications = new SessionsService(
        prisma as never,
        realtime as never,
        redis as never,
        notifications as never,
      )

      await serviceWithNotifications.end('sess-1', teacherUser)

      expect(tx.attendanceRecord.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess-1', status: 'pending' },
        select: { studentId: true },
      })
      expect(notifications.notifyAttendanceAbsent).toHaveBeenCalledTimes(2)
      expect(notifications.notifyAttendanceAbsent).toHaveBeenCalledWith('stu-1', {
        sessionId: 'sess-1',
        subjectName: 'CS 101',
        date: '2026-07-14',
      })
    })
  })

  describe('autoEndExpiredSessions', () => {
    it('skips the tick when another replica owns the lock', async () => {
      redis.acquireLock.mockResolvedValue(null)

      await service.autoEndExpiredSessions()

      expect(prisma.session.findMany).not.toHaveBeenCalled()
      expect(redis.releaseLock).not.toHaveBeenCalled()
    })

    it('mutates attendance and emits side effects only after winning the observed session claim', async () => {
      const autoEndAt = new Date(Date.now() - 10 * 60_000)
      const session = makeSession({ isActive: true, autoEndAt })
      prisma.session.findMany.mockResolvedValue([session])
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([{ studentId: 'stu-1' }, { studentId: 'stu-2' }]),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await service.autoEndExpiredSessions()

      expect(tx.session.updateMany.mock.calls[0][0].where).toEqual({
        id: 'sess-1',
        isActive: true,
        autoEndAt,
      })
      expect(tx.attendanceRecord.updateMany).toHaveBeenCalledTimes(1)
      expect(realtime.emitSessionState).toHaveBeenCalledWith(ended, 'ended')
      expect(redis.delete).toHaveBeenCalledWith('active-session:sess-1')
      expect(redis.releaseLock).toHaveBeenCalledWith('sessions:auto-end-expired', 'owner-token')
    })

    it('does not mutate attendance or emit side effects when the observed session claim loses a race', async () => {
      const autoEndAt = new Date(Date.now() - 10 * 60_000)
      prisma.session.findMany.mockResolvedValue([makeSession({ isActive: true, autoEndAt })])
      const tx = {
        session: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() },
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn(),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await service.autoEndExpiredSessions()

      expect(tx.attendanceRecord.updateMany).not.toHaveBeenCalled()
      expect(tx.session.findUniqueOrThrow).not.toHaveBeenCalled()
      expect(realtime.emitSessionState).not.toHaveBeenCalled()
      expect(redis.delete).not.toHaveBeenCalled()
    })

    it('notifies students auto-marked absent without ever touching excused records', async () => {
      const autoEndAt = new Date(Date.now() - 10 * 60_000)
      const session = makeSession({ isActive: true, autoEndAt })
      prisma.session.findMany.mockResolvedValue([session])
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
        attendanceRecord: {
          findMany: jest.fn().mockResolvedValue([{ studentId: 'stu-1' }]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
      const notifications = { notifyAttendanceAbsent: jest.fn().mockResolvedValue(true) }
      const serviceWithNotifications = new SessionsService(
        prisma as never,
        realtime as never,
        redis as never,
        notifications as never,
      )

      await serviceWithNotifications.autoEndExpiredSessions()

      expect(tx.attendanceRecord.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 'sess-1', status: 'pending' },
        data: { status: 'absent', manuallySet: false },
      })
      expect(notifications.notifyAttendanceAbsent).toHaveBeenCalledWith('stu-1', {
        sessionId: 'sess-1',
        subjectName: 'CS 101',
        date: '2026-07-14',
      })
    })

    it('auto-end resolves an online class without an armed end checkpoint by check-in status (V1)', async () => {
      const autoEndAt = new Date(Date.now() - 10 * 60_000)
      const session = makeSession({ mode: 'online', isActive: true, autoEndAt, startQrToken: 's-tok' })
      prisma.session.findMany.mockResolvedValue([session])
      const ended = { ...session, isActive: false, endedAt: new Date() }
      const tx = {
        session: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
        },
        attendanceRecord: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { studentId: 'stu-1', checkInToken: 't1', checkOutToken: null, checkInStatus: 'present' },
            ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))

      await service.autoEndExpiredSessions()

      // The start-arm auto-end deadline fired with Checkpoint 2 never opened:
      // the checked-in student keeps present (fixture endArmed=false path).
      expect(tx.attendanceRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sessionId: 'sess-1', studentId: { in: ['stu-1'] } }),
          data: expect.objectContaining({ status: 'present' }),
        }),
      )
    })
  })

  describe('F1 session:finale broadcast', () => {
    const finaleTx = (ended: unknown, students = 2) => ({
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(ended),
      },
      attendanceRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue(Array.from({ length: students }, (_, index) => ({ studentId: `stu-${index + 1}` }))),
        updateMany: jest.fn().mockResolvedValue({ count: students }),
      },
    })

    const makeEndMocks = (session: unknown, ended: unknown) => {
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.$transaction.mockImplementation(async (callback: any) => callback(finaleTx(ended)))
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
    }

    it('emits session:finale from end() with resolved counts and roster capacity', async () => {
      const session = makeSession({ isActive: true })
      const ended = { ...session, isActive: false, endedAt: new Date('2026-11-02T03:30:00.000Z') }
      makeEndMocks(session, ended)
      prisma.attendanceRecord.groupBy.mockResolvedValue([
        { status: 'present', _count: { _all: 2 } },
        { status: 'late', _count: { _all: 1 } },
        { status: 'absent', _count: { _all: 1 } },
        { status: 'excused', _count: { _all: 0 } },
        { status: 'incomplete', _count: { _all: 0 } },
      ])

      await service.end('sess-1', teacherUser)

      expect(realtime.emitSessionFinale).toHaveBeenCalledWith(
        { id: 'sess-1' },
        {
          sessionId: 'sess-1',
          endedAt: ended.endedAt.toISOString(),
          counts: { present: 2, late: 1, absent: 1, excused: 0, incomplete: 0, disputed: 0, pending: 0 },
          capacity: 4,
        },
      )
      expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['status'], where: { sessionId: 'sess-1' } }),
      )
      expect(prisma.enrollment.count).toHaveBeenCalledWith({ where: { sectionId: 'sec-1' } })
    })

    it('emits session:finale from the auto-end cron only when the claim wins', async () => {
      const autoEndAt = new Date(Date.now() - 10 * 60_000)
      const session = makeSession({ isActive: true, autoEndAt })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      prisma.session.findMany.mockResolvedValue([session])
      prisma.$transaction.mockImplementation(async (callback: any) => callback(finaleTx(ended)))
      prisma.attendanceRecord.groupBy.mockResolvedValue([{ status: 'absent', _count: { _all: 2 } }])

      await service.autoEndExpiredSessions()

      expect(realtime.emitSessionFinale).toHaveBeenCalledWith(
        { id: 'sess-1' },
        expect.objectContaining({
          sessionId: 'sess-1',
          counts: { present: 0, late: 0, absent: 2, excused: 0, incomplete: 0, disputed: 0, pending: 0 },
          capacity: 4,
        }),
      )

      // A lost claim never broadcasts.
      realtime.emitSessionFinale.mockClear()
      prisma.attendanceRecord.groupBy.mockClear()
      const lostTx = {
        session: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() },
        attendanceRecord: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => callback(lostTx))

      await service.autoEndExpiredSessions()

      expect(realtime.emitSessionFinale).not.toHaveBeenCalled()
    })

    it('does not fail the end() flow when the finale metrics read is unavailable', async () => {
      const session = makeSession({ isActive: true })
      const ended = { ...session, isActive: false, endedAt: new Date() }
      makeEndMocks(session, ended)
      prisma.attendanceRecord.groupBy.mockRejectedValue(new Error('db busy'))

      const result = await service.end('sess-1', teacherUser)

      expect(result.isActive).toBe(false)
      expect(realtime.emitSessionState).toHaveBeenCalledWith(ended, 'ended')
      expect(realtime.emitSessionFinale).not.toHaveBeenCalled()
    })
  })

  describe('createBulk', () => {
    const dto: CreateBulkSessionsDto = {
      sectionId: 'sec-1',
      subjectName: 'CS 101',
      startDate: '2026-07-13',
      endDate: '2026-07-15',
      daysOfWeek: ['Mon'],
      startTime: '10:00',
      endTime: '11:00',
      qrValidityMinutes: 10,
      gracePeriodMinutes: 5,
      geofence: { latitude: 14.6, longitude: 121.0, radiusMeters: 50 },
    }

    it('throws BadRequestException when end date precedes start date', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      await expect(
        service.createBulk({ ...dto, startDate: '2026-07-15', endDate: '2026-07-13' }, teacherUser),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException for impossible bulk calendar dates', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      await expect(service.createBulk({ ...dto, startDate: '2026-02-30' }, teacherUser)).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.session.findMany).not.toHaveBeenCalled()
    })

    it('throws BadRequestException when date range exceeds 366 days', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      await expect(
        service.createBulk(
          { ...dto, startDate: '2026-01-01', endDate: '2028-01-01', daysOfWeek: ['Mon'] },
          teacherUser,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when no dates match selected daysOfWeek', async () => {
      // 2026-07-13..2026-07-15 spans Mon–Wed; asking for Sun yields no dates
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.session.findMany.mockResolvedValue([])
      await expect(service.createBulk({ ...dto, daysOfWeek: ['Sun'] }, teacherUser)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws ConflictException when sessions already exist on matching dates', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.session.findMany.mockResolvedValue([{ date: '2026-07-13' }])
      await expect(service.createBulk(dto, teacherUser)).rejects.toThrow(ConflictException)
    })

    it('creates one session per matching date and emits state per session', async () => {
      // Range Sun–Tue contains exactly one Monday (2026-07-14)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
      prisma.session.findMany.mockResolvedValue([])
      const sessions = [makeSession({ id: 's1', date: '2026-07-14' })]
      prisma.$transaction.mockImplementation(async (ops: any) => Promise.all(ops.map((op: any) => op)))
      prisma.session.create.mockResolvedValueOnce(sessions[0])
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })

      const result = await service.createBulk(dto, teacherUser)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
      expect(realtime.emitSessionState).toHaveBeenCalledTimes(1)
    })

    it('forbids teacher who does not own the section', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other', subject: { name: 'CS 101' } })
      await expect(service.createBulk(dto, teacherUser)).rejects.toThrow(ForbiddenException)
    })

    describe('slot-aware bulk creation (SL2)', () => {
      // 2026-07-13 is a Monday; the week runs through Sunday 2026-07-19.
      const weekRange = { startDate: '2026-07-13', endDate: '2026-07-19' }

      function mockSuccessfulCreation() {
        prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1', subject: { name: 'CS 101' } })
        prisma.session.findMany.mockResolvedValue([])
        prisma.$transaction.mockImplementation(async (ops: any) => Promise.all(ops.map((op: any) => op)))
        prisma.session.create.mockImplementation(async ({ data }: any) => makeSession(data))
        prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      }

      it('sweeps each slot weekday with its own start/end times', async () => {
        mockSuccessfulCreation()

        const result = await service.createBulk(
          {
            sectionId: 'sec-1',
            subjectName: 'CS 101',
            ...weekRange,
            geofence: dto.geofence,
            slots: [
              { day: 'Mon', startTime: '08:00', endTime: '10:30' },
              { day: 'Wed', startTime: '09:00', endTime: '12:30' },
            ],
          },
          teacherUser,
        )

        expect(result).toHaveLength(2)
        expect(prisma.session.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ date: '2026-07-13', startTime: '08:00', endTime: '10:30' }),
        })
        expect(prisma.session.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ date: '2026-07-15', startTime: '09:00', endTime: '12:30' }),
        })
      })

      it('lets slots win over contradictory legacy fields', async () => {
        mockSuccessfulCreation()

        const result = await service.createBulk(
          {
            sectionId: 'sec-1',
            subjectName: 'CS 101',
            ...weekRange,
            geofence: dto.geofence,
            daysOfWeek: ['Tue'],
            startTime: '13:00',
            endTime: '14:00',
            slots: [{ day: 'Mon', startTime: '08:00', endTime: '10:30' }],
          },
          teacherUser,
        )

        expect(result).toHaveLength(1)
        expect(prisma.session.findMany).toHaveBeenCalledWith({
          where: { sectionId: 'sec-1', date: { in: ['2026-07-13'] } },
          select: { date: true },
        })
        expect(prisma.session.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ date: '2026-07-13', startTime: '08:00', endTime: '10:30' }),
        })
      })

      it('rejects a payload with neither slots nor the legacy fields', async () => {
        await expect(
          service.createBulk(
            {
              sectionId: 'sec-1',
              subjectName: 'CS 101',
              ...weekRange,
              geofence: dto.geofence,
            },
            teacherUser,
          ),
        ).rejects.toThrow('Provide either class slots or daysOfWeek with startTime and endTime')
        expect(prisma.section.findUnique).not.toHaveBeenCalled()
      })

      it('rejects a slot whose end time is not after its start time', async () => {
        await expect(
          service.createBulk(
            {
              sectionId: 'sec-1',
              subjectName: 'CS 101',
              ...weekRange,
              geofence: dto.geofence,
              slots: [{ day: 'Mon', startTime: '11:00', endTime: '10:00' }],
            },
            teacherUser,
          ),
        ).rejects.toThrow('endTime must be after startTime')
        expect(prisma.section.findUnique).not.toHaveBeenCalled()
      })

      it('deduplicates identical slot rows within the request', async () => {
        mockSuccessfulCreation()

        const result = await service.createBulk(
          {
            sectionId: 'sec-1',
            subjectName: 'CS 101',
            ...weekRange,
            geofence: dto.geofence,
            slots: [
              { day: 'Mon', startTime: '08:00', endTime: '10:30' },
              { day: 'Mon', startTime: '08:00', endTime: '10:30' },
            ],
          },
          teacherUser,
        )

        expect(result).toHaveLength(1)
        expect(prisma.session.create).toHaveBeenCalledTimes(1)
      })
    })
  })
})
