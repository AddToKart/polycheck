import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import type { EmergencyDeviceReleaseDto, TeacherResetStudentPasswordDto, UpdateContactsDto } from './dto/governance.dto'
import { Prisma } from '../prisma/client'
import { randomUUID } from 'crypto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { adminCanAccessUser, adminScope, adminUserWhere } from '../common/admin-scope'
import { isStrongPassword, PASSWORD_HASH_COST } from '../auth/password-policy'
import { paginate, type PaginationParams } from '../common/utils/pagination'
import type { AdminUserFilters } from '@polycheck/shared'
import { NotificationsService } from '../notifications/notifications.service'
import { RedisService } from '../infrastructure/redis.service'
import { SettingsService } from '../settings/settings.service'
import { lockStudentSection } from '../common/student-section-lock'
import { ErrorCode } from '../common/constants/error-codes'
import { DeviceBindingService } from './device-binding.service'
import { generateTemporaryPassword } from './password-generator'

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

const GOVERNANCE_USER_SELECT = {
  ...SAFE_USER_SELECT,
  boundDeviceId: true,
  deviceBoundAt: true,
  deviceCooldownUntil: true,
  canResetStudentPasswords: true,
  canEmergencyUnbindDevices: true,
  contactEmail: true,
  contactPhone: true,
} as const satisfies Prisma.UserSelect

type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>

const DEFAULT_LIST_LIMIT = 100

// Delegated classroom actions are rate limited per teacher so a compromised
// account cannot mass-reset a roster. Limits are env-tunable like login limits.
const TEACHER_RESET_RATE_LIMIT = positiveInt(process.env.TEACHER_RESET_RATE_LIMIT, 10)
const TEACHER_RESET_RATE_WINDOW_SECONDS = positiveInt(process.env.TEACHER_RESET_RATE_WINDOW_SECONDS, 3600)
const TEACHER_DEVICE_RELEASE_RATE_LIMIT = positiveInt(process.env.TEACHER_DEVICE_RELEASE_RATE_LIMIT, 10)
const TEACHER_DEVICE_RELEASE_RATE_WINDOW_SECONDS = positiveInt(
  process.env.TEACHER_DEVICE_RELEASE_RATE_WINDOW_SECONDS,
  3600,
)
const DEVICE_UNREGISTER_RATE_LIMIT = positiveInt(process.env.DEVICE_UNREGISTER_RATE_LIMIT, 5)
const DEVICE_UNREGISTER_RATE_WINDOW_SECONDS = positiveInt(process.env.DEVICE_UNREGISTER_RATE_WINDOW_SECONDS, 3600)
const CONTACT_UPDATE_RATE_LIMIT = positiveInt(process.env.CONTACT_UPDATE_RATE_LIMIT, 10)
const CONTACT_UPDATE_RATE_WINDOW_SECONDS = positiveInt(process.env.CONTACT_UPDATE_RATE_WINDOW_SECONDS, 900)

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private prisma: PrismaService,
    @Optional() private events?: EventEmitter2,
    @Optional() private notifications?: NotificationsService,
    @Optional() private deviceBinding?: DeviceBindingService,
    @Optional() private settings?: SettingsService,
    @Optional() private redis?: RedisService,
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
    const generated = dto.password === undefined
    const temporaryPassword = dto.password ?? generateTemporaryPassword()
    const password = await hash(temporaryPassword, PASSWORD_HASH_COST)
    const id = randomUUID()
    const now = new Date()
    try {
      const created = await this.prisma.user.create({
        data: {
          id,
          fullName: dto.fullName.trim(),
          email: dto.email.toLowerCase(),
          authEmail: `u-${randomUUID()}@auth.polycheck.invalid`,
          password,
          department: dto.department?.trim(),
          role: 'teacher',
          ...(generated ? { mustChangePassword: true } : {}),
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
      await this.recordAdminAudit(user, 'admin.user.created', created.id, {
        role: 'teacher',
        generatedPassword: generated,
      })
      return { ...created, ...(generated ? { temporaryPassword } : {}) }
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

    const generated = dto.password === undefined
    const temporaryPassword = dto.password ?? generateTemporaryPassword()
    const password = await hash(temporaryPassword, PASSWORD_HASH_COST)
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
          ...(generated ? { mustChangePassword: true } : {}),
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
      await this.recordAdminAudit(user, 'admin.user.created', student.id, {
        role: 'student',
        generatedPassword: generated,
      })
      return { ...student, enrolledSectionIds: [], ...(generated ? { temporaryPassword } : {}) }
    } catch (error) {
      this.rethrowUniqueConflict(error)
    }
  }

  async resetPassword(id: string, password: string | undefined, user: RequestUser) {
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

    const generated = password === undefined
    const temporaryPassword = password ?? generateTemporaryPassword()
    const passwordHash = await hash(temporaryPassword, PASSWORD_HASH_COST)
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
    await this.recordAdminAudit(user, 'admin.user.password_reset', id, { generated })
    await this.notifications?.notify(id, {
      type: 'password_reset',
      title: 'Password reset',
      body: 'An administrator reset your password. Sign in with the temporary password and change it immediately.',
      link: '/login',
    })
    return {
      message: 'Password reset successfully',
      userId: id,
      ...(generated ? { temporaryPassword } : {}),
    }
  }

  /**
   * Delegated in-classroom reset. A teacher may only reset a student who is
   * currently enrolled in the section they are acting from, the institution
   * policy must be enabled, and the teacher must not carry a disabling
   * override. The temporary credential is returned exactly once.
   */
  async teacherResetStudentPassword(
    studentId: string,
    dto: TeacherResetStudentPasswordDto,
    user: RequestUser,
    ipAddress?: string,
  ) {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can reset student passwords')
    }
    await this.assertTeacherCapability(user.id, 'passwordReset')
    const withinLimit = await this.consumeLimit(
      `users:reset-student-password:${user.id}`,
      TEACHER_RESET_RATE_LIMIT,
      TEACHER_RESET_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many password resets. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hash(temporaryPassword, PASSWORD_HASH_COST)
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await this.assertStudentInTeacherSection(tx, studentId, dto.sectionId, user.id)
      await tx.user.update({
        where: { id: studentId },
        data: { password: passwordHash, mustChangePassword: true, authVersion: { increment: 1 } },
      })
      await tx.authAccount.upsert({
        where: { providerId_accountId: { providerId: 'credential', accountId: studentId } },
        update: { password: passwordHash, updatedAt: now },
        create: {
          id: randomUUID(),
          accountId: studentId,
          providerId: 'credential',
          userId: studentId,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      })
      await tx.authSession.deleteMany({ where: { userId: studentId } })
    })

    this.events?.emit('auth.session-replaced', { userId: studentId, reason: 'teacher_password_reset' })
    await this.recordAdminAudit(user, 'teacher.password_reset', studentId, {
      sectionId: dto.sectionId,
      ipAddress: ipAddress ?? null,
      outcome: 'succeeded',
    })
    await this.notifications?.notify(studentId, {
      type: 'password_reset',
      title: 'Password reset by your instructor',
      body: 'Your instructor issued a temporary password. Sign in and change it immediately.',
      link: '/login',
    })
    return {
      userId: studentId,
      temporaryPassword,
      message: "Temporary password generated. It must be changed on the student's next login.",
    }
  }

  /**
   * Teacher safety net for a lost/damaged/borrowed device. Clears the binding
   * and cooldown so the student can log in on a replacement device immediately.
   */
  async emergencyReleaseDevice(
    studentId: string,
    dto: EmergencyDeviceReleaseDto,
    user: RequestUser,
    ipAddress?: string,
  ) {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can release a student device')
    }
    await this.assertTeacherCapability(user.id, 'deviceRelease')
    const withinLimit = await this.consumeLimit(
      `users:device-release:${user.id}`,
      TEACHER_DEVICE_RELEASE_RATE_LIMIT,
      TEACHER_DEVICE_RELEASE_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many device releases. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }

    const now = new Date()
    const clearedCooldown = await this.prisma.$transaction(async (tx) => {
      await this.assertStudentInTeacherSection(tx, studentId, dto.sectionId, user.id)
      const target = await tx.user.findUnique({
        where: { id: studentId },
        select: { boundDeviceId: true, deviceCooldownUntil: true },
      })
      if (!target) throw new NotFoundException('User not found')
      const hadBinding = target.boundDeviceId !== null
      const hadCooldown = target.deviceCooldownUntil !== null && target.deviceCooldownUntil.getTime() > now.getTime()
      await tx.user.update({
        where: { id: studentId },
        data: { boundDeviceId: null, deviceBoundAt: null, deviceCooldownUntil: null },
      })
      if (hadBinding || hadCooldown) {
        await tx.authSession.deleteMany({ where: { userId: studentId } })
      }
      return hadCooldown
    })

    await this.recordAdminAudit(user, 'teacher.device_release', studentId, {
      sectionId: dto.sectionId,
      reason: dto.reason,
      note: dto.note ?? null,
      ipAddress: ipAddress ?? null,
      clearedCooldown,
    })
    await this.notifications?.notify(studentId, {
      type: 'device_released',
      title: 'Device released',
      body: 'Your instructor released your device binding. You can sign in on a device again.',
      link: '/login',
    })
    const profile = await this.loadGovernanceProfile(studentId)
    return {
      user: profile,
      clearedCooldown,
      message: 'Device released. The student can log in on a new device now.',
    }
  }

  /** Student self-service unregister; delegates cooldown/session revocation. */
  async unregisterDevice(user: RequestUser, deviceId: string | undefined, ipAddress?: string) {
    if (user.role !== 'student') {
      throw new ForbiddenException('Only students can unregister a mobile device')
    }
    if (!this.deviceBinding) throw new ForbiddenException('Device binding is unavailable')
    const withinLimit = await this.consumeLimit(
      `users:device-unregister:${user.id}`,
      DEVICE_UNREGISTER_RATE_LIMIT,
      DEVICE_UNREGISTER_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many device changes. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }
    const result = await this.deviceBinding.unregisterStudentDevice(user.id, deviceId, ipAddress)
    const profile = await this.loadGovernanceProfile(user.id)
    return {
      user: profile,
      cooldownHours: result.cooldownHours,
      cooldownUntil: result.cooldownUntil.toISOString(),
      message: `Device unregistered. Mobile logins are locked for ${result.cooldownHours} hour(s); your instructor can release you sooner.`,
    }
  }

  /** Self-service secondary contact channels (never the login identity). */
  async updateContacts(user: RequestUser, dto: UpdateContactsDto) {
    const data: Prisma.UserUpdateInput = {}
    if (dto.contactEmail !== undefined) {
      const value = dto.contactEmail.trim()
      if (value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new BadRequestException('contactEmail must be a valid email address')
      }
      data.contactEmail = value === '' ? null : value
    }
    if (dto.contactPhone !== undefined) {
      const value = dto.contactPhone.trim()
      if (value !== '' && !/^\+?[0-9\s-]{7,20}$/.test(value)) {
        throw new BadRequestException('contactPhone must be a valid phone number')
      }
      data.contactPhone = value === '' ? null : value
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one contact field')
    }
    const withinLimit = await this.consumeLimit(
      `users:contacts:${user.id}`,
      CONTACT_UPDATE_RATE_LIMIT,
      CONTACT_UPDATE_RATE_WINDOW_SECONDS,
    )
    if (!withinLimit) {
      throw new HttpException('Too many contact updates. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      select: GOVERNANCE_USER_SELECT,
    })
    await this.recordAdminAudit(user, 'contact.updated', user.id, {
      fields: Object.keys(data),
    })
    return updated
  }

  private async assertTeacherCapability(teacherId: string, capability: 'passwordReset' | 'deviceRelease') {
    if (!this.settings) throw new ForbiddenException('Delegated teacher capabilities are unavailable')
    const policies = await this.settings.getTeacherDelegationPolicies()
    const policyEnabled =
      capability === 'passwordReset' ? policies.teacherPasswordReset : policies.teacherEmergencyUnbind
    if (!policyEnabled) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: ErrorCode.TEACHER_POLICY_DISABLED,
        message: 'This capability has been disabled by institution policy',
      })
    }
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { canResetStudentPasswords: true, canEmergencyUnbindDevices: true },
    })
    const override =
      capability === 'passwordReset' ? teacher?.canResetStudentPasswords : teacher?.canEmergencyUnbindDevices
    if (override === false) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: ErrorCode.TEACHER_PERMISSION_DISABLED,
        message: 'This capability is disabled for your account',
      })
    }
  }

  private async assertStudentInTeacherSection(
    tx: Prisma.TransactionClient,
    studentId: string,
    sectionId: string,
    teacherId: string,
  ) {
    await lockStudentSection(tx, studentId, sectionId)
    const enrollment = await tx.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId } },
      select: { id: true, section: { select: { teacherId: true } }, student: { select: { role: true } } },
    })
    if (!enrollment || enrollment.section.teacherId !== teacherId) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: ErrorCode.NOT_ENROLLED,
        message: 'Student is not enrolled in this section',
      })
    }
    if (enrollment.student.role !== 'student') {
      throw new ForbiddenException('Only student accounts can be managed here')
    }
    return enrollment
  }

  private async loadGovernanceProfile(id: string) {
    const profile = await this.prisma.user.findUnique({ where: { id }, select: GOVERNANCE_USER_SELECT })
    if (!profile) throw new NotFoundException('User not found')
    return profile
  }

  private async consumeLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!this.redis) return true
    return this.redis.consumeRateLimit(key, limit, windowSeconds)
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
    await this.notifications?.notify(id, {
      type: 'account_status_changed',
      title: `Account ${isActive ? 'enabled' : 'disabled'}`,
      body: `Your Polycheck account has been ${isActive ? 'enabled' : 'disabled'} by an administrator.`,
      link: updated.role === 'student' ? '/student/dashboard' : '/faculty',
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
    const permissionFieldsProvided =
      dto.canResetStudentPasswords !== undefined || dto.canEmergencyUnbindDevices !== undefined
    if (permissionFieldsProvided && target.role !== 'teacher') {
      throw new BadRequestException('Delegated capabilities can only be edited for teacher accounts')
    }

    const data: Prisma.UserUpdateInput = {}
    if (dto.canResetStudentPasswords !== undefined) data.canResetStudentPasswords = dto.canResetStudentPasswords
    if (dto.canEmergencyUnbindDevices !== undefined) data.canEmergencyUnbindDevices = dto.canEmergencyUnbindDevices
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
      data: {
        role,
        // Delegated teacher capabilities do not carry over to a student account.
        ...(role === 'student' ? { canResetStudentPasswords: null, canEmergencyUnbindDevices: null } : {}),
      },
      select: SAFE_USER_SELECT,
    })
    await this.recordAdminAudit(user, 'admin.user.role_changed', id, { before: target.role, after: role })
    this.events?.emit('auth.session-replaced', { userId: id, reason: 'role_changed' })
    await this.notifications?.notify(id, {
      type: 'role_changed',
      title: 'Account role updated',
      body: `Your Polycheck role is now ${role === 'teacher' ? 'Teacher' : 'Student'}.`,
      link: role === 'student' ? '/student/dashboard' : '/faculty',
    })
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
    await this.notifications?.notify(target.id, {
      type: 'role_changed',
      title: 'Super Admin access granted',
      body: 'Your Polycheck account has been promoted to Super Admin.',
      link: '/faculty',
    })
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
      await this.notifications?.notify(created.id, {
        type: 'role_changed',
        title: 'Super Admin access granted',
        body: 'Your Polycheck Super Admin account is ready.',
        link: '/faculty',
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
