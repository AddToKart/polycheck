import { Test } from '@nestjs/testing'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../infrastructure/redis.service'
import { SessionsService } from './sessions.service'
import { AttendanceGateway } from '../realtime/attendance.gateway'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { ActivateSessionDto, CreateBulkSessionsDto, CreateSessionDto } from './dto/create-session.dto'

jest.mock('@polycheck/shared', () => ({
  verifyQRToken: jest.fn(),
}))

import { verifyQRToken } from '@polycheck/shared'

const mockedVerifyQRToken = verifyQRToken as jest.MockedFunction<typeof verifyQRToken>

const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }
const adminUser: RequestUser = { id: 'admin-1', role: 'super_admin' }

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
    qrValidityMinutes: 10,
    gracePeriodMinutes: 5,
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
      section: { findUnique: jest.fn() },
      enrollment: { findMany: jest.fn(), findUnique: jest.fn() },
      attendanceRecord: { createMany: jest.fn(), updateMany: jest.fn() },
      sectionRole: { findUnique: jest.fn() },
      sessionPermission: { findFirst: jest.fn() },
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
      expect(result.geofence.radiusMeters).toBe(50)
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
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.findOne('sess-1', studentUser)
      expect(result.id).toBe('sess-1')
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
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.session.create.mockResolvedValue(makeSession())
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.create(dto, teacherUser)
      const args = prisma.session.create.mock.calls[0][0]?.data
      expect(args.teacherId).toBe('teacher-1')
      expect(args.geofenceLatitude).toBe(14.6)
      expect(args.geofenceRadiusMeters).toBe(50)
      expect(args.geofence).toBeUndefined()
      expect(realtime.emitSessionState).toHaveBeenCalled()
      expect(result.teacherPublicKey).toBe('pk')
    })

    it('forbids teacher who does not own the section', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other' })
      await expect(service.create(dto, teacherUser)).rejects.toThrow(ForbiddenException)
    })

    it('throws NotFoundException when section does not exist', async () => {
      prisma.section.findUnique.mockResolvedValue(null)
      await expect(service.create(dto, teacherUser)).rejects.toThrow(NotFoundException)
    })

    it('allows student with president role and active session permission', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.sectionRole.findUnique.mockResolvedValue({ id: 'role-1' })
      prisma.sessionPermission.findFirst.mockResolvedValue({ id: 'perm-1' })
      prisma.session.create.mockResolvedValue(makeSession())
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      const result = await service.create(dto, studentUser)
      expect(prisma.session.create.mock.calls[0][0]?.data.teacherId).toBe('teacher-1')
      expect(result).toBeDefined()
    })

    it('forbids student without president role or permission', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.sectionRole.findUnique.mockResolvedValue(null)
      prisma.sessionPermission.findFirst.mockResolvedValue(null)
      await expect(service.create(dto, studentUser)).rejects.toThrow(ForbiddenException)
    })

    it('forbids student with role but inactive permission', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.sectionRole.findUnique.mockResolvedValue({ id: 'role-1' })
      prisma.sessionPermission.findFirst.mockResolvedValue(null)
      await expect(service.create(dto, studentUser)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('activate', () => {
    const dto: ActivateSessionDto = { validityMinutes: 10, token: 'a'.repeat(80) }
    const issuedAt = Date.now() - 1000

    it('throws NotFoundException when session missing', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(service.activate('missing', dto, teacherUser)).rejects.toThrow(NotFoundException)
    })

    it('forbids teacher who does not own the section', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other' })
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(ForbiddenException)
    })

    it('throws BadRequest when teacher has no signing key', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: null })
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequest when token signature is invalid', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.user.findUnique.mockResolvedValue({ teacherPublicKey: 'pk' })
      mockedVerifyQRToken.mockReturnValue(null)
      await expect(service.activate('sess-1', dto, teacherUser)).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequest when token does not match session', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
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
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
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

    it('activates session, seeds pending attendance records, caches, and emits state', async () => {
      const session = makeSession()
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
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
          update: jest.fn().mockResolvedValue({ ...session, isActive: true, qrToken: dto.token }),
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
      expect(tx.session.update).toHaveBeenCalled()
      expect(tx.attendanceRecord.createMany).toHaveBeenCalled()
      const createArgs = tx.attendanceRecord.createMany.mock.calls[0][0]?.data
      expect(createArgs[0].status).toBe('pending')
      expect(realtime.emitSessionState).toHaveBeenCalledWith(expect.anything(), 'activated')
      expect(redis.setJson).toHaveBeenCalled()
      expect(result.teacherPublicKey).toBe('pk')
    })
  })

  describe('end', () => {
    it('throws NotFoundException when session missing', async () => {
      prisma.session.findUnique.mockResolvedValue(null)
      await expect(service.end('missing', teacherUser)).rejects.toThrow(NotFoundException)
    })

    it('forbids teacher who does not own the section', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession())
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other' })
      await expect(service.end('sess-1', teacherUser)).rejects.toThrow(ForbiddenException)
    })

    it('ends session, marks pending records absent, deletes redis cache', async () => {
      const session = makeSession({ isActive: true })
      prisma.session.findUnique.mockResolvedValue(session)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      const tx = {
        attendanceRecord: {
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

    it('throws ConflictException when session is not active (optimistic concurrency guard)', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession({ isActive: false }))
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
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
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      await expect(
        service.createBulk({ ...dto, startDate: '2026-07-15', endDate: '2026-07-13' }, teacherUser),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when date range exceeds 366 days', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      await expect(
        service.createBulk(
          { ...dto, startDate: '2026-01-01', endDate: '2028-01-01', daysOfWeek: ['Mon'] },
          teacherUser,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when no dates match selected daysOfWeek', async () => {
      // 2026-07-13..2026-07-15 spans Mon–Wed; asking for Sun yields no dates
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.session.findMany.mockResolvedValue([])
      await expect(service.createBulk({ ...dto, daysOfWeek: ['Sun'] }, teacherUser)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws ConflictException when sessions already exist on matching dates', async () => {
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
      prisma.session.findMany.mockResolvedValue([{ date: '2026-07-13' }])
      await expect(service.createBulk(dto, teacherUser)).rejects.toThrow(ConflictException)
    })

    it('creates one session per matching date and emits state per session', async () => {
      // Range Sun–Tue contains exactly one Monday (2026-07-14)
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-1' })
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
      prisma.section.findUnique.mockResolvedValue({ teacherId: 'teacher-other' })
      await expect(service.createBulk(dto, teacherUser)).rejects.toThrow(ForbiddenException)
    })
  })
})
