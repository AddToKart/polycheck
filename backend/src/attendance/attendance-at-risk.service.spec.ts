import { ForbiddenException } from '@nestjs/common'
import { AttendanceAtRiskService } from './attendance-at-risk.service'
import type { RequestUser } from '../auth/authenticated-principal'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const departmentAdmin: RequestUser = {
  id: 'admin-2',
  role: 'super_admin',
  scope: 'department',
  department: 'CCIS',
}
const student: RequestUser = { id: 'stu-1', role: 'student' }

function section(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sec-1',
    section: '1-A',
    subject: { name: 'Software Engineering' },
    teacher: { fullName: 'Prof. Cruz' },
    ...overrides,
  }
}

function enrollment(studentId: string, fullName: string, studentNumber?: string, sectionId = 'sec-1') {
  return {
    sectionId,
    student: { id: studentId, fullName, studentId: studentNumber ?? null },
  }
}

function group(studentId: string, status: string, count: number, timestamp?: Date) {
  return {
    sectionId: 'sec-1',
    studentId,
    status,
    _count: { _all: count },
    _max: { timestamp: timestamp ?? null },
  }
}

function makeService() {
  const prisma = {
    section: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([section()]),
    },
    enrollment: { findMany: jest.fn().mockResolvedValue([]) },
    attendanceRecord: { groupBy: jest.fn().mockResolvedValue([]) },
  }
  const standing = { thresholdPercent: jest.fn().mockResolvedValue(75) }
  const service = new AttendanceAtRiskService(prisma as never, standing as never)
  return { service, prisma, standing }
}

describe('AttendanceAtRiskService', () => {
  it('computes one row per student per section, excludes non-counted statuses, and sorts worst-first', async () => {
    const { service, prisma } = makeService()
    prisma.enrollment.findMany.mockResolvedValue([
      enrollment('stu-a', 'Student A', 'S-001'),
      enrollment('stu-b', 'Student B', 'S-002'),
      enrollment('stu-c', 'Student C', 'S-003'),
      enrollment('stu-d', 'Student D', 'S-004'),
    ])
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      group('stu-a', 'present', 15),
      group('stu-a', 'absent', 5, new Date('2026-10-20T00:00:00.000Z')),
      group('stu-a', 'excused', 3),
      group('stu-a', 'disputed', 2),
      group('stu-b', 'present', 10),
      group('stu-b', 'absent', 10, new Date('2026-10-22T00:00:00.000Z')),
      group('stu-c', 'present', 20),
    ])

    const result = await service.list(teacher)

    expect(result.map((row) => [row.studentId, row.status, row.attendanceRate])).toEqual([
      ['stu-b', 'below_threshold', 50],
      ['stu-a', 'at_risk', 75],
      ['stu-c', 'on_track', 100],
      ['stu-d', 'insufficient_data', null],
    ])
    expect(result[0]).toMatchObject({
      studentName: 'Student B',
      studentNumber: 'S-002',
      sectionId: 'sec-1',
      sectionName: '1-A',
      subjectName: 'Software Engineering',
      professorName: 'Prof. Cruz',
      thresholdPercent: 75,
      absencesBeforeBelowThreshold: 0,
      lastAbsenceDate: '2026-10-22',
    })
    expect(result[2].absencesBeforeBelowThreshold).toBe(6)
    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledTimes(1)
    expect(prisma.enrollment.findMany).toHaveBeenCalledTimes(1)
  })

  it('applies the requested limit after sorting', async () => {
    const { service, prisma } = makeService()
    prisma.enrollment.findMany.mockResolvedValue([
      enrollment('stu-a', 'Student A'),
      enrollment('stu-b', 'Student B'),
      enrollment('stu-c', 'Student C'),
    ])
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      group('stu-a', 'present', 15),
      group('stu-a', 'absent', 5),
      group('stu-b', 'present', 5),
      group('stu-b', 'absent', 15),
      group('stu-c', 'present', 20),
    ])

    const result = await service.list(teacher, { limit: 1 })

    expect(result).toHaveLength(1)
    expect(result[0].studentId).toBe('stu-b')
  })

  it('scopes teachers to their own sections and explicitly rejects a foreign section filter', async () => {
    const { service, prisma } = makeService()
    prisma.section.findFirst.mockResolvedValue(null)

    await expect(service.list(teacher, { sectionId: 'sec-foreign' })).rejects.toThrow(ForbiddenException)
    expect(prisma.section.findFirst).toHaveBeenCalledWith({
      where: { teacherId: 'teacher-1', id: 'sec-foreign' },
      select: { id: true },
    })

    prisma.section.findFirst.mockResolvedValue({ id: 'sec-1' })
    await service.list(teacher, { sectionId: 'sec-1' })
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: 'teacher-1', id: 'sec-1' } }),
    )
  })

  it('pins department admins to their own department', async () => {
    const { service, prisma } = makeService()

    await service.list(departmentAdmin)

    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacher: { department: 'CCIS' } } }),
    )
  })

  it('allows institution admins to see every section', async () => {
    const { service, prisma } = makeService()

    await service.list(admin)

    expect(prisma.section.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })

  it('forbids students', async () => {
    const { service } = makeService()
    await expect(service.list(student)).rejects.toThrow(ForbiddenException)
  })

  it('returns an empty list without extra queries when no sections are in scope', async () => {
    const { service, prisma } = makeService()
    prisma.section.findMany.mockResolvedValue([])

    await expect(service.list(teacher)).resolves.toEqual([])
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled()
    expect(prisma.attendanceRecord.groupBy).not.toHaveBeenCalled()
  })
})
