import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { compare } from 'bcryptjs'
import { UsersService } from './users.service'
import type { RequestUser } from '../auth/authenticated-principal'

describe('UsersService', () => {
  const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
  const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
  const departmentAdmin: RequestUser = { id: 'admin-2', role: 'super_admin', scope: 'department', department: 'CCIS' }

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
    expect(updateData.mustChangePassword).toBe(true)
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

  describe('user directory', () => {
    it('composes role, search, department, status, and pagination filters', async () => {
      const prisma = {
        user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      }
      const service = new UsersService(prisma as never)

      const result = await service.findAll(
        institutionAdmin,
        { role: 'teacher', q: '  ada ', department: 'CCIS', status: 'inactive' },
        { limit: 20, offset: 5 },
      )

      const query = prisma.user.findMany.mock.calls[0][0]
      expect(query.take).toBe(20)
      expect(query.skip).toBe(5)
      expect(query.select).toEqual(expect.objectContaining({ mustChangePassword: true }))
      expect(query.where.AND).toEqual(
        expect.arrayContaining([
          { role: 'teacher' },
          { isActive: false },
          { department: { equals: 'CCIS', mode: 'insensitive' } },
          {
            OR: [
              { fullName: { contains: 'ada', mode: 'insensitive' } },
              { email: { contains: 'ada', mode: 'insensitive' } },
              { studentId: { contains: 'ada', mode: 'insensitive' } },
            ],
          },
        ]),
      )
      expect(prisma.user.count).toHaveBeenCalledWith({ where: query.where })
      expect(result).toEqual({ data: [], total: 0, limit: 20, offset: 5, hasMore: false })
    })

    it('keeps a department admin inside their scope even when the filter asks for another department', async () => {
      const prisma = {
        user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      }
      const service = new UsersService(prisma as never)

      await service.findAll(departmentAdmin, { department: 'CAF', role: 'student' }, { limit: 50, offset: 0 })

      const where = prisma.user.findMany.mock.calls[0][0].where
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { department: 'CCIS' },
          { department: { equals: 'CAF', mode: 'insensitive' } },
          { role: 'student' },
        ]),
      )
    })

    it('rejects non super admins before querying users', async () => {
      const prisma = { user: { findMany: jest.fn(), count: jest.fn() } }
      const service = new UsersService(prisma as never)

      await expect(service.findAll(teacher)).rejects.toThrow(ForbiddenException)
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })
  })

  describe('profile editing', () => {
    it('updates whitelisted fields, normalizes input, and audits field names only', async () => {
      const updated = { id: 'teacher-1', fullName: 'Ada Lovelace', email: 'ada@pup.edu.ph', department: 'CCIS' }
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue(updated),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const events = { emit: jest.fn() }
      const service = new UsersService(prisma as never, events as never)

      const result = await service.updateUser(
        'teacher-1',
        { fullName: '  Ada Lovelace  ', email: ' ADA@PUP.EDU.PH ', department: ' CCIS ' },
        institutionAdmin,
      )

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        fullName: 'Ada Lovelace',
        email: 'ada@pup.edu.ph',
        department: 'CCIS',
      })
      const audit = prisma.auditLog.create.mock.calls[0][0].data
      expect(audit).toMatchObject({
        actorId: 'admin-1',
        action: 'admin.user.updated',
        entityType: 'user',
        entityId: 'teacher-1',
      })
      expect(audit.metadata.changedFields).toEqual(expect.arrayContaining(['fullName', 'email', 'department']))
      expect(JSON.stringify(audit.metadata)).not.toContain('Ada Lovelace')
      expect(events.emit).not.toHaveBeenCalled()
      expect(result).toBe(updated)
    })

    it('refuses to edit super admin accounts', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-2', role: 'super_admin', department: null }) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.updateUser('admin-2', { fullName: 'Renamed Admin' }, institutionAdmin)).rejects.toThrow(
        'Super Admin accounts cannot be edited here',
      )
    })

    it('enforces department scope', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'teacher-2', role: 'teacher', department: 'CAF' }),
          update: jest.fn(),
        },
      }
      const service = new UsersService(prisma as never)

      await expect(service.updateUser('teacher-2', { fullName: 'Outside Scope' }, departmentAdmin)).rejects.toThrow(
        ForbiddenException,
      )
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it.each([
      ['a student email', { id: 'student-1', role: 'student', department: 'CCIS' }, { email: 'student@pup.edu.ph' }],
      ['teacher program fields', { id: 'teacher-1', role: 'teacher', department: 'CCIS' }, { program: 'BSIT' }],
      ['teacher year level', { id: 'teacher-1', role: 'teacher', department: 'CCIS' }, { yearLevel: 2 }],
    ])('rejects wrong-role fields: %s', async (_label, target, dto) => {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(target), update: jest.fn() } }
      const service = new UsersService(prisma as never)

      await expect(service.updateUser(target.id, dto, institutionAdmin)).rejects.toThrow(BadRequestException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('rejects clearing a student department', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'student-1', role: 'student', department: 'CCIS' }),
          update: jest.fn(),
        },
      }
      const service = new UsersService(prisma as never)

      await expect(service.updateUser('student-1', { department: '   ' }, institutionAdmin)).rejects.toThrow(
        'Student accounts require a department',
      )
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('rejects an email already used by another account', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }),
          findFirst: jest.fn().mockResolvedValue({ id: 'teacher-2' }),
          update: jest.fn(),
        },
      }
      const service = new UsersService(prisma as never)

      await expect(service.updateUser('teacher-1', { email: 'taken@pup.edu.ph' }, institutionAdmin)).rejects.toThrow(
        ConflictException,
      )
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('rejects empty edits and keeps the mutation alive when the audit write fails', async () => {
      const updated = { id: 'teacher-1', fullName: 'Ada Lovelace' }
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }),
          update: jest.fn().mockResolvedValue(updated),
        },
        auditLog: { create: jest.fn().mockRejectedValue(new Error('audit unavailable')) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.updateUser('teacher-1', {}, institutionAdmin)).rejects.toThrow(BadRequestException)
      await expect(service.updateUser('teacher-1', { fullName: 'Ada Lovelace' }, institutionAdmin)).resolves.toBe(
        updated,
      )
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('role changes', () => {
    it('rejects changing the actor own role', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'teacher', department: 'CCIS' }) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('admin-1', 'student', institutionAdmin)).rejects.toThrow(
        'You cannot change your own role',
      )
    })

    it('rejects changing a super admin role', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-2', role: 'super_admin', department: null }) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('admin-2', 'teacher', institutionAdmin)).rejects.toThrow(
        'Super Admin accounts cannot be role-changed here',
      )
    })

    it('blocks demoting a teacher who still owns sections', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }) },
        section: { count: jest.fn().mockResolvedValue(2) },
        userUpdate: jest.fn(),
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('teacher-1', 'student', institutionAdmin)).rejects.toThrow(ConflictException)
      expect(prisma.section.count).toHaveBeenCalledWith({ where: { teacherId: 'teacher-1' } })
    })

    it('requires a department before promoting a student to teacher', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'student-1',
            role: 'student',
            department: null,
            email: 'student@pup.edu.ph',
          }),
        },
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('student-1', 'teacher', institutionAdmin)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('requires an email before promoting a student to teacher', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'student-1',
            role: 'student',
            department: 'CCIS',
            email: null,
          }),
        },
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('student-1', 'teacher', institutionAdmin)).rejects.toThrow(
        'An email is required before changing a student to a teacher',
      )
    })

    it('promotes a student with a department and invalidates live sessions', async () => {
      const updated = { id: 'student-1', role: 'teacher' }
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'student-1',
            role: 'student',
            department: 'CCIS',
            email: 'student@pup.edu.ph',
          }),
          update: jest.fn().mockResolvedValue(updated),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const events = { emit: jest.fn() }
      const service = new UsersService(prisma as never, events as never)

      await expect(service.changeUserRole('student-1', 'teacher', institutionAdmin)).resolves.toBe(updated)

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ role: 'teacher' })
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'admin.user.role_changed',
        entityType: 'user',
        entityId: 'student-1',
        metadata: { before: 'student', after: 'teacher' },
      })
      expect(events.emit).toHaveBeenCalledWith('auth.session-replaced', {
        userId: 'student-1',
        reason: 'role_changed',
      })
    })

    it('rejects demoting a teacher without student identity fields', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'teacher-1',
            role: 'teacher',
            department: 'CCIS',
            studentId: null,
            program: null,
            yearLevel: null,
          }),
        },
        section: { count: jest.fn().mockResolvedValue(0) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('teacher-1', 'student', institutionAdmin)).rejects.toThrow(
        'no student identity fields',
      )
    })

    it('demotes a teacher with no sections and complete student identity fields', async () => {
      const updated = { id: 'teacher-1', role: 'student' }
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'teacher-1',
            role: 'teacher',
            department: 'CCIS',
            studentId: '2024-00002-MN-0',
            program: 'BSIT',
            yearLevel: 2,
          }),
          update: jest.fn().mockResolvedValue(updated),
        },
        section: { count: jest.fn().mockResolvedValue(0) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const service = new UsersService(prisma as never, { emit: jest.fn() } as never)

      await expect(service.changeUserRole('teacher-1', 'student', institutionAdmin)).resolves.toBe(updated)
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ role: 'student' })
    })

    it('rejects a no-op role change', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.changeUserRole('teacher-1', 'teacher', institutionAdmin)).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('super admin provisioning', () => {
    it('promotes an existing teacher without changing department or password state', async () => {
      const updated = { id: 'teacher-1', role: 'super_admin', department: 'CCIS' }
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1', role: 'teacher', department: 'CCIS' }),
          update: jest.fn().mockResolvedValue(updated),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const events = { emit: jest.fn() }
      const service = new UsersService(prisma as never, events as never)

      await expect(service.createAdmin({ userId: 'teacher-1' }, institutionAdmin)).resolves.toBe(updated)

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ role: 'super_admin', scope: 'institution' })
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'admin.user.promoted',
        entityType: 'user',
        entityId: 'teacher-1',
      })
      expect(events.emit).toHaveBeenCalledWith('auth.session-replaced', {
        userId: 'teacher-1',
        reason: 'role_changed',
      })
    })

    it('creates a fresh super admin with a hashed password and auth account', async () => {
      const created = { id: 'admin-3', fullName: 'New Admin', email: 'admin@pup.edu.ph', role: 'super_admin' }
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const service = new UsersService(prisma as never)

      await expect(
        service.createAdmin(
          {
            fullName: ' New Admin ',
            email: ' ADMIN@PUP.EDU.PH ',
            password: 'Temporary1!Secure',
            department: ' CCIS ',
          },
          institutionAdmin,
        ),
      ).resolves.toBe(created)

      const data = prisma.user.create.mock.calls[0][0].data
      expect(data).toEqual(
        expect.objectContaining({
          fullName: 'New Admin',
          email: 'admin@pup.edu.ph',
          department: 'CCIS',
          role: 'super_admin',
          scope: 'institution',
        }),
      )
      expect(data.password).not.toBe('Temporary1!Secure')
      await expect(compare('Temporary1!Secure', data.password)).resolves.toBe(true)
      expect(data.authAccounts.create).toEqual(
        expect.objectContaining({ providerId: 'credential', password: data.password }),
      )
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'admin.user.created',
        entityType: 'user',
        entityId: 'admin-3',
      })
    })

    it.each([
      [
        'both modes',
        { userId: 'teacher-1', fullName: 'New Admin', email: 'new@pup.edu.ph', password: 'Temporary1!Secure' },
      ],
      ['neither mode', {}],
      ['an incomplete fresh account', { fullName: 'New Admin', email: 'new@pup.edu.ph' }],
      ['a weak password', { fullName: 'New Admin', email: 'new@pup.edu.ph', password: 'weak' }],
    ])('rejects %s', async (_label, dto) => {
      const service = new UsersService({} as never)
      await expect(service.createAdmin(dto, institutionAdmin)).rejects.toThrow(BadRequestException)
    })

    it('forbids department-scoped admins from creating administrators', async () => {
      const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } }
      const service = new UsersService(prisma as never)

      await expect(service.createAdmin({ userId: 'teacher-1' }, departmentAdmin)).rejects.toThrow(ForbiddenException)
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('rejects promoting a non-teacher account', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1', role: 'student', department: 'CCIS' }) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.createAdmin({ userId: 'student-1' }, institutionAdmin)).rejects.toThrow(BadRequestException)
    })

    it('rejects self promotion', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'teacher', department: 'CCIS' }) },
      }
      const service = new UsersService(prisma as never)

      await expect(service.createAdmin({ userId: 'admin-1' }, institutionAdmin)).rejects.toThrow(
        'You cannot promote your own account',
      )
    })

    it('rejects a fresh account whose email is already in use', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'existing' }),
          create: jest.fn(),
        },
      }
      const service = new UsersService(prisma as never)

      await expect(
        service.createAdmin(
          { fullName: 'New Admin', email: 'taken@pup.edu.ph', password: 'Temporary1!Secure' },
          institutionAdmin,
        ),
      ).rejects.toThrow(ConflictException)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })
  })
})
