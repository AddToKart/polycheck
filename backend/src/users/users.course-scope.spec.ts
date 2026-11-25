import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { UsersService } from './users.service'
import type { RequestUser } from '../auth/authenticated-principal'

const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const allCoursesRegistrar: RequestUser = {
  id: 'reg-all',
  role: 'teacher',
  department: 'Unspecified',
  isUserRegistrar: true,
  managesAllCourses: true,
}
const bsitRegistrar: RequestUser = {
  id: 'reg-bsit',
  role: 'teacher',
  department: 'Unspecified',
  isUserRegistrar: true,
  managedCourses: ['BSIT'],
}
const unscopedRegistrar: RequestUser = { id: 'reg-none', role: 'teacher', department: 'CCIS', isUserRegistrar: true }

const teacherTarget = {
  id: 't-9',
  role: 'teacher',
  department: null,
  program: null,
  isItCoordinator: false,
  isDepartmentHead: false,
  isUserRegistrar: false,
  managedCourses: [] as string[],
  managesAllCourses: false,
}
const bsitStudent = { id: 's-1', role: 'student', department: 'BSIT', program: 'BSIT' }
const bshmStudent = { id: 's-2', role: 'student', department: 'BSHM', program: 'BSHM' }

function buildPrisma(target: unknown = teacherTarget) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'created-1', role: 'student', department: 'BSIT' }),
      update: jest.fn().mockResolvedValue({ id: 't-9', role: 'teacher', department: null }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  }
}

const designationAudit = (prisma: ReturnType<typeof buildPrisma>) =>
  prisma.auditLog.create.mock.calls.find((call) => call[0].data.action === 'admin.user.designations_changed')?.[0].data
    .metadata

describe('UsersService course scope', () => {
  const original = process.env.COURSE_SCOPE_MODE
  afterEach(() => {
    if (original === undefined) delete process.env.COURSE_SCOPE_MODE
    else process.env.COURSE_SCOPE_MODE = original
  })

  describe('designee course scope writes', () => {
    beforeEach(() => {
      process.env.COURSE_SCOPE_MODE = 'course'
    })

    it('lets a super admin set normalized courses and records the before/after in the designation audit', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)

      await service.updateUser(
        't-9',
        { isDepartmentHead: true, managedCourses: ['bs information technology', 'BSIT', 'BSHM'] },
        institutionAdmin,
      )

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDepartmentHead: true, managedCourses: ['BSIT', 'BSHM'] }),
        }),
      )
      expect(designationAudit(prisma)).toEqual(
        expect.objectContaining({
          courseScope: {
            from: { managedCourses: [], managesAllCourses: false },
            to: { managedCourses: ['BSIT', 'BSHM'], managesAllCourses: false },
          },
        }),
      )
    })

    it('records a Head of Academic Programs toggle', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)

      await service.updateUser('t-9', { managesAllCourses: true }, institutionAdmin)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ managesAllCourses: true }) }),
      )
      expect(designationAudit(prisma)).toEqual(
        expect.objectContaining({
          courseScope: expect.objectContaining({ to: { managedCourses: [], managesAllCourses: true } }),
        }),
      )
    })

    it('writes no scope audit when the scope did not actually change', async () => {
      const prisma = buildPrisma({ ...teacherTarget, managedCourses: ['BSIT'] })
      const service = new UsersService(prisma as never)

      await service.updateUser('t-9', { managedCourses: ['bsit'], fullName: 'Renamed' }, institutionAdmin)

      expect(designationAudit(prisma)).toBeUndefined()
    })

    it('rejects unknown courses and oversized lists before touching the row', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)

      await expect(
        service.updateUser('t-9', { managedCourses: ['BSIT', 'BS Basket Weaving'] }, institutionAdmin),
      ).rejects.toThrow(/Unknown course: BS Basket Weaving/)
      await expect(
        service.updateUser('t-9', { managedCourses: Array.from({ length: 21 }, () => 'BSIT') }, institutionAdmin),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('treats scope writes like designation writes: registrars are refused (designations_admin_only)', async () => {
      for (const body of [{ managedCourses: ['BSIT'] }, { managesAllCourses: true }]) {
        const prisma = buildPrisma()
        const service = new UsersService(prisma as never)
        const error = (await service.updateUser('t-9', body, allCoursesRegistrar).then(
          () => null,
          (caught: unknown) => caught,
        )) as ForbiddenException
        expect(error).toBeInstanceOf(ForbiddenException)
        expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'designations_admin_only' }))
        expect(prisma.user.update).not.toHaveBeenCalled()
      }
    })

    it('only teacher accounts can carry a scope', async () => {
      const prisma = buildPrisma(bsitStudent)
      const service = new UsersService(prisma as never)
      await expect(service.updateUser('s-1', { managedCourses: ['BSIT'] }, institutionAdmin)).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })

    it('does not require a department to designate a head in course mode (the campus has none)', async () => {
      process.env.COURSE_SCOPE_MODE = 'course'
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)
      await expect(
        service.updateUser('t-9', { isDepartmentHead: true, managedCourses: ['BSIT'] }, institutionAdmin),
      ).resolves.toBeDefined()
    })

    it('still requires a department in legacy mode', async () => {
      delete process.env.COURSE_SCOPE_MODE
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)
      await expect(service.updateUser('t-9', { isDepartmentHead: true }, institutionAdmin)).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })
  })

  describe('registrar scope in course mode', () => {
    beforeEach(() => {
      process.env.COURSE_SCOPE_MODE = 'course'
    })

    it('lists every non-super-admin account for a campus-wide registrar', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)
      await service.findAll(allCoursesRegistrar)
      const where = prisma.user.findMany.mock.calls[0][0].where
      expect(where.AND).toEqual(expect.arrayContaining([{}, { role: { not: 'super_admin' } }]))
    })

    it('pins a course registrar to students of their courses', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)
      await service.findAll(bsitRegistrar)
      const where = prisma.user.findMany.mock.calls[0][0].where
      expect(where.AND).toContainEqual({
        role: 'student',
        OR: [{ program: { equals: 'BSIT', mode: 'insensitive' } }],
      })
    })

    it('fails closed for a registrar with no courses', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)
      await service.findAll(unscopedRegistrar)
      expect(prisma.user.findMany.mock.calls[0][0].where.AND).toContainEqual({ id: { in: [] } })
    })

    it('lets a pinned registrar edit in-scope students but not other courses or teachers', async () => {
      const inScope = buildPrisma(bsitStudent)
      await expect(
        new UsersService(inScope as never).updateUser('s-1', { fullName: 'New Name' }, bsitRegistrar),
      ).resolves.toBeDefined()

      const otherCourse = buildPrisma(bshmStudent)
      await expect(
        new UsersService(otherCourse as never).updateUser('s-2', { fullName: 'New Name' }, bsitRegistrar),
      ).rejects.toBeInstanceOf(ForbiddenException)

      const teacher = buildPrisma(teacherTarget)
      await expect(
        new UsersService(teacher as never).updateUser('t-9', { fullName: 'New Name' }, bsitRegistrar),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('lets a campus-wide registrar edit a teacher and any student', async () => {
      for (const target of [teacherTarget, bshmStudent]) {
        const prisma = buildPrisma(target)
        await expect(
          new UsersService(prisma as never).updateUser(
            String(target.id),
            { fullName: 'New Name' },
            allCoursesRegistrar,
          ),
        ).resolves.toBeDefined()
      }
    })

    it('blocks a pinned registrar from moving a student into another course', async () => {
      const prisma = buildPrisma(bsitStudent)
      await expect(
        new UsersService(prisma as never).updateUser('s-1', { program: 'BSHM' }, bsitRegistrar),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('normalizes the program on student creation and fills the legacy department with the course code', async () => {
      const prisma = buildPrisma()
      const service = new UsersService(prisma as never)
      await service.createStudent(
        {
          fullName: 'Irregular Student',
          studentId: '2024-00077-MN-0',
          program: 'bs hospitality management',
          yearLevel: 2,
        } as never,
        allCoursesRegistrar,
      )
      expect(prisma.user.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ program: 'BSHM', department: 'BSHM' }),
      )
    })

    it('refuses to let a pinned registrar create a student outside their courses or any teacher', async () => {
      const service = new UsersService(buildPrisma() as never)
      await expect(
        service.createStudent(
          { fullName: 'Other', studentId: '2024-00078-MN-0', program: 'BSHM', yearLevel: 1 } as never,
          bsitRegistrar,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException)
      await expect(
        service.createTeacher({ fullName: 'Prof', email: 'prof@pup.edu.ph' } as never, bsitRegistrar),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('lets a pinned registrar create a student in their own course', async () => {
      const prisma = buildPrisma()
      await new UsersService(prisma as never).createStudent(
        { fullName: 'Own', studentId: '2024-00079-MN-0', program: 'BSIT', yearLevel: 1 } as never,
        bsitRegistrar,
      )
      expect(prisma.user.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ program: 'BSIT', department: 'BSIT' }),
      )
    })
  })
})
