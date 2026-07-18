import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { ConflictException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import type { CreateStudentDto, CreateTeacherDto } from './dto/manage-user.dto'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Optional() private events?: EventEmitter2,
  ) {}

  async findAll(user: RequestUser, pagination?: { limit: number; offset: number }) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list all users')
    }
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where:
          user.scope === 'institution'
            ? undefined
            : user.department
              ? { department: user.department }
              : { id: { in: [] } },
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
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { fullName: 'asc' },
        take: pagination?.limit ?? 100,
        skip: pagination?.offset ?? 0,
      }),
      this.prisma.user.count({
        where:
          user.scope === 'institution'
            ? undefined
            : user.department
              ? { department: user.department }
              : { id: { in: [] } },
      }),
    ])
    return {
      data: users,
      total,
      limit: pagination?.limit ?? 100,
      offset: pagination?.offset ?? 0,
      hasMore: (pagination?.offset ?? 0) + users.length < total,
    }
  }

  async findOne(id: string, user: RequestUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { enrollments: { select: { sectionId: true } } },
    })
    if (!target) throw new NotFoundException('User not found')

    const canAccessOwnProfile = user.id === id
    const canAccessAsSuperAdmin =
      user.role === 'super_admin'
        ? user.scope === 'institution' || (!!user.department && target.department === user.department)
        : false
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
        ...(user.scope === 'institution' ? {} : user.department ? { department: user.department } : { id: { in: [] } }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        photoUrl: true,
        isActive: true,
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
          ? user.scope === 'institution'
            ? {}
            : user.department
              ? { department: user.department }
              : { id: { in: [] } }
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
    const password = await hash(dto.password, 12)
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

    const password = await hash(dto.password, 12)
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
          program: dto.program.trim(),
          yearLevel: dto.yearLevel,
          department: dto.department.trim(),
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

    const passwordHash = await hash(password, 12)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { password: passwordHash, authVersion: { increment: 1 } },
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
    if (user.scope !== 'institution' && target.department !== user.department) {
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

  private assertDepartmentScope(user: RequestUser, department?: string) {
    this.assertSuperAdmin(user)
    if (user.scope === 'institution') return
    if (user.department && department === user.department) return
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
