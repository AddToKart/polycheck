import { ForbiddenException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { StandingService } from './standing.service'

const student: RequestUser = { id: 'student-1', role: 'student' }

interface StandingRecord {
  status: string
  timestamp: Date
  session: { date: string } | null
}

function makeSection(
  id: string,
  subjectName: string,
  subjectCode: string,
  records: StandingRecord[],
  sectionName = '1-A',
) {
  return {
    id,
    section: sectionName,
    subject: { name: subjectName, code: subjectCode },
    teacher: { fullName: `Prof. ${subjectName}` },
    attendanceRecords: records,
  }
}

function makeRecords(statuses: string[], date = '2026-01-01'): StandingRecord[] {
  return statuses.map((status, index) => ({
    status,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)),
    session: { date },
  }))
}

function statuses(present: number, late: number, absent: number, disputed = 0, pending = 0, excused = 0): string[] {
  return [
    ...Array.from({ length: present }, () => 'present'),
    ...Array.from({ length: late }, () => 'late'),
    ...Array.from({ length: absent }, () => 'absent'),
    ...Array.from({ length: disputed }, () => 'disputed'),
    ...Array.from({ length: pending }, () => 'pending'),
    ...Array.from({ length: excused }, () => 'excused'),
  ]
}

function createPrisma(sections: unknown[], threshold: string | null = '75') {
  return {
    institutionSetting: {
      findUnique: jest.fn().mockResolvedValue(threshold === null ? null : { value: threshold }),
    },
    section: {
      findMany: jest.fn().mockResolvedValue(sections),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  }
}

describe('StandingService', () => {
  it('returns insufficient_data with a null rate when no attendance has been counted', async () => {
    const prisma = createPrisma([makeSection('sec-1', 'Software Engineering', 'COMP 20043', [])])
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing).toEqual({
      sectionId: 'sec-1',
      subjectName: 'Software Engineering',
      subjectCode: 'COMP 20043',
      sectionName: '1-A',
      professorName: 'Prof. Software Engineering',
      thresholdPercent: 75,
      present: 0,
      late: 0,
      absent: 0,
      disputed: 0,
      countedSessions: 0,
      attendanceRate: null,
      status: 'insufficient_data',
      absencesBeforeBelowThreshold: null,
    })
    expect(standing.lastSessionDate).toBeUndefined()
    expect(standing.caveat).toBeUndefined()
  })

  it('treats the exact threshold as at risk with zero absences remaining', async () => {
    const prisma = createPrisma([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(18, 0, 6))),
    ])
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing).toMatchObject({
      present: 18,
      late: 0,
      absent: 6,
      countedSessions: 24,
      attendanceRate: 75,
      status: 'at_risk',
      absencesBeforeBelowThreshold: 0,
    })
  })

  it('projects the exact number of additional absences before breaching the threshold', async () => {
    const first = createPrisma([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(18, 0, 3))),
    ])
    const firstService = new StandingService(first as never)

    const [atThreeAbsences] = await firstService.forStudent(student)
    expect(atThreeAbsences).toMatchObject({
      countedSessions: 21,
      attendanceRate: 85.7,
      status: 'on_track',
      absencesBeforeBelowThreshold: 3,
    })

    first.section.findMany.mockResolvedValue([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(18, 0, 6))),
    ])
    const [afterThreeMore] = await firstService.forStudent(student)
    expect(afterThreeMore).toMatchObject({ attendanceRate: 75, status: 'at_risk', absencesBeforeBelowThreshold: 0 })

    first.section.findMany.mockResolvedValue([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(18, 0, 7))),
    ])
    const [afterFourth] = await firstService.forStudent(student)
    expect(afterFourth).toMatchObject({
      attendanceRate: 72,
      status: 'below_threshold',
      absencesBeforeBelowThreshold: 0,
    })
  })

  it('reports below_threshold with an exhausted absence window', async () => {
    const prisma = createPrisma([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(10, 0, 10))),
    ])
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing).toMatchObject({
      countedSessions: 20,
      attendanceRate: 50,
      status: 'below_threshold',
      absencesBeforeBelowThreshold: 0,
    })
  })

  it('excludes disputed and pending records and surfaces the caveat', async () => {
    const prisma = createPrisma([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(3, 1, 0, 2, 1))),
    ])
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing).toMatchObject({
      present: 3,
      late: 1,
      absent: 0,
      disputed: 2,
      countedSessions: 4,
      attendanceRate: 100,
      status: 'on_track',
      absencesBeforeBelowThreshold: 1,
      caveat: '2 disputed record(s) excluded from the rate. 1 pending record(s) excluded from the rate.',
    })
  })

  it('excludes excused records from the denominator and extends the caveat', async () => {
    const prisma = createPrisma([
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(3, 1, 0, 0, 0, 4))),
    ])
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing).toMatchObject({
      present: 3,
      late: 1,
      absent: 0,
      countedSessions: 4,
      attendanceRate: 100,
      status: 'on_track',
      caveat: '4 excused record(s) excluded from the rate.',
    })
  })

  it('notifies below-threshold and at-risk sections only', async () => {
    const prisma = createPrisma([
      makeSection('sec-1', 'Below', 'B-1', makeRecords(statuses(10, 0, 10))),
      makeSection('sec-2', 'AtRisk', 'A-1', makeRecords(statuses(18, 0, 6))),
      makeSection('sec-3', 'Safe', 'S-1', makeRecords(statuses(20, 0, 0))),
    ])
    const notifications = { notifyStandingRisk: jest.fn().mockResolvedValue(true) }
    const service = new StandingService(prisma as never, notifications as never)

    await service.forStudent(student)

    expect(notifications.notifyStandingRisk).toHaveBeenCalledTimes(2)
    expect(notifications.notifyStandingRisk).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ sectionId: 'sec-1', status: 'below_threshold', attendanceRate: 50 }),
    )
    expect(notifications.notifyStandingRisk).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ sectionId: 'sec-2', status: 'at_risk', attendanceRate: 75 }),
    )
    expect(notifications.notifyStandingRisk).not.toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ sectionId: 'sec-3' }),
    )
  })

  it('uses the latest session date that has a record', async () => {
    const records = [
      ...makeRecords(['present'], '2026-02-03'),
      ...makeRecords(['late'], '2026-02-10'),
      ...makeRecords(['absent'], '2026-01-30'),
    ]
    const prisma = createPrisma([makeSection('sec-1', 'Software Engineering', 'COMP 20043', records)])
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing.lastSessionDate).toBe('2026-02-10')
  })

  it('never reports a risk window when the threshold is zero', async () => {
    const prisma = createPrisma(
      [makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(5, 0, 5)))],
      '0',
    )
    const service = new StandingService(prisma as never)

    const [standing] = await service.forStudent(student)

    expect(standing).toMatchObject({
      thresholdPercent: 0,
      attendanceRate: 50,
      status: 'on_track',
      absencesBeforeBelowThreshold: null,
    })
  })

  it('orders standings by subject name and section name', async () => {
    const prisma = createPrisma([
      makeSection('sec-2', 'Zoology', 'BIO 100', [], '2-B'),
      makeSection('sec-3', 'Anatomy', 'BIO 101', [], '1-B'),
      makeSection('sec-1', 'Anatomy', 'BIO 101', [], '1-A'),
    ])
    const service = new StandingService(prisma as never)

    const standings = await service.forStudent(student)

    expect(standings.map((standing) => [standing.subjectName, standing.sectionName])).toEqual([
      ['Anatomy', '1-A'],
      ['Anatomy', '1-B'],
      ['Zoology', '2-B'],
    ])
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollments: { some: { studentId: 'student-1' } } },
        orderBy: [{ subject: { name: 'asc' } }, { section: 'asc' }],
      }),
    )
  })

  it.each([
    [null, 75],
    ['80', 80],
    ['150', 100],
    ['-5', 0],
    ['not-a-number', 75],
  ])('reads the threshold setting %s as %s with fallback and clamping', async (value, expected) => {
    const prisma = createPrisma([], value)
    const service = new StandingService(prisma as never)

    await expect(service.thresholdPercent()).resolves.toBe(expected)
  })

  it('evaluates one enrolled section with the same deterministic math', async () => {
    const prisma = createPrisma([])
    prisma.section.findFirst.mockResolvedValue(
      makeSection('sec-1', 'Software Engineering', 'COMP 20043', makeRecords(statuses(18, 0, 6))),
    )
    const service = new StandingService(prisma as never)

    await expect(service.forStudentSection(student, 'sec-1')).resolves.toMatchObject({
      sectionId: 'sec-1',
      attendanceRate: 75,
      status: 'at_risk',
      absencesBeforeBelowThreshold: 0,
    })
    expect(prisma.section.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sec-1', enrollments: { some: { studentId: 'student-1' } } },
      }),
    )
  })

  it('returns null for an unenrolled section and forbids non-students on the scoped evaluator', async () => {
    const service = new StandingService(createPrisma([]) as never)

    await expect(service.forStudentSection(student, 'sec-2')).resolves.toBeNull()
    await expect(service.forStudentSection({ id: 'teacher-1', role: 'teacher' }, 'sec-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('forbids non-student callers even when the controller guard is bypassed', async () => {
    const service = new StandingService(createPrisma([]) as never)

    await expect(service.forStudent({ id: 'teacher-1', role: 'teacher' })).rejects.toBeInstanceOf(ForbiddenException)
  })
})
