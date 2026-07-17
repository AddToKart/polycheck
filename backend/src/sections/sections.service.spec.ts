import { ForbiddenException } from '@nestjs/common'
import { SectionsService } from './sections.service'

const section = {
  id: 'section-1',
  subjectId: 'subject-1',
  section: 'A',
  room: 'R1',
  semester: '2026',
  teacherId: 'teacher-1',
  enrollmentCode: 'CODE123',
  enrollmentCodeExpiry: new Date(),
  studentCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  subject: { id: 'subject-1', name: 'Subject', code: 'SUBJ' },
  teacher: { id: 'teacher-1', fullName: 'Teacher', department: 'CCIS' },
  schedule: [],
}

describe('SectionsService', () => {
  it('prevents teachers from opening another teacher section', async () => {
    const prisma = { section: { findUnique: jest.fn().mockResolvedValue(section) } }
    const service = new SectionsService(prisma as never)

    await expect(service.findOne('section-1', { id: 'teacher-2', role: 'teacher' })).rejects.toThrow(ForbiddenException)
  })

  it('does not disclose enrollment codes to students', async () => {
    const prisma = {
      section: { findUnique: jest.fn().mockResolvedValue(section) },
      enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
    }
    const service = new SectionsService(prisma as never)

    const result = await service.findOne('section-1', { id: 'student-1', role: 'student' })

    expect(result).not.toHaveProperty('enrollmentCode')
  })

  it('updates schedules and section fields in one transaction', async () => {
    const tx = {
      scheduleDay: { deleteMany: jest.fn(), createMany: jest.fn() },
      section: { update: jest.fn().mockResolvedValue(section) },
    }
    const prisma = {
      section: { findUnique: jest.fn().mockResolvedValue(section) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    }
    const service = new SectionsService(prisma as never)

    await service.update(
      'section-1',
      { room: 'R2', schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00' }] },
      { id: 'teacher-1', role: 'teacher' },
    )

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.scheduleDay.deleteMany).toHaveBeenCalled()
    expect(tx.section.update).toHaveBeenCalled()
  })
})
