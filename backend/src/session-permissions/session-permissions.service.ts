import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import { assertSectionInAdminScope } from '../common/admin-scope'
import { lockStudentSection } from '../common/student-section-lock'
import type { Prisma } from '../prisma/client'

interface PermissionInput {
  sectionId: string
  studentId: string
}

@Injectable()
export class SessionPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async grant(user: RequestUser, dto: PermissionInput) {
    return this.prisma.$transaction(async (tx) => {
      await lockStudentSection(tx, dto.studentId, dto.sectionId)
      await this.owns(user.id, dto.sectionId, tx)
      const enrolled = await tx.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.sectionId } },
      })
      if (!enrolled) throw new NotFoundException('Student is not enrolled in this section')
      const now = new Date()
      return tx.sessionPermission.upsert({
        where: { sectionId_studentId: { sectionId: dto.sectionId, studentId: dto.studentId } },
        update: {
          grantedBy: user.id,
          grantedAt: now,
          expiresAt: new Date(now.getTime() + 86_400_000),
          isActive: true,
        },
        create: {
          sectionId: dto.sectionId,
          studentId: dto.studentId,
          grantedBy: user.id,
          grantedAt: now,
          expiresAt: new Date(now.getTime() + 86_400_000),
          isActive: true,
        },
      })
    })
  }

  async revoke(user: RequestUser, sectionId: string, studentId: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockStudentSection(tx, studentId, sectionId)
      await this.owns(user.id, sectionId, tx)
      await tx.sessionPermission.updateMany({
        where: { sectionId, studentId, isActive: true },
        data: { isActive: false },
      })
    })
    return true
  }

  async check(user: RequestUser, sectionId: string, studentId: string) {
    if (user.role === 'student' && user.id !== studentId) throw new ForbiddenException()
    if (user.role === 'teacher') await this.owns(user.id, sectionId)
    if (user.role === 'super_admin') await this.inAdminScope(user, sectionId)
    return Boolean(
      await this.prisma.sessionPermission.findFirst({
        where: { sectionId, studentId, isActive: true, expiresAt: { gt: new Date() } },
      }),
    )
  }

  async active(user: RequestUser, sectionId: string) {
    if (user.role === 'teacher') await this.owns(user.id, sectionId)
    if (user.role === 'super_admin') await this.inAdminScope(user, sectionId)
    if (user.role === 'student') {
      const e = await this.prisma.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: user.id, sectionId } },
      })
      if (!e) throw new ForbiddenException()
    }
    return this.prisma.sessionPermission.findMany({
      where: {
        sectionId,
        isActive: true,
        expiresAt: { gt: new Date() },
        ...(user.role === 'student' ? { studentId: user.id } : {}),
      },
      orderBy: { expiresAt: 'asc' },
    })
  }

  async expireStale() {
    const result = await this.prisma.sessionPermission.updateMany({
      where: { isActive: true, expiresAt: { lt: new Date() } },
      data: { isActive: false },
    })
    return result.count
  }

  private async owns(id: string, sectionId: string, tx: Prisma.TransactionClient = this.prisma) {
    const section = await tx.section.findUnique({ where: { id: sectionId }, select: { teacherId: true } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.teacherId !== id) throw new ForbiddenException('You can only manage permissions in your own sections')
  }

  private async inAdminScope(user: RequestUser, sectionId: string) {
    await assertSectionInAdminScope(user, sectionId, this.prisma, 'This section')
  }
}

export type { PermissionInput }
