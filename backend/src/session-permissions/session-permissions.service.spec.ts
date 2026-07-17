import { ForbiddenException } from '@nestjs/common'
import { SessionPermissionsService } from './session-permissions.service'

describe('SessionPermissionsService', () => {
  it('upserts the single 24-hour permission for a student and section', async () => {
    const prisma = {
      section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1' }) },
      enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
      sessionPermission: { upsert: jest.fn().mockResolvedValue({ id: 'permission-1' }) },
    }
    const service = new SessionPermissionsService(prisma as never)

    await service.grant({ id: 'teacher-1', role: 'teacher' }, { sectionId: 'section-1', studentId: 'student-1' })

    expect(prisma.sessionPermission.upsert.mock.calls[0][0].where.sectionId_studentId).toEqual({
      sectionId: 'section-1',
      studentId: 'student-1',
    })
  })

  it('only returns the requesting student permission from the active list', async () => {
    const prisma = {
      enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
      sessionPermission: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const service = new SessionPermissionsService(prisma as never)

    await service.active({ id: 'student-1', role: 'student' }, 'section-1')

    expect(prisma.sessionPermission.findMany.mock.calls[0][0].where.studentId).toBe('student-1')
  })

  it('prevents students from checking another student permission', async () => {
    const service = new SessionPermissionsService({} as never)
    await expect(service.check({ id: 'student-1', role: 'student' }, 'section-1', 'student-2')).rejects.toThrow(
      ForbiddenException,
    )
  })
})
