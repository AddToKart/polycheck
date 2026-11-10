import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { classifyAtRiskRow } from './attendance-at-risk.service'
import { AttendanceReferralService } from './attendance-referral.service'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const headOfDept: RequestUser = { id: 'head-1', role: 'teacher', department: 'CCIS', isDepartmentHead: true }
const headOfOtherDept: RequestUser = { id: 'head-2', role: 'teacher', department: 'COE', isDepartmentHead: true }
const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const departmentAdmin: RequestUser = { id: 'admin-2', role: 'super_admin', scope: 'department', department: 'COE' }

const referralSection = {
  id: 'sec-1',
  section: '1-A',
  subject: { name: 'Software Engineering' },
  teacher: { id: 'teacher-1', fullName: 'Prof. Cruz', department: 'CCIS' },
}

function referralRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ref-1',
    studentId: 'stu-1',
    sectionId: 'sec-1',
    generatedById: 'teacher-1',
    status: 'generated',
    note: null,
    createdAt: new Date('2026-11-02T01:00:00.000Z'),
    updatedAt: new Date('2026-11-02T01:00:00.000Z'),
    student: { id: 'stu-1', studentId: '2023-0001', fullName: 'Juan Dela Cruz' },
    section: {
      section: '1-A',
      subject: { name: 'Software Engineering' },
      teacher: { id: 'teacher-1', fullName: 'Prof. Cruz', department: 'CCIS' },
    },
    generatedBy: { id: 'teacher-1', fullName: 'Prof. Cruz' },
    ...overrides,
  }
}

function classification(engineStatus: 'below_threshold' | 'at_risk' | 'on_track' | 'insufficient_data') {
  return {
    thresholdPercent: 75,
    present: 10,
    late: 2,
    absent: engineStatus === 'on_track' ? 1 : 8,
    countedSessions: 20,
    attendedSessions: 12,
    attendanceRate: 60,
    absencesBeforeBelowThreshold: 0,
    status: engineStatus,
  }
}

function makeService() {
  const prisma = {
    section: { findUnique: jest.fn().mockResolvedValue(referralSection), findFirst: jest.fn() },
    enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enr-1' }) },
    atRiskReferral: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (args: any) => referralRow({ ...args?.data })),
      update: jest.fn().mockResolvedValue(referralRow({ status: 'acknowledged' })),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'head-1' }]) },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn().mockImplementation(async (callback: any) => callback(prisma)),
  }
  const atRisk = { classifyStudent: jest.fn().mockResolvedValue(classification('below_threshold')) }
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) }
  const service = new AttendanceReferralService(prisma as never, atRisk as never, notifications as never)
  return { service, prisma, atRisk, notifications }
}

describe('AttendanceReferralService — F5 (WF-LD7)', () => {
  describe('generateReferral scope matrix', () => {
    it('lets the owning teacher generate and audits the row', async () => {
      const { service, prisma, notifications } = makeService()

      const referral = await service.generateReferral(teacher, { studentId: 'stu-1', sectionId: 'sec-1' })

      expect(referral.status).toBe('generated')
      expect(referral.studentNumber).toBe('2023-0001')
      expect(referral.generatedById).toBe('teacher-1')
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'attendance.referral_created' }) }),
      )
      // Heads are notified because the actor is a plain teacher.
      expect(notifications.notify).toHaveBeenCalledWith(
        'head-1',
        expect.objectContaining({ type: 'at_risk_referral', link: '/faculty/at-risk' }),
      )
    })

    it('rejects a foreign section for a plain teacher', async () => {
      const { service } = makeService()
      await expect(
        service.generateReferral(headOfOtherDept, { studentId: 'stu-1', sectionId: 'sec-1' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('accepts a department head whose oversight department matches the section teacher', async () => {
      const { service } = makeService()
      const referral = await service.generateReferral(headOfDept, { studentId: 'stu-1', sectionId: 'sec-1' })
      expect(referral.sectionName).toBe('1-A')
    })

    it('accepts a scoped super admin and rejects a department-scoped admin outside the department', async () => {
      const { service, prisma } = makeService()
      const referral = await service.generateReferral(institutionAdmin, { studentId: 'stu-1', sectionId: 'sec-1' })
      expect(referral.status).toBe('generated')

      prisma.section.findFirst.mockResolvedValue(null)
      await expect(
        service.generateReferral(departmentAdmin, { studentId: 'stu-1', sectionId: 'sec-1' }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('never notifies itself when the actor is the section teacher', async () => {
      const { service, notifications } = makeService()
      // The head lookup only runs for non-head actors, and the section teacher
      // is the actor here — so nothing fires in this scenario setup.
      await service.generateReferral(teacher, { studentId: 'stu-1', sectionId: 'sec-1' })
      const recipients = notifications.notify.mock.calls.map((call: unknown[]) => call[0])
      expect(recipients).not.toContain('teacher-1')
    })

    it('throws when section is missing', async () => {
      const { service, prisma } = makeService()
      prisma.section.findUnique.mockResolvedValue(null)
      await expect(service.generateReferral(teacher, { studentId: 'stu-1', sectionId: 'sec-x' })).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('deterministic threshold gating', () => {
    it('rejects an on_track student with a typed 409', async () => {
      const { service, atRisk } = makeService()
      atRisk.classifyStudent.mockResolvedValue(classification('on_track'))
      await expect(service.generateReferral(teacher, { studentId: 'stu-1', sectionId: 'sec-1' })).rejects.toMatchObject(
        {
          getStatus: expect.any(Function),
          response: expect.objectContaining({
            code: 'student_not_at_risk',
            message: expect.stringContaining('on_track'),
          }),
        },
      )
    })

    it('rejects when the engine has no data for the student', async () => {
      const { service, atRisk } = makeService()
      atRisk.classifyStudent.mockResolvedValue(null)
      await expect(service.generateReferral(teacher, { studentId: 'stu-9', sectionId: 'sec-1' })).rejects.toMatchObject(
        {
          response: expect.objectContaining({ code: 'student_not_at_risk' }),
        },
      )
    })

    it('rejects a student who is not enrolled', async () => {
      const { service, prisma } = makeService()
      prisma.enrollment.findUnique.mockResolvedValue(null)
      await expect(service.generateReferral(teacher, { studentId: 'stu-ghost', sectionId: 'sec-1' })).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('idempotency', () => {
    it('rejects a second active referral for the same (student, section) with 409 referral_active', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findFirst.mockResolvedValue({ id: 'ref-existing' })

      await expect(service.generateReferral(teacher, { studentId: 'stu-1', sectionId: 'sec-1' })).rejects.toMatchObject(
        {
          response: expect.objectContaining({ code: 'referral_active' }),
        },
      )
      expect(prisma.atRiskReferral.create).not.toHaveBeenCalled()
    })

    it('allows re-generation after the previous referral resolved', async () => {
      const { service, prisma } = makeService()
      // findFirst is scoped to status != resolved, so a resolved row never blocks.
      prisma.atRiskReferral.findFirst.mockResolvedValue(null)

      await service.generateReferral(teacher, { studentId: 'stu-1', sectionId: 'sec-1' })

      expect(prisma.atRiskReferral.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { not: 'resolved' } }) }),
      )
      expect(prisma.atRiskReferral.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('listReferrals', () => {
    it('scopes teachers to their own sections and applies filters', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findMany.mockResolvedValue([referralRow()])

      const rows = await service.listReferrals(teacher, { status: 'acknowledged', sectionId: 'sec-1' })

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        id: 'ref-1',
        studentName: 'Juan Dela Cruz',
        subjectName: 'Software Engineering',
        generatedByName: 'Prof. Cruz',
        status: 'generated',
      })
      const where = prisma.atRiskReferral.findMany.mock.calls[0][0].where
      expect(where).toEqual(
        expect.objectContaining({ status: 'acknowledged', sectionId: 'sec-1', section: { teacherId: 'teacher-1' } }),
      )
    })

    it('widens the teacher view to the department for a department head', async () => {
      const { service, prisma } = makeService()
      await service.listReferrals(headOfDept)
      const where = prisma.atRiskReferral.findMany.mock.calls[0][0].where
      expect(where.section).toEqual({
        OR: [{ teacherId: 'head-1' }, { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } }],
      })
    })

    it('applies the super-admin department scope via the shared admin fragment', async () => {
      const { service, prisma } = makeService()
      await service.listReferrals(departmentAdmin)
      const where = prisma.atRiskReferral.findMany.mock.calls[0][0].where
      expect(where.section).toEqual({ teacher: { department: 'COE' } })
    })
  })

  describe('updateReferralStatus — transitions', () => {
    it('downgrades a plain (non-head) teacher: the generating teacher is read-only', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(referralRow())
      await expect(service.updateReferralStatus(teacher, 'ref-1', { status: 'acknowledged' })).rejects.toThrow(
        ForbiddenException,
      )
      expect(prisma.atRiskReferral.update).not.toHaveBeenCalled()
    })

    it('lets a department head transition and notifies the generating teacher', async () => {
      const { service, prisma, notifications } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(
        referralRow({ generatedById: 'teacher-1', generatedBy: { id: 'teacher-1', fullName: 'Prof. Cruz' } }),
      )

      const updated = await service.updateReferralStatus(headOfDept, 'ref-1', { status: 'acknowledged' })

      expect(updated.status).toBe('acknowledged')
      expect(prisma.atRiskReferral.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'acknowledged' } }),
      )
      expect(notifications.notify).toHaveBeenCalledWith(
        'teacher-1',
        expect.objectContaining({ type: 'at_risk_referral', title: 'Referral acknowledged' }),
      )
    })

    it('audits the transition with from/to and stamps resolvedAt metadata on resolution', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(referralRow({ generatedById: 'teacher-1' }))
      prisma.atRiskReferral.update.mockResolvedValue(referralRow({ status: 'resolved', generatedById: 'teacher-1' }))

      await service.updateReferralStatus(headOfDept, 'ref-1', { status: 'resolved' })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'attendance.referral_updated',
            metadata: expect.objectContaining({ from: 'generated', to: 'resolved', resolvedAt: expect.any(String) }),
          }),
        }),
      )
    })

    it('applies the audit note update flag and keeps consulting-scheduled silent', async () => {
      const { service, prisma, notifications } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(referralRow({ generatedById: 'teacher-1' }))
      prisma.atRiskReferral.update.mockResolvedValue(referralRow({ status: 'counseling_scheduled' }))

      await service.updateReferralStatus(headOfDept, 'ref-1', { status: 'counseling_scheduled', note: 'booked' })

      expect(prisma.atRiskReferral.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'counseling_scheduled', note: 'booked' } }),
      )
      expect(notifications.notify).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'attendance.referral_updated',
            metadata: expect.objectContaining({ to: 'counseling_scheduled', noteUpdated: true }),
          }),
        }),
      )
    })

    it('keeps updating even when the audit row cannot be written (fail-open)', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(referralRow({ generatedById: 'teacher-1' }))
      prisma.auditLog.create.mockRejectedValue(new Error('audit table offline'))
      prisma.atRiskReferral.update.mockResolvedValue(referralRow({ status: 'resolved' }))

      const updated = await service.updateReferralStatus(headOfDept, 'ref-1', { status: 'resolved' })
      expect(updated.status).toBe('resolved')
    })

    it('rejects a department head of another department', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(referralRow())
      await expect(service.updateReferralStatus(headOfOtherDept, 'ref-1', { status: 'acknowledged' })).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('scopes a department super admin (registrar of another department is rejected)', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(referralRow())
      prisma.section.findFirst.mockResolvedValue(null)
      await expect(service.updateReferralStatus(departmentAdmin, 'ref-1', { status: 'acknowledged' })).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('throws when the referral is missing', async () => {
      const { service, prisma } = makeService()
      prisma.atRiskReferral.findUnique.mockResolvedValue(null)
      await expect(
        service.updateReferralStatus(institutionAdmin, 'ref-missing', { status: 'acknowledged' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('the shared engine classification', () => {
    it('matches the at-risk list math (excludes excused/pending, at_risk at the zero-margin point)', () => {
      const below = classifyAtRiskRow({ present: 10, absent: 10 }, 75)
      expect(below.status).toBe('below_threshold')
      expect(below.attendanceRate).toBe(50)

      const edge = classifyAtRiskRow({ present: 15, absent: 5 }, 75)
      expect(edge.status).toBe('at_risk')
      expect(edge.absencesBeforeBelowThreshold).toBe(0)

      const healthy = classifyAtRiskRow({ present: 19, absent: 1 }, 75)
      expect(healthy.status).toBe('on_track')
      expect(healthy.absencesBeforeBelowThreshold).toBe(5)
    })
  })
})
