import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { Session } from '@prisma/client'

interface UploadProofInput {
  sectionId: string
  sessionId: string
  photoData: string
  description?: string
}

@Injectable()
export class ProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException('Session not found')
    await this.access(user, session.sectionId, session.teacherId)
    const items = await this.prisma.proofOfClass.findMany({ where: { sessionId }, orderBy: { uploadedAt: 'desc' } })
    return items.map((item) => ({ ...item, photoData: item.photoUrl }))
  }

  async upload(user: RequestUser, dto: UploadProofInput) {
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } })
    if (!session || session.sectionId !== dto.sectionId)
      throw new NotFoundException('Session not found for this section')
    const permitted = await this.canUpload(user, session)
    if (!permitted) throw new ForbiddenException('You are not permitted to upload proof for this session')
    const person = await this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } })
    const proof = await this.prisma.proofOfClass.create({
      data: {
        sectionId: dto.sectionId,
        sessionId: dto.sessionId,
        uploadedBy: user.id,
        uploadedByStudentName: person?.fullName ?? 'Unknown',
        photoUrl: dto.photoData,
        description: dto.description,
      },
    })
    return { ...proof, photoData: proof.photoUrl }
  }

  async remove(user: RequestUser, id: string) {
    const proof = await this.prisma.proofOfClass.findUnique({
      where: { id },
      include: { session: { select: { teacherId: true } } },
    })
    if (!proof) throw new NotFoundException('Proof not found')
    if (user.role !== 'super_admin' && proof.session.teacherId !== user.id)
      throw new ForbiddenException('Only the session teacher can delete proof')
    await this.prisma.proofOfClass.delete({ where: { id } })
    return true
  }

  private async canUpload(user: RequestUser, session: Pick<Session, 'sectionId' | 'teacherId'>) {
    if (user.role === 'super_admin' || (user.role === 'teacher' && session.teacherId === user.id)) return true
    const role = await this.prisma.sectionRole.findFirst({
      where: { sectionId: session.sectionId, studentId: user.id, role: 'qac' },
    })
    if (role) return true
    return Boolean(
      await this.prisma.sessionPermission.findFirst({
        where: { sectionId: session.sectionId, studentId: user.id, isActive: true, expiresAt: { gt: new Date() } },
      }),
    )
  }

  private async access(user: RequestUser, sectionId: string, teacherId: string) {
    if (user.role === 'super_admin' || (user.role === 'teacher' && teacherId === user.id)) return
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId } },
    })
    if (!enrollment) throw new ForbiddenException()
  }
}

export type { UploadProofInput }
