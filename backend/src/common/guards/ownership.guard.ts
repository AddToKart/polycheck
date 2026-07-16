import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { RequestUser } from '../../auth/strategies/jwt.strategy'

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: RequestUser; params: Record<string, string> }>()
    const user = request.user
    if (!user) throw new ForbiddenException('No user in request')
    if (user.role === 'super_admin') return true

    const sectionId = request.params.sectionId
    if (!sectionId) return true

    const section = await this.prisma.section.findUnique({ where: { id: sectionId }, select: { teacherId: true } })
    if (!section) throw new NotFoundException('Section not found')

    if (user.role === 'teacher' && section.teacherId !== user.id) {
      throw new ForbiddenException('You can only manage your own sections')
    }

    if (user.role === 'student') {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: user.id, sectionId } },
        select: { id: true },
      })
      if (!enrollment) throw new ForbiddenException('You are not enrolled in this section')
    }

    return true
  }
}
