import { ConflictException, ForbiddenException } from '@nestjs/common'
import { compare } from 'bcryptjs'
import { UsersService } from './users.service'
import type { RequestUser } from '../auth/authenticated-principal'

describe('UsersService', () => {
  const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
  const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }

  it('limits teacher student search to enrollments in that teacher sections', async () => {
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new UsersService(prisma as never)

    await service.findStudents(teacher)

    expect(prisma.user.findMany.mock.calls[0][0].where.enrollments.some.section.teacherId).toBe('teacher-1')
  })

  it('returns a profile without password or signing key material', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          role: 'student',
          password: 'hash',
          authEmail: 'internal@auth.polycheck.invalid',
          authEmailVerified: true,
          authVersion: 3,
          teacherPublicKey: 'public',
          enrollments: [{ sectionId: 'section-1' }],
        }),
      },
    }
    const service = new UsersService(prisma as never)

    const result = await service.findOne('student-1', { id: 'student-1', role: 'student' })

    expect(result).not.toHaveProperty('password')
    expect(result).not.toHaveProperty('authEmail')
    expect(result).not.toHaveProperty('authEmailVerified')
    expect(result).not.toHaveProperty('authVersion')
    expect(result).not.toHaveProperty('teacherPublicKey')
    expect(result.enrolledSectionIds).toEqual(['section-1'])
  })

  it('prevents teachers from opening students outside their sections', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'student-2', role: 'student', enrollments: [] }) },
      enrollment: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const service = new UsersService(prisma as never)

    await expect(service.findOne('student-2', teacher)).rejects.toThrow(ForbiddenException)
  })

  it('creates a normalized student account without returning password material', async () => {
    const created = {
      id: 'student-1',
      studentId: '2026-00001-MN-0',
      fullName: 'Test Student',
      email: 'student@iskolarngbayan.pup.edu.ph',
      role: 'student',
      program: 'BS Computer Science',
      yearLevel: 1,
      department: 'CCIS',
      isActive: true,
    }
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    }
    const service = new UsersService(prisma as never)

    const result = await service.createStudent(
      {
        fullName: '  Test Student  ',
        studentId: '2026-00001-MN-0',
        email: 'STUDENT@iskolarngbayan.pup.edu.ph',
        password: 'Temporary1!Secure',
        program: '  BS Computer Science  ',
        yearLevel: 1,
        department: 'CCIS',
      },
      institutionAdmin,
    )

    const createData = prisma.user.create.mock.calls[0][0].data
    expect(createData).toEqual(
      expect.objectContaining({
        fullName: 'Test Student',
        studentId: '2026-00001-MN-0',
        email: 'student@iskolarngbayan.pup.edu.ph',
        program: 'BS Computer Science',
        role: 'student',
      }),
    )
    expect(createData.password).not.toBe('Temporary1!Secure')
    await expect(compare('Temporary1!Secure', createData.password)).resolves.toBe(true)
    expect(result).toEqual({ ...created, enrolledSectionIds: [] })
    expect(result).not.toHaveProperty('password')
  })

  it('rejects duplicate student identifiers before attempting creation', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-student' }),
        create: jest.fn(),
      },
    }
    const service = new UsersService(prisma as never)

    await expect(
      service.createStudent(
        {
          fullName: 'Test Student',
          studentId: '2026-00001-MN-0',
          password: 'Temporary1!Secure',
          program: 'BS Computer Science',
          yearLevel: 1,
          department: 'CCIS',
        },
        institutionAdmin,
      ),
    ).rejects.toThrow(ConflictException)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('prevents department admins from creating accounts outside their scope', async () => {
    const prisma = { user: { findFirst: jest.fn(), create: jest.fn() } }
    const service = new UsersService(prisma as never)

    await expect(
      service.createStudent(
        {
          fullName: 'Test Student',
          studentId: '2026-00001-MN-0',
          password: 'Temporary1!Secure',
          program: 'BS Computer Science',
          yearLevel: 1,
          department: 'CAF',
        },
        { id: 'admin-2', role: 'super_admin', scope: 'department', department: 'CCIS' },
      ),
    ).rejects.toThrow(ForbiddenException)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it('resets a managed user password and revokes all existing sessions', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }),
        update: jest.fn().mockResolvedValue({ id: 'teacher-1' }),
      },
      authAccount: { upsert: jest.fn().mockResolvedValue({}) },
      authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    }
    const service = new UsersService(prisma as never)

    await expect(service.resetPassword('teacher-1', 'Replacement1!Secure', institutionAdmin)).resolves.toEqual({
      message: 'Password reset successfully',
      userId: 'teacher-1',
    })

    const updateData = prisma.user.update.mock.calls[0][0].data
    expect(updateData.authVersion).toEqual({ increment: 1 })
    expect(updateData.password).not.toBe('Replacement1!Secure')
    await expect(compare('Replacement1!Secure', updateData.password)).resolves.toBe(true)
    expect(prisma.authAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId_accountId: { providerId: 'credential', accountId: 'teacher-1' } },
      }),
    )
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'teacher-1' } })
  })

  it('does not allow super admin passwords to be reset through user management', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'admin-2', role: 'super_admin', department: null }),
        update: jest.fn(),
      },
    }
    const service = new UsersService(prisma as never)

    await expect(service.resetPassword('admin-2', 'Replacement1!Secure', institutionAdmin)).rejects.toThrow(
      ForbiddenException,
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('enforces super-admin authorization inside the service layer', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'student-1', role: 'student', department: 'CCIS' }),
        update: jest.fn(),
      },
    }
    const service = new UsersService(prisma as never)

    await expect(
      service.resetPassword('student-1', 'Replacement1!Secure', {
        id: 'teacher-1',
        role: 'teacher',
        department: 'CCIS',
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
