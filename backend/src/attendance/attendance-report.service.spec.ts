import { AttendanceReportService } from './attendance-report.service'
import { AttendanceScopeService } from './attendance-scope.service'
import type { RequestUser } from '../auth/authenticated-principal'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const departmentAdmin: RequestUser = {
  id: 'admin-2',
  role: 'super_admin',
  scope: 'department',
  department: 'CCIS',
}

function makeService() {
  const prisma = {
    session: { groupBy: jest.fn().mockResolvedValue([]) },
    attendanceRecord: { groupBy: jest.fn().mockResolvedValue([]) },
    section: { findMany: jest.fn().mockResolvedValue([]) },
  }
  const scope = new AttendanceScopeService(prisma as never)
  const service = new AttendanceReportService(prisma as never, scope)
  return { service, scope, prisma }
}

function departmentClause(where: { AND?: unknown[] }) {
  return (where.AND ?? []).find((clause) => {
    if (typeof clause !== 'object' || clause === null || !('section' in clause)) return false
    const section = (clause as { section: { teacher?: { department?: unknown } } }).section
    return typeof section.teacher?.department === 'object' && section.teacher?.department !== null
  }) as { section: { teacher: { department: { equals: string; mode: string } } } } | undefined
}

describe('AttendanceReportService', () => {
  it('includes excused records in summaries and totals', async () => {
    const { service, prisma } = makeService()
    prisma.session.groupBy.mockResolvedValue([{ sectionId: 'sec-1', _count: { _all: 4 } }])
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      { sectionId: 'sec-1', status: 'present', _count: { _all: 2 } },
      { sectionId: 'sec-1', status: 'absent', _count: { _all: 1 } },
      { sectionId: 'sec-1', status: 'excused', _count: { _all: 1 } },
    ])
    prisma.section.findMany.mockResolvedValue([{ id: 'sec-1', subject: { name: 'Algorithms' } }])

    const result = await service.report(admin, { startDate: '2026-10-01', endDate: '2026-10-27' })

    expect(result.summaries[0]).toEqual({
      sectionId: 'sec-1',
      subjectName: 'Algorithms',
      totalSessions: 4,
      present: 2,
      late: 0,
      absent: 1,
      disputed: 0,
      pending: 0,
      excused: 1,
    })
    expect(result.totals).toEqual({
      totalRecords: 4,
      totalSessions: 4,
      present: 2,
      late: 0,
      absent: 1,
      pending: 0,
      disputed: 0,
      excused: 1,
    })
  })

  it('applies an institution admin department filter to the session scope', async () => {
    const { service, prisma } = makeService()

    await service.report(admin, { startDate: '2026-10-01', endDate: '2026-10-27', department: 'CCIS' })

    const clause = departmentClause(prisma.session.groupBy.mock.calls[0][0].where)
    expect(clause?.section.teacher.department).toEqual({ equals: 'CCIS', mode: 'insensitive' })
  })

  it('forces a department admin to their own department even when another is requested', async () => {
    const { service, prisma } = makeService()

    await service.report(departmentAdmin, {
      startDate: '2026-10-01',
      endDate: '2026-10-27',
      department: 'CAF',
    })

    const clause = departmentClause(prisma.session.groupBy.mock.calls[0][0].where)
    expect(clause?.section.teacher.department).toEqual({ equals: 'CCIS', mode: 'insensitive' })
  })

  it('ignores department filters for teachers', async () => {
    const { service, prisma } = makeService()

    await service.report(teacher, { startDate: '2026-10-01', endDate: '2026-10-27', department: 'CCIS' })

    const where = prisma.session.groupBy.mock.calls[0][0].where
    expect(departmentClause(where)).toBeUndefined()
    expect(where.AND).toEqual(expect.arrayContaining([{ teacherId: 'teacher-1' }]))
  })

  it('rejects the existing teacher impersonation guard', async () => {
    const { service } = makeService()

    await expect(
      service.report(teacher, { startDate: '2026-10-01', endDate: '2026-10-27', teacherId: 'teacher-2' }),
    ).rejects.toThrow('Teachers can only report on their own attendance')
  })
})
