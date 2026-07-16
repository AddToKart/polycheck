import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { AttendanceStatus } from '@prisma/client'

interface SubmitDisputeInput {
  recordId: string
  reason: string
  description: string
}

interface DisputeSummary {
  sectionId?: string
  sessionId?: string
  status: 'pending' | 'resolved' | 'all'
  search?: string
}

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    user: RequestUser,
    sessionId?: string,
    status: 'pending' | 'resolved' | 'all' = 'pending',
    search?: string,
  ) {
    const where: Record<string, unknown> = {
      ...(sessionId ? { sessionId } : {}),
      ...(user.role === 'student'
        ? { studentId: user.id }
        : user.role === 'teacher'
          ? { session: { teacherId: user.id } }
          : {}),
    }
    if (status === 'pending') {
      where.status = 'disputed'
      where.disputeResolved = false
    }
    if (status === 'resolved') where.disputeResolved = true
    if (status === 'all') where.OR = [{ status: 'disputed' }, { disputeResolved: true }]
    if (search) where.studentName = { contains: search, mode: 'insensitive' }
    const records = await this.prisma.attendanceRecord.findMany({ where: where as any, orderBy: { updatedAt: 'desc' } })
    return records.map((record) => this.present(record))
  }

  async submit(user: RequestUser, dto: SubmitDisputeInput) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id: dto.recordId } })
    if (!record) throw new NotFoundException('Attendance record not found')
    if (record.studentId !== user.id) throw new ForbiddenException('You can only dispute your own attendance')
    return this.present(
      await this.prisma.attendanceRecord.update({
        where: { id: dto.recordId },
        data: {
          status: 'disputed',
          disputeReason: dto.reason,
          disputeDescription: dto.description,
          disputeResolved: false,
        },
      }),
    )
  }

  async resolve(
    user: RequestUser,
    id: string,
    resolution: 'accept' | 'reject' | 'override',
    newStatus?: AttendanceStatus,
  ) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: { session: { select: { teacherId: true } } },
    })
    if (!record) throw new NotFoundException('Attendance record not found')
    if (user.role === 'teacher' && record.session.teacherId !== user.id)
      throw new ForbiddenException('You can only resolve your own session disputes')
    const status: AttendanceStatus | undefined =
      resolution === 'accept' ? 'present' : resolution === 'reject' ? 'absent' : newStatus
    if (!status) throw new ForbiddenException('An override status is required')
    return this.present(
      await this.prisma.attendanceRecord.update({
        where: { id },
        data: { status, disputeResolved: true, manuallySet: resolution === 'override' },
      }),
    )
  }

  private present(record: any) {
    return { ...record, coordinates: { latitude: record.latitude, longitude: record.longitude } }
  }
}

export type { SubmitDisputeInput, DisputeSummary }
