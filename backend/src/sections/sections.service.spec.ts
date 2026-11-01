import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { SectionsService } from './sections.service'

const settings = { getInteger: jest.fn().mockResolvedValue(14) }

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
    const service = new SectionsService(prisma as never, settings as never)

    await expect(service.findOne('section-1', { id: 'teacher-2', role: 'teacher' })).rejects.toThrow(ForbiddenException)
  })

  it('does not disclose enrollment codes to students', async () => {
    const prisma = {
      section: { findUnique: jest.fn().mockResolvedValue(section) },
      enrollment: { findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) },
    }
    const service = new SectionsService(prisma as never, settings as never)

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
    const service = new SectionsService(prisma as never, settings as never)

    await service.update(
      'section-1',
      { room: 'R2', schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00' }] },
      { id: 'teacher-1', role: 'teacher' },
    )

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.scheduleDay.deleteMany).toHaveBeenCalled()
    expect(tx.section.update).toHaveBeenCalled()
  })

  it('limits the enrollment list to sections owned by the teacher', async () => {
    const prisma = { enrollment: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new SectionsService(prisma as never, settings as never)

    await service.findEnrollments({ id: 'teacher-1', role: 'teacher' })

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { section: { teacherId: 'teacher-1' } },
      orderBy: { enrolledAt: 'asc' },
    })
  })

  it('limits the enrollment list to the authenticated student', async () => {
    const prisma = { enrollment: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new SectionsService(prisma as never, settings as never)

    await service.findEnrollments({ id: 'student-1', role: 'student' })

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      orderBy: { enrolledAt: 'asc' },
    })
  })

  it('limits department administrators to enrollments in their department', async () => {
    const prisma = { enrollment: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new SectionsService(prisma as never, settings as never)

    await service.findEnrollments({
      id: 'admin-1',
      role: 'super_admin',
      scope: 'department',
      department: 'CCIS',
    })

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { section: { teacher: { department: 'CCIS' } } },
      orderBy: { enrolledAt: 'asc' },
    })
  })

  it('increments the cached student count atomically when enrolling', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      enrollment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'enrollment-2' }),
      },
      enrollmentTombstone: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      section: { update: jest.fn().mockResolvedValue({}) },
    }
    const prisma = {
      section: { findUnique: jest.fn().mockResolvedValue(section) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'student-2', role: 'student' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    }
    const service = new SectionsService(prisma as never, settings as never)

    await service.enrollStudent('section-1', 'teacher-1', 'student-2')

    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.enrollment.findUnique.mock.invocationCallOrder[0],
    )
    // Explicit teacher enrollment lifts an enrollment tombstone inside the
    // guarded transaction (V3 re-admission authority).
    expect(tx.enrollmentTombstone.deleteMany).toHaveBeenCalledWith({
      where: { sectionId: 'section-1', studentId: 'student-2' },
    })
    expect(tx.enrollmentTombstone.deleteMany.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.enrollment.findUnique.mock.invocationCallOrder[0],
    )
    expect(tx.section.update).toHaveBeenCalledWith({
      where: { id: 'section-1' },
      data: { studentCount: { increment: 1 } },
    })
  })

  it('decrements the cached student count atomically when removing an enrollment', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      enrollment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      sectionRole: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sessionPermission: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      enrollmentTombstone: { upsert: jest.fn().mockResolvedValue({}) },
      section: { findUnique: jest.fn().mockResolvedValue(section), update: jest.fn().mockResolvedValue({}) },
    }
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    }
    const service = new SectionsService(prisma as never, settings as never)

    await service.removeStudent('section-1', 'teacher-1', 'student-1')

    // Section lock first, then the student/section pair lock, both before the
    // membership read so imports and enroll-code joins cannot race.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2)
    expect(tx.$executeRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.enrollment.findUnique.mock.invocationCallOrder[0],
    )
    expect(tx.sectionRole.deleteMany).toHaveBeenCalledWith({
      where: { sectionId: 'section-1', studentId: 'student-1' },
    })
    expect(tx.sessionPermission.updateMany).toHaveBeenCalledWith({
      where: { sectionId: 'section-1', studentId: 'student-1', isActive: true },
      data: { isActive: false },
    })
    expect(tx.enrollment.delete).toHaveBeenCalledWith({
      where: { studentId_sectionId: { studentId: 'student-1', sectionId: 'section-1' } },
    })
    // V3: the removal is recorded so an unexpired code cannot re-admit.
    expect(tx.enrollmentTombstone.upsert).toHaveBeenCalledWith({
      where: { sectionId_studentId: { sectionId: 'section-1', studentId: 'student-1' } },
      create: { sectionId: 'section-1', studentId: 'student-1', removedById: 'teacher-1' },
      update: { removedById: 'teacher-1', removedAt: expect.any(Date) },
    })
    expect(tx.enrollmentTombstone.upsert.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.enrollment.delete.mock.invocationCallOrder[0],
    )
    expect(tx.section.update).toHaveBeenCalledWith({
      where: { id: 'section-1' },
      data: { studentCount: { decrement: 1 } },
    })
  })

  it('uses the institution enrollment-code expiry setting when resetting a code', async () => {
    const prisma = {
      section: {
        findUnique: jest.fn().mockResolvedValue(section),
        update: jest.fn().mockResolvedValue(section),
      },
    }
    const configured = { getInteger: jest.fn().mockResolvedValue(30) }
    const service = new SectionsService(prisma as never, configured as never)

    await service.resetEnrollmentCode('section-1', 'teacher-1')

    expect(configured.getInteger).toHaveBeenCalledWith('enrollment_code_expiry_days', 14)
    const data = prisma.section.update.mock.calls[0][0].data as { enrollmentCodeExpiry: Date }
    const days = (data.enrollmentCodeExpiry.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
  })

  describe('enrollment tombstone (V3 anti-zombie)', () => {
    async function blockedResponse(promise: Promise<unknown>) {
      await expect(promise).rejects.toThrow(ForbiddenException)
      const settled = promise.catch((error) => error)
      const error = (await settled) as { getResponse?: () => unknown }
      return error.getResponse?.() ?? error
    }

    it('rejects a removed student at BOTH student enroll-code routes with a typed 403', async () => {
      const prisma = {
        section: {
          // enrollByCode looks up by code; enrollViaCode by id.
          findUnique: jest.fn().mockImplementation(async () => ({
            ...section,
            enrollmentCodeExpiry: null,
          })),
        },
        enrollmentTombstone: { findFirst: jest.fn().mockResolvedValue({ id: 'tombstone-1' }) },
      }
      const service = new SectionsService(prisma as never, settings as never)

      const byCode = await blockedResponse(service.enrollByCode('student-1', 'ABC123'))
      expect(byCode).toMatchObject({
        code: 'student_blocked_from_section',
        message: expect.stringContaining('removed from this section by the instructor'),
      })

      const viaCode = await blockedResponse(service.enrollViaCode('section-1', 'student-1', 'CODE123'))
      expect(viaCode).toMatchObject({ code: 'student_blocked_from_section' })

      // Enrollment must never be created for a blocked student.
      expect((prisma as { $transaction?: unknown }).$transaction).toBeUndefined()
      expect(prisma.enrollmentTombstone.findFirst).toHaveBeenCalledTimes(2)
    })

    it('does not consult the gate when the code itself is invalid or expired', async () => {
      const prisma = {
        section: {
          findUnique: jest.fn().mockResolvedValue({
            ...section,
            enrollmentCodeExpiry: new Date(Date.now() - 60_000),
          }),
        },
        enrollmentTombstone: { findFirst: jest.fn() },
      }
      const service = new SectionsService(prisma as never, settings as never)

      await expect(service.enrollByCode('student-1', 'ABC123')).rejects.toThrow(BadRequestException)
      // Expired-code rejection wins: the gate only fires for otherwise-valid codes.
      expect(prisma.enrollmentTombstone.findFirst).not.toHaveBeenCalled()
    })

    it('allows an unblocked student through the gate without writing tombstones', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        enrollment: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'enrollment-new' }),
        },
        enrollmentTombstone: {
          findFirst: jest.fn().mockResolvedValue(null),
          deleteMany: jest.fn(),
          upsert: jest.fn(),
        },
        section: { update: jest.fn().mockResolvedValue({}) },
      }
      const prisma = {
        section: { findUnique: jest.fn().mockResolvedValue({ ...section, enrollmentCodeExpiry: null }) },
        enrollmentTombstone: { findFirst: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      }
      const service = new SectionsService(prisma as never, settings as never)

      const enrollment = await service.enrollByCode('student-9', 'ABC123')

      expect(enrollment).toMatchObject({ id: 'enrollment-new' })
      // Student code enrollment must never clear or write tombstones.
      expect(tx.enrollmentTombstone.deleteMany).not.toHaveBeenCalled()
      expect(tx.enrollmentTombstone.upsert).not.toHaveBeenCalled()
    })

    it('teacher enrollment clears the tombstone before creating the enrollment', async () => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        enrollment: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'enrollment-re' }),
        },
        enrollmentTombstone: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        section: { update: jest.fn().mockResolvedValue({}) },
      }
      const prisma = {
        section: { findUnique: jest.fn().mockResolvedValue(section) },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1', role: 'student' }) },
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      }
      const service = new SectionsService(prisma as never, settings as never)

      await service.enrollStudent('section-1', 'teacher-1', 'student-1')

      expect(tx.enrollmentTombstone.deleteMany).toHaveBeenCalledWith({
        where: { sectionId: 'section-1', studentId: 'student-1' },
      })
    })
  })
})
