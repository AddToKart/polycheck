import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list all users')
    }
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, studentId: true, fullName: true, email: true, role: true, program: true, yearLevel: true, department: true, photoUrl: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { fullName: 'asc' },
    })
  }

  async findOne(id: string, user: RequestUser) {
    const target = await this.prisma.user.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('User not found')

    if (user.role !== 'super_admin' && user.id !== id) {
      throw new ForbiddenException('Cannot access other user profiles')
    }

    const { password, teacherPublicKey, ...rest } = target
    return rest
  }

  async findTeachers(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can list teachers')
    }
    return this.prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
      select: { id: true, fullName: true, email: true, department: true, photoUrl: true, createdAt: true, updatedAt: true },
      orderBy: { fullName: 'asc' },
    })
  }

  async findStudents(user: RequestUser) {
    if (user.role === 'student') {
      throw new ForbiddenException('Students cannot list other students')
    }
    return this.prisma.user.findMany({
      where: { role: 'student', isActive: true },
      select: { id: true, studentId: true, fullName: true, email: true, program: true, yearLevel: true, photoUrl: true, createdAt: true, updatedAt: true },
      orderBy: { fullName: 'asc' },
    })
  }
}
