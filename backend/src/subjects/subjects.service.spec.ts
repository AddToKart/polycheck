import { ForbiddenException } from '@nestjs/common'
import { SubjectsService } from './subjects.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

describe('SubjectsService', () => {
  const student: RequestUser = { id: 'student-1', role: 'student' }
  const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }

  it('filters a student subject to enrolled sections and removes enrollment codes', async () => {
    const prisma = {
      subject: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'subject-1',
          sections: [{ id: 'section-1', enrollmentCode: 'SECRET1', enrollmentCodeExpiry: new Date() }],
        }),
      },
    }
    const service = new SubjectsService(prisma as never)

    const result = await service.findOne('subject-1', student)

    expect(prisma.subject.findFirst.mock.calls[0][0].where.sections.some.enrollments.some.studentId).toBe('student-1')
    expect(result.sections[0]).not.toHaveProperty('enrollmentCode')
  })

  it('prevents teachers from updating subjects created by another account', async () => {
    const prisma = {
      subject: { findUnique: jest.fn().mockResolvedValue({ createdById: 'teacher-2' }), update: jest.fn() },
    }
    const service = new SubjectsService(prisma as never)

    await expect(service.update('subject-1', { name: 'Changed' }, teacher)).rejects.toThrow(ForbiddenException)
    expect(prisma.subject.update).not.toHaveBeenCalled()
  })

  it('applies department scope for non-institution administrators', async () => {
    const prisma = { subject: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new SubjectsService(prisma as never)

    await service.findAll({ id: 'admin-1', role: 'super_admin', scope: 'department', department: 'CCIS' })

    expect(prisma.subject.findMany.mock.calls[0][0].where.OR).toEqual(expect.any(Array))
  })
})
