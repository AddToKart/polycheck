import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DisputesService } from './disputes.service'
import type { RequestUser } from '../auth/authenticated-principal'

interface MockPrisma {
  attendanceRecord: {
    findMany: jest.Mock
    findUnique: jest.Mock
    update: jest.Mock
  }
}

describe('DisputesService', () => {
  let service: DisputesService
  let prisma: MockPrisma

  const studentUser: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
  const teacherUser: RequestUser = { id: 'teacher-1', role: 'teacher' }
  const adminUser: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

  const baseRecord = {
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'stu-1',
    studentName: 'Jane Doe',
    status: 'disputed' as const,
    latitude: 14.6,
    longitude: 121.0,
    disputeReason: 'invalid_signature',
    disputeDescription: 'some description',
    disputeResolved: false,
    updatedAt: new Date('2026-07-01'),
  }

  beforeEach(async () => {
    prisma = {
      attendanceRecord: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    const moduleRef = await Test.createTestingModule({
      providers: [DisputesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = moduleRef.get(DisputesService)
  })

  describe('findAll', () => {
    it('filters pending disputes (disputeResolved=false, status=disputed)', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([baseRecord])
      const result = await service.findAll(teacherUser, undefined, 'pending')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.status).toBe('disputed')
      expect(where.disputeResolved).toBe(false)
      expect(result[0]).toMatchObject({ id: 'rec-1' })
      expect(result[0].coordinates).toEqual({ latitude: 14.6, longitude: 121.0 })
    })

    it('filters resolved disputes (disputeResolved=true)', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(teacherUser, undefined, 'resolved')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.disputeResolved).toBe(true)
      expect(where.status).toBeUndefined()
    })

    it('all filter sets OR clause for disputed or disputeResolved', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(teacherUser, undefined, 'all')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.OR).toEqual([{ status: 'disputed' }, { disputeResolved: true }])
    })

    it('scopes by studentId for student role', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(studentUser, undefined, 'pending')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.studentId).toBe('stu-1')
      expect(where.session).toBeUndefined()
    })

    it('scopes by session.teacherId for teacher role', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(teacherUser, undefined, 'pending')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.session).toEqual({ teacherId: 'teacher-1' })
      expect(where.studentId).toBeUndefined()
    })

    it('super_admin sees no scope filter', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(adminUser, undefined, 'pending')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.studentId).toBeUndefined()
      expect(where.session).toBeUndefined()
    })

    it('applies sessionId filter when provided', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(teacherUser, 'sess-9', 'pending')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.sessionId).toBe('sess-9')
    })

    it('applies insensitive studentName search when search provided', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([])
      await service.findAll(teacherUser, undefined, 'pending', 'Jane')
      const where = prisma.attendanceRecord.findMany.mock.calls[0][0]?.where
      expect(where.studentName).toEqual({ contains: 'Jane', mode: 'insensitive' })
    })
  })

  describe('submit', () => {
    it('allows student to submit dispute for own attendance record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({ ...baseRecord, status: 'absent', disputeResolved: true })
      const updated = { ...baseRecord, status: 'disputed', disputeReason: 'gps_inaccuracy' }
      prisma.attendanceRecord.update.mockResolvedValue(updated)
      const result = await service.submit(studentUser, {
        recordId: 'rec-1',
        reason: 'gps_inaccuracy',
        description: 'GPS jumped',
      })
      const updateArgs = prisma.attendanceRecord.update.mock.calls[0][0]
      expect(updateArgs.where.id).toBe('rec-1')
      expect(updateArgs.data.status).toBe('disputed')
      expect(updateArgs.data.disputeResolved).toBe(false)
      expect(result.coordinates).toEqual({ latitude: 14.6, longitude: 121.0 })
    })

    it('throws ForbiddenException when student disputes another student record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({ ...baseRecord, studentId: 'stu-2' })
      await expect(
        service.submit(studentUser, {
          recordId: 'rec-1',
          reason: 'gps_inaccuracy',
          description: 'x',
        }),
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when record does not exist', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null)
      await expect(
        service.submit(studentUser, {
          recordId: 'missing',
          reason: 'gps_inaccuracy',
          description: 'x',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('resolve', () => {
    it('accept resolution sets status to present and disputeResolved true', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...baseRecord,
        session: { teacherId: 'teacher-1' },
      })
      prisma.attendanceRecord.update.mockResolvedValue({ ...baseRecord, status: 'present', disputeResolved: true })
      const result = await service.resolve(teacherUser, 'rec-1', 'accept')
      const args = prisma.attendanceRecord.update.mock.calls[0][0]
      expect(args.data.status).toBe('present')
      expect(args.data.disputeResolved).toBe(true)
      expect(args.data.manuallySet).toBe(false)
      expect(result.status).toBe('present')
    })

    it('reject resolution sets status to absent and disputeResolved true', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...baseRecord,
        session: { teacherId: 'teacher-1' },
      })
      prisma.attendanceRecord.update.mockResolvedValue({ ...baseRecord, status: 'absent', disputeResolved: true })
      await service.resolve(teacherUser, 'rec-1', 'reject')
      const args = prisma.attendanceRecord.update.mock.calls[0][0]
      expect(args.data.status).toBe('absent')
      expect(args.data.disputeResolved).toBe(true)
    })

    it('override resolution applies newStatus and sets manuallySet true', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...baseRecord,
        session: { teacherId: 'teacher-1' },
      })
      prisma.attendanceRecord.update.mockResolvedValue({ ...baseRecord, status: 'late', disputeResolved: true })
      await service.resolve(teacherUser, 'rec-1', 'override', 'late')
      const args = prisma.attendanceRecord.update.mock.calls[0][0]
      expect(args.data.status).toBe('late')
      expect(args.data.manuallySet).toBe(true)
      expect(args.data.disputeResolved).toBe(true)
    })

    it('override without newStatus throws ForbiddenException', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...baseRecord,
        session: { teacherId: 'teacher-1' },
      })
      await expect(service.resolve(teacherUser, 'rec-1', 'override')).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when teacher is not the session owner', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue({
        ...baseRecord,
        session: { teacherId: 'teacher-2' },
      })
      await expect(service.resolve(teacherUser, 'rec-1', 'accept')).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('forbids super_admin from resolving day-to-day disputes', async () => {
      await expect(service.resolve(adminUser, 'rec-1', 'accept')).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.findUnique).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when record does not exist', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValue(null)
      await expect(service.resolve(teacherUser, 'missing', 'accept')).rejects.toThrow(NotFoundException)
    })
  })
})
