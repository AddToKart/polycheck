import { BadRequestException } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

describe('DashboardService', () => {
  const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }

  it('uses an explicit safe student projection and removes QR tokens from search results', async () => {
    const prisma = {
      section: { findMany: jest.fn().mockResolvedValue([]) },
      session: {
        findMany: jest.fn().mockResolvedValue([{ id: 'session-1', qrToken: 'secret', teacherId: 'teacher-1' }]),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'student-1', fullName: 'Student' }]) },
    }
    const service = new DashboardService(prisma as never)

    const result = await service.search(teacher, 'Stu')

    expect(prisma.user.findMany.mock.calls[0][0].select.password).toBeUndefined()
    expect(prisma.user.findMany.mock.calls[0][0].where.enrollments.some.section.teacherId).toBe('teacher-1')
    expect(result.sessions[0]).not.toHaveProperty('qrToken')
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

    const csv = await service.exportCsv({ id: 'student-1', role: 'student' })

    expect(csv).toContain("'=HYPERLINK")
  })

  it('rejects reversed calendar ranges', async () => {
    const service = new DashboardService({} as never)
    await expect(service.events(teacher, '2026-02-01', '2026-01-01')).rejects.toThrow(BadRequestException)
  })
})
