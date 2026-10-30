import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common'
import { AttendanceService } from './attendance.service'
import type { RequestUser } from '../auth/authenticated-principal'

const student: RequestUser = { id: 'stu-1', role: 'student', studentId: 'S-1' }
const otherStudent: RequestUser = { id: 'stu-2', role: 'student', studentId: 'S-2' }
const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const otherTeacher: RequestUser = { id: 'teacher-2', role: 'teacher' }
const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

function baseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'stu-1',
    studentName: 'Jane Doe',
    status: 'absent',
    latitude: 14.6,
    longitude: 121.0,
    excuseStatus: null,
    excuseReason: null,
    excuseDescription: null,
    excuseEvidencePath: null,
    excuseReviewedBy: null,
    excuseReviewedAt: null,
    excuseReviewNote: null,
    session: { teacherId: 'teacher-1', subjectName: 'CS 101', date: '2026-10-27' },
    ...overrides,
  }
}

function makeService() {
  const prisma = {
    attendanceRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  }
  const redis = { consumeRateLimit: jest.fn().mockResolvedValue(true) }
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) }
  const storage = { store: jest.fn().mockResolvedValue('/uploads/excuse.png'), remove: jest.fn() }
  const config = { get: jest.fn().mockReturnValue(5_000_000) }
  const service = new AttendanceService(
    prisma as never,
    { emitAttendanceUpdated: jest.fn(), emitSessionState: jest.fn() } as never,
    redis as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    storage as never,
    config as never,
  )
  return { service, prisma, redis, notifications, storage }
}

describe('AttendanceService excuse workflow', () => {
  describe('requestExcuse', () => {
    it('records a student-owned request and notifies the section teacher', async () => {
      const { service, prisma, notifications } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord())
      prisma.attendanceRecord.update.mockResolvedValue(
        baseRecord({ excuseStatus: 'requested', excuseReason: 'medical', excuseDescription: 'Fever' }),
      )

      const result = await service.requestExcuse(student, 'rec-1', {
        reason: 'medical',
        description: '  Fever  ',
      })

      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          excuseStatus: 'requested',
          excuseReason: 'medical',
          excuseDescription: 'Fever',
          excuseReviewedBy: null,
          excuseReviewedAt: null,
          excuseReviewNote: null,
        }),
      })
      expect(notifications.notify).toHaveBeenCalledWith(
        'teacher-1',
        expect.objectContaining({ type: 'excuse_requested', link: '/faculty/excuses' }),
      )
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'attendance.excuse.requested', entityId: 'rec-1' }),
      })
      expect(result.coordinates).toEqual({ latitude: 14.6, longitude: 121.0 })
    })

    it('rejects a second open request for the same record', async () => {
      const { service, prisma } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord({ excuseStatus: 'requested' }))

      await expect(
        service.requestExcuse(student, 'rec-1', { reason: 'medical', description: 'Fever' }),
      ).rejects.toThrow(ConflictException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('rejects requests for another student record', async () => {
      const { service, prisma } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord())

      await expect(
        service.requestExcuse(otherStudent, 'rec-1', { reason: 'medical', description: 'Fever' }),
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('only accepts absent or late records', async () => {
      const { service, prisma } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord({ status: 'present' }))

      await expect(
        service.requestExcuse(student, 'rec-1', { reason: 'medical', description: 'Fever' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('stores optional evidence and removes a replaced file', async () => {
      const { service, prisma, storage } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        baseRecord({ excuseStatus: 'rejected', excuseEvidencePath: '/uploads/old.png' }),
      )
      prisma.attendanceRecord.update.mockResolvedValue(baseRecord({ excuseStatus: 'requested' }))

      await service.requestExcuse(student, 'rec-1', {
        reason: 'medical',
        description: 'Fever',
        evidenceData: 'data:image/png;base64,iVBORw0KGgo=',
      })

      expect(storage.store).toHaveBeenCalledWith(expect.any(Buffer), 'png', 'image/png')
      expect(prisma.attendanceRecord.update.mock.calls[0][0].data.excuseEvidencePath).toBe('/uploads/excuse.png')
      expect(storage.remove).toHaveBeenCalledWith('/uploads/old.png')
    })

    it('rate limits abuse per student', async () => {
      const { service, prisma, redis } = makeService()
      redis.consumeRateLimit.mockResolvedValue(false)

      await expect(
        service.requestExcuse(student, 'rec-1', { reason: 'medical', description: 'Fever' }),
      ).rejects.toThrow(HttpException)
      expect(prisma.attendanceRecord.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('listExcuses', () => {
    it('scopes teacher queries to their own sessions', async () => {
      const { service, prisma } = makeService()

      await service.listExcuses(teacher, { status: 'requested', sectionId: 'sec-1' })

      const where = prisma.attendanceRecord.findMany.mock.calls[0][0].where
      expect(where.AND[0]).toEqual({ session: { teacherId: 'teacher-1' } })
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { excuseStatus: { not: null } },
          { excuseStatus: 'requested' },
          { sectionId: 'sec-1' },
        ]),
      )
    })

    it('scopes super admin queries through the administrative scope', async () => {
      const { service, prisma } = makeService()
      const departmentAdmin: RequestUser = {
        id: 'admin-2',
        role: 'super_admin',
        scope: 'department',
        department: 'CCIS',
      }

      await service.listExcuses(departmentAdmin)

      const where = prisma.attendanceRecord.findMany.mock.calls[0][0].where
      expect(where.AND[0]).toEqual({ session: { section: { teacher: { department: 'CCIS' } } } })
    })

    it('forbids students from listing campus-wide excuses', async () => {
      const { service } = makeService()
      await expect(service.listExcuses(student)).rejects.toThrow(ForbiddenException)
    })

    it('rejects an inverted date range', async () => {
      const { service } = makeService()
      await expect(service.listExcuses(teacher, { startDate: '2026-10-28', endDate: '2026-10-27' })).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('decideExcuse', () => {
    it('approves a pending request, stamps the reviewer, and notifies the student', async () => {
      const { service, prisma, notifications } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(
        baseRecord({ excuseStatus: 'requested', excuseReason: 'medical' }),
      )
      prisma.attendanceRecord.update.mockResolvedValue(
        baseRecord({ status: 'excused', excuseStatus: 'approved', excuseReviewedBy: 'teacher-1' }),
      )

      const result = await service.decideExcuse(teacher, 'rec-1', { decision: 'approve', note: '  Valid slip  ' })

      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: 'excused',
          excuseStatus: 'approved',
          excuseReviewedBy: 'teacher-1',
          excuseReviewedAt: expect.any(Date),
          excuseReviewNote: 'Valid slip',
        }),
      })
      expect(notifications.notify).toHaveBeenCalledWith(
        'stu-1',
        expect.objectContaining({ type: 'excuse_decided', link: '/student/dashboard' }),
      )
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'attendance.excuse.approved' }),
      })
      expect(result.status).toBe('excused')
    })

    it('rejects without changing the original attendance status', async () => {
      const { service, prisma, notifications } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord({ excuseStatus: 'requested' }))
      prisma.attendanceRecord.update.mockResolvedValue(baseRecord({ excuseStatus: 'rejected' }))

      await service.decideExcuse(teacher, 'rec-1', { decision: 'reject' })

      const data = prisma.attendanceRecord.update.mock.calls[0][0].data
      expect(data).not.toHaveProperty('status')
      expect(data.excuseStatus).toBe('rejected')
      expect(notifications.notify).toHaveBeenCalledWith(
        'stu-1',
        expect.objectContaining({ type: 'excuse_decided', title: 'Excuse rejected' }),
      )
    })

    it('requires the session teacher and forbids super admins', async () => {
      const { service, prisma } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord({ excuseStatus: 'requested' }))

      await expect(service.decideExcuse(otherTeacher, 'rec-1', { decision: 'approve' })).rejects.toThrow(
        ForbiddenException,
      )
      await expect(service.decideExcuse(admin, 'rec-1', { decision: 'approve' })).rejects.toThrow(ForbiddenException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })

    it('only decides requests that are still pending', async () => {
      const { service, prisma } = makeService()
      prisma.attendanceRecord.findUnique.mockResolvedValue(baseRecord({ excuseStatus: 'approved' }))

      await expect(service.decideExcuse(teacher, 'rec-1', { decision: 'reject' })).rejects.toThrow(ConflictException)
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled()
    })
  })
})
