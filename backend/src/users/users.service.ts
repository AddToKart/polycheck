import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import { ConflictException } from '@nestjs/common'
import { hashSync } from 'bcryptjs'
import type { CreateTeacherDto } from './dto/manage-user.dto'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list all users')
    }
    return this.prisma.user.findMany({
      select: { id: true, studentId: true, fullName: true, email: true, role: true, program: true, yearLevel: true, department: true, photoUrl: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { fullName: 'asc' },
    })
  }

  async findOne(id: string, user: RequestUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { enrollments: { select: { sectionId: true } } },
    })
    if (!target) throw new NotFoundException('User not found')

    const canAccessOwnProfile = user.id === id
    const canAccessAsSuperAdmin = user.role === 'super_admin'
    const canAccessStudentInOwnSection = user.role === 'teacher' && target.role === 'student'
      ? await this.prisma.enrollment.findFirst({
          where: { studentId: id, section: { teacherId: user.id } },
          select: { id: true },
        })
      : null

    if (!canAccessOwnProfile && !canAccessAsSuperAdmin && !canAccessStudentInOwnSection) {
      throw new ForbiddenException('Cannot access this user profile')
    }

    const { password, teacherPublicKey, enrollments, ...rest } = target
    return {
      ...rest,
      ...(target.role === 'student' ? { enrolledSectionIds: enrollments.map((enrollment) => enrollment.sectionId) } : {}),
    }
  }

  async findTeachers(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list teachers')
    }
    return this.prisma.user.findMany({
      where: { role: 'teacher' },
      select: { id: true, fullName: true, email: true, role: true, department: true, photoUrl: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { fullName: 'asc' },
    })
  }

  async findStudents(user: RequestUser) {
    if (user.role === 'student') {
      throw new ForbiddenException('Students cannot list other students')
    }
    const students = await this.prisma.user.findMany({
      where: { role: 'student', ...(user.role === 'super_admin' ? {} : { isActive: true }) },
      select: { id: true, studentId: true, fullName: true, email: true, role: true, program: true, yearLevel: true, photoUrl: true, isActive: true, createdAt: true, updatedAt: true, enrollments: { select: { sectionId: true } } },
      orderBy: { fullName: 'asc' },
    })
    return students.map(({ enrollments, ...student }) => ({
      ...student,
      enrolledSectionIds: enrollments.map((enrollment) => enrollment.sectionId),
    }))
  }

  async createTeacher(dto: CreateTeacherDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, select: { id: true } })
    if (exists) throw new ConflictException('A user with this email already exists')
    return this.prisma.user.create({
      data: { fullName: dto.fullName.trim(), email: dto.email.toLowerCase(), password: hashSync(dto.password, 10), department: dto.department?.trim(), role: 'teacher' },
      select: { id: true, fullName: true, email: true, role: true, department: true, photoUrl: true, isActive: true, createdAt: true, updatedAt: true },
    })
  }

  async setStatus(id: string, isActive: boolean) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!target) throw new NotFoundException('User not found')
    if (target.role === 'super_admin') throw new ForbiddenException('Super Admin accounts cannot be disabled here')
    return this.prisma.user.update({
      where: { id },
      data: { isActive, authVersion: { increment: 1 } },
      select: { id: true, fullName: true, email: true, role: true, department: true, program: true, yearLevel: true, studentId: true, photoUrl: true, isActive: true, createdAt: true, updatedAt: true },
    })
  }
}
