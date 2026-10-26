import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { hash } from 'bcryptjs'
import type { CreateStudentDto, CreateTeacherDto } from './dto/manage-user.dto'
import type { CreateAdminDto, UpdateUserDto } from './dto/admin-user.dto'
import { Prisma } from '../prisma/client'
import { randomUUID } from 'crypto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { adminCanAccessUser, adminScope, adminUserWhere } from '../common/admin-scope'
import { isStrongPassword, PASSWORD_HASH_COST } from '../auth/password-policy'
import { paginate, type PaginationParams } from '../common/utils/pagination'
import type { AdminUserFilters } from '@polycheck/shared'

const SAFE_USER_SELECT = {
  id: true,
  studentId: true,
  fullName: true,
  email: true,
  role: true,
  program: true,
  yearLevel: true,
  department: true,
  photoUrl: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect

type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>

const DEFAULT_LIST_LIMIT = 100

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private prisma: PrismaService,
    @Optional() private events?: EventEmitter2,
  ) {}

  async findAll(user: RequestUser, filters: AdminUserFilters = {}, pagination?: PaginationParams) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list all users')
    }
    const params =
      pagination ??
      (filters.limit !== undefined || filters.offset !== undefined
        ? {
            limit: Math.min(Math.max(1, filters.limit ?? DEFAULT_LIST_LIMIT), DEFAULT_LIST_LIMIT),
            offset: Math.max(0, filters.offset ?? 0),
          }
        : { limit: DEFAULT_LIST_LIMIT, offset: 0 })
    const where = this.userListWhere(user, filters)
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        orderBy: { fullName: 'asc' },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.user.count({ where }),
    ])
    return paginate(users, total, params)
  }

  async findOne(id: string, user: RequestUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { enrollments: { select: { sectionId: true } } },
    })
    if (!target) throw new NotFoundException('User not found')

    const canAccessOwnProfile = user.id === id
    const canAccessAsSuperAdmin = adminCanAccessUser(user, target.department)
    const canAccessStudentInOwnSection =
      user.role === 'teacher' && target.role === 'student'
        ? await this.prisma.enrollment.findFirst({
            where: { studentId: id, section: { teacherId: user.id } },
            select: { id: true },
          })
        : null

    if (!canAccessOwnProfile && !canAccessAsSuperAdmin && !canAccessStudentInOwnSection) {
      throw new ForbiddenException('Cannot access this user profile')
    }

    const {
      password: _password,
      authEmail: _authEmail,
      authEmailVerified: _authEmailVerified,
      authVersion: _authVersion,
      teacherPublicKey: _teacherPublicKey,
      enrollments,
      ...rest
    } = target
    return {
      ...rest,
      ...(target.role === 'student'
        ? { enrolledSectionIds: enrollments.map((enrollment) => enrollment.sectionId) }
        : {}),
    }
  }

  async findTeachers(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list teachers')
    }
    return this.prisma.user.findMany({
      where: {
        role: 'teacher',
        ...(adminUserWhere(user) ?? {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        photoUrl: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { fullName: 'asc' },
    })
  }

  async findStudents(user: RequestUser) {
    if (user.role === 'student') {
      throw new ForbiddenException('Students cannot list other students')
    }
    const students = await this.prisma.user.findMany({
      where: {
        role: 'student',
        ...(user.role === 'super_admin'
          ? { ...(adminUserWhere(user) ?? {}) }
          : { isActive: true, enrollments: { some: { section: { teacherId: user.id } } } }),
      },
      select: {
        id: true,
        studentId: true,
        fullName: true,
        email: true,
        role: true,
        program: true,
        yearLevel: true,
        department: true,
        photoUrl: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        enrollments: { select: { sectionId: true } },
      },
      orderBy: { fullName: 'asc' },
    })
    return students.map(({ enrollments, ...student }) => ({
      ...student,
      enrolledSectionIds: enrollments.map((enrollment) => enrollment.sectionId),
    }))
  }

  async createTeacher(dto: CreateTeacherDto, user: RequestUser) {
    this.assertDepartmentScope(user, dto.department)
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    })
    if (exists) throw new ConflictException('A user with this email already exists')
    const password = await hash(dto.password, PASSWORD_HASH_COST)
    const id = randomUUID()
    const now = new Date()
    try {
      return await this.prisma.user.create({
        data: {
          id,
          fullName: dto.fullName.trim(),
          email: dto.email.toLowerCase(),
          authEmail: `u-${randomUUID()}@auth.polycheck.invalid`,
          password,
          department: dto.department?.trim(),
          role: 'teacher',
          authAccounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: 'credential',
              password,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          department: true,
          photoUrl: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (error) {
      this.rethrowUniqueConflict(error)
    }
  }

  async createStudent(dto: CreateStudentDto, user: RequestUser) {
    this.assertDepartmentScope(user, dto.department)
    const normalizedStudentId = dto.studentId.toUpperCase()
    const normalizedEmail = dto.email?.toLowerCase()
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [{ studentId: normalizedStudentId }, ...(normalizedEmail ? [{ email: normalizedEmail }] : [])],
      },
      select: { id: true },
    })
    if (exists) throw new ConflictException('A user with this student ID or email already exists')

    const password = await hash(dto.password, PASSWORD_HASH_COST)
    const id = randomUUID()
    const now = new Date()
    try {
      const student = await this.prisma.user.create({
        data: {
          id,
          fullName: dto.fullName.trim(),
          studentId: normalizedStudentId,
          email: normalizedEmail,
          authEmail: `u-${randomUUID()}@auth.polycheck.invalid`,
          password,
          program: dto.program?.trim() ?? null,
          yearLevel: dto.yearLevel,
          department: dto.department?.trim() ?? null,
          role: 'student',
          authAccounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: 'credential',
              password,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        select: {
          id: true,
          studentId: true,
          fullName: true,
          email: true,
          role: true,
          program: true,
          yearLevel: true,
          department: true,
          photoUrl: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return { ...student, enrolledSectionIds: [] }
    } catch (error) {
      this.rethrowUniqueConflict(error)
    }
  }

  async resetPassword(id: string, password: string, user: RequestUser) {
    this.assertSuperAdmin(user)
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, department: true },
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.role === 'super_admin') {
      throw new ForbiddenException('Super Admin passwords cannot be reset through user management')
    }
    this.assertDepartmentScope(user, target.department ?? undefined)

    const passwordHash = await hash(password, PASSWORD_HASH_COST)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        // An admin reset issues a temporary credential: force rotation on the
        // next login (the session revocation below also forces a fresh login).
        data: { password: passwordHash, mustChangePassword: true, authVersion: { increment: 1 } },
      }),
      this.prisma.authAccount.upsert({
        where: { providerId_accountId: { providerId: 'credential', accountId: id } },
        update: { password: passwordHash, updatedAt: new Date() },
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: 'credential',
          userId: id,
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      this.prisma.authSession.deleteMany({ where: { userId: id } }),
    ])
    this.events?.emit('auth.session-replaced', { userId: id, reason: 'password_reset' })
    return { message: 'Password reset successfully', userId: id }
  }

  async setStatus(id: string, isActive: boolean, user: RequestUser) {
    this.assertSuperAdmin(user)
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, department: true },
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.role === 'super_admin') throw new ForbiddenException('Super Admin accounts cannot be disabled here')
    if (!adminCanAccessUser(user, target.department)) {
      throw new ForbiddenException('This account is outside your administrative scope')
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive, authVersion: { increment: 1 } },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          department: true,
          program: true,
          yearLevel: true,
          studentId: true,
          photoUrl: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.authSession.deleteMany({ where: { userId: id } }),
    ])
    this.events?.emit('auth.session-replaced', {
      userId: id,
      reason: isActive ? 'account_updated' : 'account_disabled',
    })
    return updated
  }

  async updateUser(id: string, dto: UpdateUserDto, user: RequestUser) {
    this.assertSuperAdmin(user)
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, department: true },
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.role === 'super_admin') {
      throw new ForbiddenException('Super Admin accounts cannot be edited here')
    }
    if (!adminCanAccessUser(user, target.department)) {
      throw new ForbiddenException('This account is outside your administrative scope')
    }
    if (dto.email !== undefined && target.role !== 'teacher') {
      throw new BadRequestException('Email can only be edited for teacher accounts')
    }
    if ((dto.program !== undefined || dto.yearLevel !== undefined) && target.role !== 'student') {
      throw new BadRequestException('Program and year level can only be edited for student accounts')
    }

    const data: Prisma.UserUpdateInput = {}
    if (dto.fullName !== undefined) {
      const fullName = dto.fullName.trim()
      if (fullName.length < 2) throw new BadRequestException('fullName must be at least 2 characters')
      data.fullName = fullName
    }
    if (dto.department !== undefined) {
      data.department = dto.department.trim() || null
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase()
      if (!email) throw new BadRequestException('email cannot be empty')
      const duplicate = await this.prisma.user.findFirst({
        where: { email, NOT: { id } },
        select: { id: true },
      })
      if (duplicate) throw new ConflictException('A user with this email already exists')
      data.email = email
    }
    if (dto.program !== undefined) {
      const program = dto.program.trim()
      if (program.length < 2) throw new BadRequestException('program must be at least 2 characters')
      data.program = program
    }
    if (dto.yearLevel !== undefined) data.yearLevel = dto.yearLevel
    if (target.role === 'student' && dto.department !== undefined && !dto.department.trim()) {
      // Domain constraint: every student account keeps a department.
      throw new BadRequestException('Student accounts require a department')
    }

    const changedFields = Object.keys(data)
    if (changedFields.length === 0) throw new BadRequestException('No editable fields were provided')

    let updated: SafeUser
    try {
      updated = await this.prisma.user.update({ where: { id }, data, select: SAFE_USER_SELECT })
    } catch (error) {
      this.rethrowUniqueConflict(error)
      throw error
    }
    await this.recordAdminAudit(user, 'admin.user.updated', id, { changedFields })
    return updated
  }

  async changeUserRole(id: string, role: 'teacher' | 'student', user: RequestUser) {
    this.assertSuperAdmin(user)
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        department: true,
        email: true,
        studentId: true,
        program: true,
        yearLevel: true,
      },
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.id === user.id) throw new ForbiddenException('You cannot change your own role')
    if (target.role === 'super_admin') {
      throw new ForbiddenException('Super Admin accounts cannot be role-changed here')
    }
    if (!adminCanAccessUser(user, target.department)) {
      throw new ForbiddenException('This account is outside your administrative scope')
    }
    if (target.role === role) throw new BadRequestException('This account already has that role')

    if (target.role === 'teacher' && role === 'student') {
      const sections = await this.prisma.section.count({ where: { teacherId: id } })
      if (sections > 0) {
        throw new ConflictException("Reassign or delete this teacher's sections before changing their role to student")
      }
      // The User_role_fields_valid DB constraint requires student identity
      // fields; teacher rows created through user management have none.
      if (
        !target.studentId?.trim() ||
        !target.program?.trim() ||
        target.yearLevel === null ||
        !target.department?.trim()
      ) {
        throw new BadRequestException(
          'This teacher account has no student identity fields (student number, program, year level). Create a student account instead.',
        )
      }
    }
    if (target.role === 'student' && role === 'teacher') {
      if (!target.department?.trim()) {
        throw new BadRequestException('A department is required before changing a student to a teacher')
      }
      // The User_role_fields_valid DB constraint requires an email for teachers.
      if (!target.email?.trim()) {
        throw new BadRequestException('An email is required before changing a student to a teacher')
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: SAFE_USER_SELECT,
    })
    await this.recordAdminAudit(user, 'admin.user.role_changed', id, { before: target.role, after: role })
    this.events?.emit('auth.session-replaced', { userId: id, reason: 'role_changed' })
    return updated
  }

  async createAdmin(dto: CreateAdminDto, user: RequestUser) {
    this.assertSuperAdmin(user)
    if (adminScope(user).kind !== 'unrestricted') {
      throw new ForbiddenException('Only institution-scope super admins can create administrators')
    }

    const promotionId = dto.userId?.trim()
    const hasFreshFields = dto.fullName !== undefined || dto.email !== undefined || dto.password !== undefined
    if (promotionId && hasFreshFields) {
      throw new BadRequestException('Provide either userId or fullName, email, and password, not both')
    }
    if (!promotionId && !hasFreshFields) {
      throw new BadRequestException('Provide a userId or fullName, email, and password')
    }

    if (promotionId) return this.promoteAdmin(promotionId, user)
    return this.createFreshAdmin(dto, user)
  }

  private async promoteAdmin(id: string, user: RequestUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, department: true },
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.id === user.id) throw new ForbiddenException('You cannot promote your own account')
    if (target.role !== 'teacher') {
      throw new BadRequestException('Only teacher accounts can be promoted to super admin')
    }
    if (!adminCanAccessUser(user, target.department)) {
      throw new ForbiddenException('This account is outside your administrative scope')
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { role: 'super_admin', scope: 'institution' },
      select: SAFE_USER_SELECT,
    })
    await this.recordAdminAudit(user, 'admin.user.promoted', target.id, {
      previousRole: target.role,
      role: 'super_admin',
    })
    this.events?.emit('auth.session-replaced', { userId: target.id, reason: 'role_changed' })
    return updated
  }

  private async createFreshAdmin(dto: CreateAdminDto, user: RequestUser) {
    const fullName = dto.fullName?.trim() ?? ''
    const email = dto.email?.trim().toLowerCase() ?? ''
    const password = dto.password ?? ''
    if (!fullName || !email || !password) {
      throw new BadRequestException('fullName, email, and password are required to create a super admin')
    }
    if (!isStrongPassword(password)) {
      throw new BadRequestException('password does not meet the security policy')
    }

    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (exists) throw new ConflictException('A user with this email already exists')

    const passwordHash = await hash(password, PASSWORD_HASH_COST)
    const id = randomUUID()
    const now = new Date()
    try {
      const created = await this.prisma.user.create({
        data: {
          id,
          fullName,
          email,
          authEmail: `u-${randomUUID()}@auth.polycheck.invalid`,
          password: passwordHash,
          department: dto.department?.trim() || null,
          role: 'super_admin',
          scope: 'institution',
          authAccounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: 'credential',
              password: passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        select: SAFE_USER_SELECT,
      })
      await this.recordAdminAudit(user, 'admin.user.created', created.id, {
        role: 'super_admin',
        scope: 'institution',
      })
      return created
    } catch (error) {
      this.rethrowUniqueConflict(error)
    }
  }

  private userListWhere(user: RequestUser, filters: AdminUserFilters): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = []
    const scope = adminUserWhere(user)
    if (scope) and.push(scope)
    if (filters.role) and.push({ role: filters.role })

    const query = filters.q?.trim()
    if (query) {
      and.push({
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { studentId: { contains: query, mode: 'insensitive' } },
        ],
      })
    }

    const department = filters.department?.trim()
    if (department) {
      and.push({ department: { equals: department, mode: 'insensitive' } })
    }
    if (filters.status) and.push({ isActive: filters.status === 'active' })

    return and.length > 0 ? { AND: and } : {}
  }

  private async recordAdminAudit(user: RequestUser, action: string, entityId: string, metadata: Prisma.InputJsonValue) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action,
          entityType: 'user',
          entityId,
          metadata,
        },
      })
    } catch (error) {
      // Account mutations must not fail open because the audit table is
      // briefly unavailable; log with enough context to reconcile later.
      this.logger.error(
        `Could not write ${action} audit row for actor ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private assertDepartmentScope(user: RequestUser, department?: string) {
    this.assertSuperAdmin(user)
    if (adminCanAccessUser(user, department)) return
    throw new ForbiddenException('Department administrators can only manage accounts in their own department')
  }

  private assertSuperAdmin(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can manage user accounts')
    }
  }

  private rethrowUniqueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A user with this identifier already exists')
    }
    throw error
  }
}
