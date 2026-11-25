import { ConflictException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '../prisma/client'
import { SubjectsService } from './subjects.service'
import type { RequestUser } from '../auth/authenticated-principal'

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

  describe('subject detail section scope (BE-13)', () => {
    const departmentAdmin: RequestUser = {
      id: 'admin-2',
      role: 'super_admin',
      scope: 'department',
      department: 'CCIS',
    }
    const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

    function subjectWithSections() {
      return {
        id: 'subject-1',
        sections: [{ id: 'section-ccis', section: 'A', teacher: { id: 't-1', fullName: 'T', email: 't1@pup.edu.ph' } }],
      }
    }

    it('filters a department admin subject detail to their own department sections', async () => {
      const prisma = { subject: { findFirst: jest.fn().mockResolvedValue(subjectWithSections()) } }
      const service = new SubjectsService(prisma as never)

      const result = await service.findOne('subject-1', departmentAdmin)

      const sectionsWhere = prisma.subject.findFirst.mock.calls[0][0].include.sections.where
      expect(sectionsWhere).toEqual({ teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } })
      // The section rows the admin may not see are filtered by the DB, not here.
      expect(result.sections.map((section: { id: string }) => section.id)).toEqual(['section-ccis'])
    })

    it('keeps institution admins unscoped so legacy rows remain visible', async () => {
      const prisma = { subject: { findFirst: jest.fn().mockResolvedValue(subjectWithSections()) } }
      const service = new SubjectsService(prisma as never)

      await service.findOne('subject-1', institutionAdmin)

      expect(prisma.subject.findFirst.mock.calls[0][0].include.sections.where).toBeUndefined()
    })

    it('keeps the teacher and student section filters unchanged', async () => {
      const prisma = { subject: { findFirst: jest.fn().mockResolvedValue(subjectWithSections()) } }
      const service = new SubjectsService(prisma as never)

      await service.findOne('subject-1', teacher)
      expect(prisma.subject.findFirst.mock.calls[0][0].include.sections.where).toEqual({ teacherId: 'teacher-1' })

      await service.findOne('subject-1', student)
      expect(prisma.subject.findFirst.mock.calls[1][0].include.sections.where).toEqual({
        enrollments: { some: { studentId: 'student-1' } },
      })
    })
  })

  it('returns a conflict instead of deleting a subject with sections', async () => {
    const prisma = {
      subject: {
        findUnique: jest.fn().mockResolvedValue({ createdById: teacher.id, _count: { sections: 1 } }),
        delete: jest.fn(),
      },
    }
    const service = new SubjectsService(prisma as never)

    await expect(service.remove('subject-1', teacher)).rejects.toThrow(ConflictException)
    expect(prisma.subject.delete).not.toHaveBeenCalled()
  })

  it('maps a duplicate subject code to a conflict instead of a 500', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`code`)',
      { code: 'P2002', clientVersion: 'test' },
    )
    const prisma = {
      subject: { create: jest.fn().mockRejectedValue(prismaError) },
    }
    const service = new SubjectsService(prisma as never)

    await expect(service.create({ name: 'Intro', code: 'CCIS 3104' } as never, teacher)).rejects.toThrow(
      ConflictException,
    )
  })
})
