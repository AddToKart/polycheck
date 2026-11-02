import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Session } from '../prisma/client'
import { ProofStorageService } from './proof-storage.service'
import { assertSectionInAdminScope } from '../common/admin-scope'
import { decodeImageDataUrl } from './image-evidence'

interface UploadProofInput {
  sectionId: string
  sessionId: string
  photoData: string
  description?: string
}

@Injectable()
export class ProofsService {
  private readonly logger = new Logger(ProofsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: ProofStorageService,
  ) {}

  async list(user: RequestUser, sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException('Session not found')
    await this.access(user, session.sectionId, session.teacherId)
    const items = await this.prisma.proofOfClass.findMany({ where: { sessionId }, orderBy: { uploadedAt: 'desc' } })
    return items.map((item) => this.present(item))
  }

  async upload(user: RequestUser, dto: UploadProofInput) {
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } })
    if (!session || session.sectionId !== dto.sectionId)
      throw new NotFoundException('Session not found for this section')
    if (!session.isActive) throw new BadRequestException('Proof can only be uploaded while the session is active')
    await this.access(user, session.sectionId, session.teacherId)
    const permitted = await this.canUpload(user, session)
    if (!permitted) throw new ForbiddenException('You are not permitted to upload proof for this session')
    const image = this.decodeImage(dto.photoData)
    const reference = await this.storage.store(image.buffer, image.extension, image.mime)
    const person = await this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } })
    let proof
    try {
      proof = await this.prisma.proofOfClass.create({
        data: {
          sectionId: dto.sectionId,
          sessionId: dto.sessionId,
          uploadedBy: user.id,
          uploadedByStudentName: person?.fullName ?? 'Unknown',
          photoUrl: reference,
          description: dto.description?.trim() || undefined,
        },
      })
    } catch (error) {
      await this.storage.remove(reference).catch(() => undefined)
      throw error
    }
    return this.present(proof)
  }

  async file(user: RequestUser, id: string) {
    const proof = await this.prisma.proofOfClass.findUnique({
      where: { id },
      include: { session: { select: { sectionId: true, teacherId: true } } },
    })
    if (!proof) throw new NotFoundException('Proof not found')
    await this.access(user, proof.session.sectionId, proof.session.teacherId)
    return this.storage.read(proof.photoUrl)
  }

  async remove(user: RequestUser, id: string) {
    const proof = await this.prisma.proofOfClass.findUnique({
      where: { id },
      include: { session: { select: { teacherId: true } } },
    })
    if (!proof) throw new NotFoundException('Proof not found')
    const isSessionTeacher = user.role === 'teacher' && proof.session.teacherId === user.id
    if (!isSessionTeacher) throw new ForbiddenException('Only the session teacher can delete proof')
    await this.prisma.proofOfClass.delete({ where: { id } })
    try {
      await this.storage.remove(proof.photoUrl)
    } catch (error) {
      this.logger.error(
        `Proof ${proof.id} was deleted but its stored object could not be removed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    return true
  }

  private async canUpload(user: RequestUser, session: Pick<Session, 'sectionId' | 'teacherId'>) {
    if (user.role === 'teacher' && session.teacherId === user.id) return true
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
    if (user.role === 'super_admin') {
      await assertSectionInAdminScope(user, sectionId, this.prisma, 'This proof')
      return
    }
    if (user.role === 'teacher' && teacherId === user.id) return
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId } },
    })
    if (!enrollment) throw new ForbiddenException()
  }

  private decodeImage(value: string) {
    const maxBytes = this.config.get<number>('MAX_PROOF_BYTES') ?? 5_000_000
    return decodeImageDataUrl(value, maxBytes, 'Proof')
  }

  private present<T extends { id: string; photoUrl: string }>(proof: T) {
    const endpoint = `/api/proofs/${proof.id}/file`
    return { ...proof, photoUrl: endpoint, photoData: endpoint }
  }
}

export type { UploadProofInput }
