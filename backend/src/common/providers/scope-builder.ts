import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { RequestUser } from '../../auth/strategies/jwt.strategy'
import type { Prisma } from '@prisma/client'

@Injectable()
export class ScopeBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async sessionScope(user: RequestUser): Promise<Prisma.SessionWhereInput> {
    if (user.role === 'super_admin') return {}
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { sectionId: { in: enrollments.map((e) => e.sectionId) } }
  }

  async recordScope(user: RequestUser): Promise<Prisma.AttendanceRecordWhereInput> {
    if (user.role === 'super_admin') return {}
    if (user.role === 'teacher') return { session: { teacherId: user.id } }
    return { studentId: user.id }
  }

  async sectionScope(user: RequestUser): Promise<Prisma.SectionWhereInput> {
    if (user.role === 'super_admin') return {}
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { id: { in: enrollments.map((e) => e.sectionId) } }
  }

  async studentSectionIds(studentId: string): Promise<string[]> {
    const enrollments = await this.prisma.enrollment.findMany({ where: { studentId }, select: { sectionId: true } })
    return enrollments.map((e) => e.sectionId)
  }
}
