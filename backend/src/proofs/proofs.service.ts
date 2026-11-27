import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  formatCampusDate,
  isProofWindowOpen,
  PROOF_PHOTO_MAX_BYTES,
  PROOF_PHOTOS_PER_SESSION,
  type QacSection,
} from '@polycheck/shared'
import { lockStudentSection } from '../common/student-section-lock'
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

  /** The student's QAC sections, each with the classes happening today. */
  async qacSections(user: RequestUser, now = new Date()): Promise<QacSection[]> {
    const roles = await this.prisma.sectionRole.findMany({
      where: { studentId: user.id, role: 'qac', section: { enrollments: { some: { studentId: user.id } } } },
      include: {
        section: {
          select: {
            id: true,
            section: true,
            course: true,
            teacher: { select: { fullName: true } },
            subject: { select: { name: true, code: true } },
          },
        },
      },
    })
    if (!roles.length) return []
    const sectionIds = roles.map((role) => role.sectionId)
    const sessions = await this.prisma.session.findMany({
      where: { sectionId: { in: sectionIds }, OR: [{ date: formatCampusDate(now) }, { isActive: true }] },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, sectionId: true, date: true, startTime: true, endTime: true, room: true, isActive: true },
    })
    const mine = sessions.length
      ? await this.prisma.proofOfClass.findMany({
          where: { uploadedBy: user.id, sessionId: { in: sessions.map((session) => session.id) } },
          select: { sessionId: true },
        })
      : []
    const photoCount = new Map<string, number>()
    for (const proof of mine) photoCount.set(proof.sessionId, (photoCount.get(proof.sessionId) ?? 0) + 1)

    return roles
      .map(({ section }) => ({
        sectionId: section.id,
        subjectName: section.subject.name,
        subjectCode: section.subject.code,
        section: section.section,
        course: section.course ?? undefined,
        teacherName: section.teacher.fullName,
        sessions: sessions
          .filter((session) => session.sectionId === section.id)
          .map((session) => ({
            id: session.id,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            room: session.room ?? undefined,
            open: isProofWindowOpen(session, now),
            myPhotoCount: photoCount.get(session.id) ?? 0,
          })),
      }))
      .sort((left, right) => left.subjectName.localeCompare(right.subjectName))
  }

  async upload(user: RequestUser, dto: UploadProofInput) {
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } })
    if (!session || session.sectionId !== dto.sectionId)
      throw new NotFoundException('Session not found for this section')
    if (!isProofWindowOpen(session)) {
      throw new BadRequestException('Photos can only be uploaded while the class is ongoing')
    }
    await this.access(user, session.sectionId, session.teacherId)
    const permitted = await this.canUpload(user, session)
    if (!permitted) throw new ForbiddenException('You are not permitted to upload proof for this session')
    const image = this.decodeImage(dto.photoData)
    const reference = await this.storage.store(image.buffer, image.extension, image.mime)
    const person = await this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } })
    const data = {
      sectionId: dto.sectionId,
      sessionId: dto.sessionId,
      uploadedBy: user.id,
      uploadedByStudentName: person?.fullName ?? 'Unknown',
      photoUrl: reference,
      description: dto.description?.trim() || undefined,
    }
    let proof
    try {
      proof =
        user.role === 'student'
          ? await this.prisma.$transaction(async (tx) => {
              // The lock keeps parallel uploads from slipping past the per-session limit.
              await lockStudentSection(tx, user.id, dto.sectionId)
              const count = await tx.proofOfClass.count({ where: { sessionId: dto.sessionId, uploadedBy: user.id } })
              if (count >= PROOF_PHOTOS_PER_SESSION) {
                throw new BadRequestException(
                  `You can add up to ${PROOF_PHOTOS_PER_SESSION} photos to one session, and you already have ${count}`,
                )
              }
              return tx.proofOfClass.create({ data })
            })
          : await this.prisma.proofOfClass.create({ data })
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
    return Boolean(
      await this.prisma.sectionRole.findFirst({
        where: { sectionId: session.sectionId, studentId: user.id, role: 'qac' },
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
    // Class photos are compressed by the apps, so they get a much smaller limit than other evidence.
    const maxBytes = Math.min(this.config.get<number>('MAX_PROOF_BYTES') ?? 5_000_000, PROOF_PHOTO_MAX_BYTES)
    return decodeImageDataUrl(value, maxBytes, 'Proof')
  }

  private present<T extends { id: string; photoUrl: string }>(proof: T) {
    const endpoint = `/api/proofs/${proof.id}/file`
    return { ...proof, photoUrl: endpoint, photoData: endpoint }
  }
}

export type { UploadProofInput }
