import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { UsersService } from './users.service'
import type { RequestUser } from '../auth/authenticated-principal'

const registrar: RequestUser = {
  id: 'reg-1',
  role: 'teacher',
  department: 'CCIS',
  isUserRegistrar: true,
}
const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const plainTeacher: RequestUser = { id: 'teacher-1', role: 'teacher', department: 'CCIS' }

const teacherTarget = {
  id: 't-9',
  role: 'teacher',
  department: 'CCIS',
  isItCoordinator: false,
  isDepartmentHead: false,
  isUserRegistrar: false,
}

function buildPrisma(target: unknown = teacherTarget) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'created-1', role: 'student', department: 'CCIS' }),
      update: jest.fn().mockResolvedValue({ id: 't-9', role: 'teacher', department: 'CCIS' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  }
}

describe('UsersService administrative designations', () => {
  it('rejects a registrar submitting a designation before touching the row', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    const error = (await service.updateUser('t-9', { isItCoordinator: true }, registrar).then(
      () => null,
      (caught: unknown) => caught,
    )) as ForbiddenException

    expect(error).toBeInstanceOf(ForbiddenException)
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'designations_admin_only' }))
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('lets a super admin assign a designation and records the diff', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    await service.updateUser('t-9', { isItCoordinator: true }, institutionAdmin)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isItCoordinator: true }) }),
    )
    const designationAudit = prisma.auditLog.create.mock.calls.find(
      (call) => call[0].data.action === 'admin.user.designations_changed',
    )
    expect(designationAudit?.[0].data.metadata).toEqual(
      expect.objectContaining({
        targetRole: 'teacher',
        changes: [{ field: 'isItCoordinator', from: false, to: true }],
      }),
    )
  })

  it('rejects designations on student accounts', async () => {
    const prisma = buildPrisma({ id: 's-1', role: 'student', department: 'CCIS' })
    const service = new UsersService(prisma as never)

    await expect(service.updateUser('s-1', { isUserRegistrar: true }, institutionAdmin)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('requires a department before assigning head or registrar designations', async () => {
    const prisma = buildPrisma({ ...teacherTarget, department: null })
    const service = new UsersService(prisma as never)

    await expect(service.updateUser('t-9', { isDepartmentHead: true }, institutionAdmin)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('lets a registrar edit a department target but not move it to another department', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    await service.updateUser('t-9', { fullName: 'Renamed Teacher' }, registrar)
    expect(prisma.user.update).toHaveBeenCalled()

    await expect(service.updateUser('t-9', { department: 'CAF' }, registrar)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects registrar edits outside their department', async () => {
    const prisma = buildPrisma({ ...teacherTarget, department: 'CAF' })
    const service = new UsersService(prisma as never)

    await expect(service.updateUser('t-9', { fullName: 'Renamed' }, registrar)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects registrar email changes and capability overrides', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    await expect(service.updateUser('t-9', { email: 'new@pup.edu.ph' }, registrar)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    await expect(service.updateUser('t-9', { canResetStudentPasswords: false }, registrar)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects plain teachers from any account administration', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    await expect(service.updateUser('t-9', { fullName: 'Nope' }, plainTeacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('pins the registrar user directory to their department and hides super admins', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    await service.findAll(registrar, {})

    const where = prisma.user.findMany.mock.calls[0][0].where
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { department: { equals: 'CCIS', mode: 'insensitive' } },
        { role: { not: 'super_admin' } },
      ]),
    )
  })

  it('forces a registrar-created student into the registrar department', async () => {
    const prisma = buildPrisma()
    const service = new UsersService(prisma as never)

    await service.createStudent(
      {
        fullName: 'Registrar Created Student',
        studentId: '2026-09999-MN-0',
        department: 'CCIS',
        program: 'BS Computer Science',
        yearLevel: 1,
      },
      registrar,
    )

    expect(prisma.user.create.mock.calls[0][0].data.department).toBe('CCIS')
    const audit = prisma.auditLog.create.mock.calls[0][0].data
    expect(audit.action).toBe('admin.user.created')
    expect(audit.metadata).toEqual(expect.objectContaining({ forcedDepartment: true }))
  })
})
