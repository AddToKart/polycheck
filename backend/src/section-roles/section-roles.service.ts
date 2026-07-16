import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { SectionRoleType } from '@prisma/client'

interface AssignRoleInput {
  sectionId: string
  studentId: string
  role: 'president' | 'qac'
}

@Injectable()
export class SectionRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForSection(user: RequestUser, sectionId: string) {
    await this.canAccess(user, sectionId)
    return this.prisma.sectionRole.findMany({ where: { sectionId }, orderBy: { grantedAt: 'desc' } })
  }

  async getForStudent(user: RequestUser, studentId: string) {
    if (user.role === 'student' && user.id !== studentId) throw new ForbiddenException()
    const roles = await this.prisma.sectionRole.findMany({ where: { studentId } })
    if (user.role === 'teacher') {
      const ids = await this.ownedSectionIds(user.id)
      return roles.filter((role) => ids.includes(role.sectionId))
    }
    return roles
  }

  async assign(user: RequestUser, dto: AssignRoleInput) {
    await this.owns(user.id, dto.sectionId)
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.sectionId } },
      include: { student: { select: { fullName: true } } },
    })
    if (!enrollment) throw new NotFoundException('Student is not enrolled in this section')
    return this.prisma.sectionRole.upsert({
      where: {
        sectionId_studentId_role: {
          sectionId: dto.sectionId,
          studentId: dto.studentId,
          role: dto.role as SectionRoleType,
        },
      },
      update: { grantedBy: user.id, studentName: enrollment.student.fullName },
      create: {
        sectionId: dto.sectionId,
        studentId: dto.studentId,
        role: dto.role as SectionRoleType,
        grantedBy: user.id,
        studentName: enrollment.student.fullName,
      },
    })
  }

  async remove(user: RequestUser, sectionId: string, studentId: string, role: 'president' | 'qac') {
    await this.owns(user.id, sectionId)
    await this.prisma.sectionRole.delete({
      where: { sectionId_studentId_role: { sectionId, studentId, role: role as SectionRoleType } },
    })
    return true
  }

  private async owns(id: string, sectionId: string) {
    const s = await this.prisma.section.findUnique({ where: { id: sectionId }, select: { teacherId: true } })
    if (!s) throw new NotFoundException('Section not found')
    if (s.teacherId !== id) throw new ForbiddenException()
  }

  private async canAccess(user: RequestUser, sectionId: string) {
    if (user.role === 'super_admin') return
    if (user.role === 'teacher') return this.owns(user.id, sectionId)
    const e = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId } },
    })
    if (!e) throw new ForbiddenException()
  }

  private async ownedSectionIds(id: string) {
    return (await this.prisma.section.findMany({ where: { teacherId: id }, select: { id: true } })).map((s) => s.id)
  }
}

export type { AssignRoleInput }
