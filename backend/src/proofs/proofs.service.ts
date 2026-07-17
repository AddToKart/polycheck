import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { extname, resolve } from 'path'
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    const uploadDirectory = resolve(this.config.get<string>('UPLOAD_DIR') ?? 'uploads')
    await mkdir(uploadDirectory, { recursive: true })
    const fileName = `${randomUUID()}.${image.extension}`
    const filePath = resolve(uploadDirectory, fileName)
    await writeFile(filePath, image.buffer, { flag: 'wx' })
    const person = await this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } })
    let proof
    try {
      proof = await this.prisma.proofOfClass.create({
        data: {
          sectionId: dto.sectionId,
          sessionId: dto.sessionId,
          uploadedBy: user.id,
          uploadedByStudentName: person?.fullName ?? 'Unknown',
          photoUrl: `/uploads/${fileName}`,
          description: dto.description?.trim() || undefined,
        },
      })
    } catch (error) {
      await unlink(filePath).catch(() => undefined)
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
    if (!proof.photoUrl.startsWith('/uploads/')) throw new NotFoundException('Proof file not found')
    const uploadDirectory = resolve(this.config.get<string>('UPLOAD_DIR') ?? 'uploads')
    const path = resolve(uploadDirectory, proof.photoUrl.slice('/uploads/'.length))
    if (!path.startsWith(`${uploadDirectory}\\`) && !path.startsWith(`${uploadDirectory}/`)) {
      throw new ForbiddenException('Invalid proof file path')
    }
    const extension = extname(path).toLowerCase()
    const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
    return { path, contentType }
  }

  async remove(user: RequestUser, id: string) {
    const proof = await this.prisma.proofOfClass.findUnique({
      where: { id },
      include: {
        session: {
          select: { teacherId: true, section: { select: { teacher: { select: { department: true } } } } },
        },
      },
    })
    if (!proof) throw new NotFoundException('Proof not found')
    if (user.role !== 'teacher' || proof.session.teacherId !== user.id)
      throw new ForbiddenException('Only the session teacher can delete proof')
    await this.prisma.proofOfClass.delete({ where: { id } })
    await this.deleteStoredFile(proof.photoUrl)
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
      if (user.scope === 'institution') return
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId, teacher: { department: user.department ?? '__no_department__' } },
        select: { id: true },
      })
      if (section) return
      throw new ForbiddenException('This proof is outside your administrative scope')
    }
    if (user.role === 'teacher' && teacherId === user.id) return
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId } },
    })
    if (!enrollment) throw new ForbiddenException()
  }

  private decodeImage(value: string) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
    if (!match) throw new BadRequestException('Proof must be a JPEG, PNG, or WebP data URL')
    const buffer = Buffer.from(match[2], 'base64')
    const maxBytes = this.config.get<number>('MAX_PROOF_BYTES') ?? 5_000_000
    if (buffer.length === 0 || buffer.length > maxBytes) {
      throw new BadRequestException(`Proof image must be between 1 byte and ${maxBytes} bytes`)
    }
    const mime = match[1]
    const validMagic =
      (mime === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
      (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mime === 'image/webp' &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP')
    if (!validMagic) throw new BadRequestException('Proof image content does not match its declared type')
    return { buffer, extension: mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length) }
  }

  private async deleteStoredFile(photoUrl: string) {
    if (!photoUrl.startsWith('/uploads/') || extname(photoUrl) === '') return
    const uploadDirectory = resolve(this.config.get<string>('UPLOAD_DIR') ?? 'uploads')
    const filePath = resolve(uploadDirectory, photoUrl.slice('/uploads/'.length))
    if (!filePath.startsWith(`${uploadDirectory}\\`) && !filePath.startsWith(`${uploadDirectory}/`)) return
    await unlink(filePath).catch(() => undefined)
  }

  private present<T extends { id: string; photoUrl: string }>(proof: T) {
    const endpoint = `/api/proofs/${proof.id}/file`
    return { ...proof, photoUrl: endpoint, photoData: endpoint }
  }
}

export type { UploadProofInput }
