import { BadRequestException } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import type { RequestUser } from '../auth/authenticated-principal'

describe('DashboardService', () => {
  const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }

  it('runs narrow, bounded search queries concurrently', async () => {
    let resolveSections!: (value: []) => void
    let resolveSessions!: (value: [{ id: string; qrToken: string }]) => void
    let resolveStudents!: (value: []) => void
    const prisma = {
      section: {
        findMany: jest.fn().mockReturnValue(new Promise<[]>((resolve) => (resolveSections = resolve))),
      },
      session: {
        findMany: jest
          .fn()
          .mockReturnValue(new Promise<[{ id: string; qrToken: string }]>((resolve) => (resolveSessions = resolve))),
      },
      user: {
        findMany: jest.fn().mockReturnValue(new Promise<[]>((resolve) => (resolveStudents = resolve))),
      },
    }
    const service = new DashboardService(prisma as never)

    const resultPromise = service.search(teacher, 'Stu')

    expect(prisma.section.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.session.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1)

    const sectionQuery = prisma.section.findMany.mock.calls[0][0]
    expect(sectionQuery.select).toEqual({ id: true, subjectId: true, section: true, room: true })
    expect(sectionQuery.include).toBeUndefined()
    expect(sectionQuery.take).toBe(8)

    const sessionQuery = prisma.session.findMany.mock.calls[0][0]
    expect(sessionQuery.select).toEqual({
      id: true,
      sectionId: true,
      subjectName: true,
      date: true,
      startTime: true,
      endTime: true,
      room: true,
      isActive: true,
      isRescheduled: true,
      rescheduledFromDate: true,
    })
    expect(sessionQuery.include).toBeUndefined()
    expect(sessionQuery.take).toBe(8)

    const studentQuery = prisma.user.findMany.mock.calls[0][0]
    expect(studentQuery.select).toEqual({ id: true, studentId: true, fullName: true, program: true })
    expect(studentQuery.select.password).toBeUndefined()
    expect(studentQuery.where.enrollments.some.section.teacherId).toBe('teacher-1')
    expect(studentQuery.take).toBe(10)

    resolveSections([])
    resolveSessions([{ id: 'session-1', qrToken: 'secret' }])
    resolveStudents([])
    const result = await resultPromise

    expect(result.sessions[0]).not.toHaveProperty('qrToken')
  })

  it('limits department administrator student search results to their department', async () => {
    const prisma = {
      section: { findMany: jest.fn().mockResolvedValue([]) },
      session: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const service = new DashboardService(prisma as never)

    await service.search({ id: 'admin-1', role: 'super_admin', scope: 'department', department: 'CCIS' }, 'student')

    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ role: 'student', department: 'CCIS' }),
    )
  })

  it('returns no student search results for a scoped administrator without a department', async () => {
    const prisma = {
      section: { findMany: jest.fn().mockResolvedValue([]) },
      session: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const service = new DashboardService(prisma as never)

    await service.search({ id: 'admin-1', role: 'super_admin', scope: 'department' }, 'student')

    expect(prisma.user.findMany.mock.calls[0][0].where.id).toEqual({ in: [] })
  })

  it('uses enrollment relations once per student search query instead of loading enrollment IDs', async () => {
    const prisma = {
      section: { findMany: jest.fn().mockResolvedValue([]) },
      session: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn() },
      enrollment: { findMany: jest.fn() },
    }
    const service = new DashboardService(prisma as never)

    await service.search({ id: 'student-1', role: 'student' }, 'math')

    expect(prisma.enrollment.findMany).not.toHaveBeenCalled()
    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(prisma.section.findMany.mock.calls[0][0].where.AND[0]).toEqual({
      enrollments: { some: { studentId: 'student-1' } },
    })
    expect(prisma.session.findMany.mock.calls[0][0].where.AND[0]).toEqual({
      section: { enrollments: { some: { studentId: 'student-1' } } },
    })
  })

  it('rejects search terms shorter than two trimmed characters', async () => {
    const service = new DashboardService({} as never)

    await expect(service.search(teacher, ' a ')).rejects.toThrow(BadRequestException)
  })

  it('does not select attendance records for staff calendar queries and applies a hard cap', async () => {
    const prisma = { session: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new DashboardService(prisma as never)

    await service.events(teacher, '2026-01-01', '2026-01-31')

    const query = prisma.session.findMany.mock.calls[0][0]
    expect(query.select.attendanceRecords).toBeUndefined()
    expect(query.select.endedAt).toBe(true)
    expect(query.include).toBeUndefined()
    expect(query.take).toBeGreaterThan(0)
    expect(query.take).toBeLessThanOrEqual(2_000)
  })

  it('selects only one attendance status for student calendar queries', async () => {
    const prisma = { session: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new DashboardService(prisma as never)

    await service.events({ id: 'student-1', role: 'student' }, '2026-01-01', '2026-01-31')

    const query = prisma.session.findMany.mock.calls[0][0]
    expect(query.select.attendanceRecords).toEqual({
      where: { studentId: 'student-1' },
      select: { status: true },
      take: 1,
    })
    expect(query.take).toBeLessThanOrEqual(2_000)
  })

  it('distinguishes inactive, active, and completed calendar sessions', async () => {
    const baseSession = {
      subjectName: 'Algorithms',
      date: '2026-07-18',
      startTime: '08:00',
      endTime: '09:00',
      room: 'Lab 1',
      sectionId: 'section-1',
      isRescheduled: false,
      rescheduledFromDate: null,
      section: {
        section: 'BSIT 3-1',
        teacher: { fullName: 'Teacher One' },
        subject: { code: 'COMP 301' },
      },
    }
    const prisma = {
      session: {
        findMany: jest.fn().mockResolvedValue([
          { ...baseSession, id: 'inactive', isActive: false, endedAt: null },
          { ...baseSession, id: 'active', isActive: true, endedAt: null },
          { ...baseSession, id: 'completed', isActive: false, endedAt: new Date('2026-07-18T02:00:00Z') },
        ]),
      },
    }
    const service = new DashboardService(prisma as never)

    const events = await service.events(teacher, '2026-07-18', '2026-07-18')

    expect(events.map((event) => [event.id, event.status])).toEqual([
      ['inactive', 'inactive'],
      ['active', 'active'],
      ['completed', 'completed'],
    ])
  })

  it('neutralizes spreadsheet formulas in CSV exports', async () => {
    const prisma = {
      attendanceRecord: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            studentName: '=HYPERLINK("https://evil.test")',
            studentId: 'S-1',
            status: 'present',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            latitude: 1,
            longitude: 2,
            session: { subjectName: 'Subject', date: '2026-01-01', startTime: '09:00' },
          },
        ]),
      },
    }
    const service = new DashboardService(prisma as never)

    const csv = await service.exportCsv(
      { id: 'student-1', role: 'student' },
      { startDate: '2026-01-01', endDate: '2026-01-31' },
    )

    expect(csv).toContain("'=HYPERLINK")
    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].take).toBe(1)
    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].select.session).toBeDefined()
    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].include).toBeUndefined()
  })

  it('builds dashboard totals with count/groupBy queries and bounded recent rows', async () => {
    const prisma = {
      section: {
        count: jest.fn().mockResolvedValue(2),
        groupBy: jest.fn().mockResolvedValue([{ subjectId: 'subject-1' }]),
      },
      enrollment: { groupBy: jest.fn().mockResolvedValue([{ studentId: 'student-1' }]) },
      session: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: 'session-1', date: '2026-07-14' }]),
      },
      attendanceRecord: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        groupBy: jest.fn().mockResolvedValue([{ sessionId: 'session-1', status: 'present', _count: { _all: 12 } }]),
      },
    }
    const service = new DashboardService(prisma as never)

    const result = await service.overview(teacher, { startDate: '2026-07-14', endDate: '2026-07-14' })

    expect(result.counts).toEqual({
      faculty: 1,
      students: 1,
      subjects: 1,
      sections: 2,
      sessionsToday: 1,
      pendingDisputes: 3,
    })
    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].take).toBe(10)
    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ session: { teacherId: 'teacher-1' } }, { status: { not: 'pending' } }],
    })
    expect(prisma.attendanceRecord.findMany.mock.calls[1][0].take).toBe(5)
    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['sessionId', 'status'], _count: { _all: true } }),
    )
    expect(result.trends[0]).toEqual(expect.objectContaining({ date: '2026-07-14', present: 12 }))
  })

  it('uses the Manila campus day for dashboard counts and default ranges', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T16:30:00.000Z'))
    const prisma = {
      section: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      enrollment: { groupBy: jest.fn().mockResolvedValue([]) },
      session: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    }
    const service = new DashboardService(prisma as never)

    try {
      const result = await service.overview(teacher)

      expect(prisma.session.count.mock.calls[0][0].where.AND).toContainEqual({ date: '2026-07-18' })
      expect(result.trendRange.endDate).toBe('2026-07-18')
    } finally {
      jest.useRealTimers()
    }
  })

  it('rejects exports over the strict row cap before reading any rows', async () => {
    const prisma = {
      attendanceRecord: { count: jest.fn().mockResolvedValue(25_001), findMany: jest.fn() },
    }
    const service = new DashboardService(prisma as never)

    await expect(service.exportCsv(teacher, { startDate: '2026-07-01', endDate: '2026-07-31' })).rejects.toThrow(
      '25,000 records',
    )
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
  })

  it('rejects reversed calendar ranges', async () => {
    const service = new DashboardService({} as never)
    await expect(service.events(teacher, '2026-02-01', '2026-01-01')).rejects.toThrow(BadRequestException)
  })
})
