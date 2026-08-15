import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { SectionRolesService } from './section-roles.service'

describe('SectionRolesService', () => {
  it('requires enrollment before assigning an officer role', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1' }) },
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      sectionRole: { upsert: jest.fn() },
    }
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }
    const service = new SectionRolesService(prisma as never)

    await expect(
      service.assign(
        { id: 'teacher-1', role: 'teacher' },
        { sectionId: 'section-1', studentId: 'student-1', role: 'qac' },
      ),
    ).rejects.toThrow(NotFoundException)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(tx.sectionRole.upsert).not.toHaveBeenCalled()
  })

  it('locks membership before assigning an officer role', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      section: { findUnique: jest.fn().mockResolvedValue({ teacherId: 'teacher-1' }) },
      enrollment: {
        findUnique: jest.fn().mockResolvedValue({ student: { fullName: 'Student One' } }),
      },
      sectionRole: { upsert: jest.fn().mockResolvedValue({ id: 'role-1' }) },
    }
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) }
    const service = new SectionRolesService(prisma as never)

    await service.assign(
      { id: 'teacher-1', role: 'teacher' },
      { sectionId: 'section-1', studentId: 'student-1', role: 'president' },
    )

    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.enrollment.findUnique.mock.invocationCallOrder[0],
    )
  })

  it('filters teacher student-role searches to owned sections', async () => {
    const prisma = {
      sectionRole: {
        findMany: jest.fn().mockResolvedValue([{ sectionId: 'owned' }, { sectionId: 'other' }]),
      },
      section: { findMany: jest.fn().mockResolvedValue([{ id: 'owned' }]) },
    }
    const service = new SectionRolesService(prisma as never)

    const result = await service.getForStudent({ id: 'teacher-1', role: 'teacher' }, 'student-1')

    expect(result).toEqual([{ sectionId: 'owned' }])
  })

  it('prevents students reading another student roles', async () => {
    const service = new SectionRolesService({} as never)
    await expect(service.getForStudent({ id: 'student-1', role: 'student' }, 'student-2')).rejects.toThrow(
      ForbiddenException,
    )
  })
})
