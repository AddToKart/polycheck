import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { AttendanceListQueryDto, AttendanceReportQueryDto } from './dto/attendance.dto'
import { RAW_DATE_RANGE_DAYS } from './types'
import type { Prisma } from '../prisma/client'
import { formatCampusDate } from '@polycheck/shared'
import { adminRecordWhere, adminSessionWhere } from '../common/admin-scope'

@Injectable()
export class AttendanceScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async recordScope(user: RequestUser, sessionId?: string) {
    if (user.role === 'super_admin') {
      return { ...adminRecordWhere(user), ...(sessionId ? { sessionId } : {}) }
    }
    if (user.role === 'teacher') return { session: { teacherId: user.id }, ...(sessionId ? { sessionId } : {}) }
    return { studentId: user.id, ...(sessionId ? { sessionId } : {}) }
  }

  async sessionScope(user: RequestUser) {
    if (user.role === 'super_admin') {
      return adminSessionWhere(user)
    }
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { sectionId: { in: enrollments.map((item) => item.sectionId) } }
  }

  async rawRecordWhere(user: RequestUser, query: AttendanceListQueryDto) {
    const hasDateRange = Boolean(query.startDate || query.endDate)
    if (hasDateRange && (!query.startDate || !query.endDate)) {
      throw new BadRequestException('Raw attendance date scopes require both startDate and endDate')
    }
    if (user.role !== 'student' && !query.sessionId && !query.sectionId && !hasDateRange) {
      throw new BadRequestException('Staff attendance lists require a sessionId, sectionId, or date range')
    }
    const range =
      query.startDate && query.endDate
        ? this.resolveDateRange(query.startDate, query.endDate, RAW_DATE_RANGE_DAYS, RAW_DATE_RANGE_DAYS)
        : undefined
    const sessionWhere: Prisma.SessionWhereInput = {
      AND: [await this.sessionScope(user), ...(range ? [{ date: { gte: range.startDate, lte: range.endDate } }] : [])],
    }
    return {
      AND: [
        await this.recordScope(user),
        { session: sessionWhere },
        ...(query.sessionId ? [{ sessionId: query.sessionId }] : []),
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
      ],
    } satisfies Prisma.AttendanceRecordWhereInput
  }

  async filteredSessionScope(
    user: RequestUser,
    query: AttendanceReportQueryDto,
    range: { startDate: string; endDate: string },
  ): Promise<Prisma.SessionWhereInput> {
    if (user.role === 'teacher' && query.teacherId && query.teacherId !== user.id) {
      throw new ForbiddenException('Teachers can only report on their own attendance')
    }
    return {
      AND: [
        await this.sessionScope(user),
        { date: { gte: range.startDate, lte: range.endDate } },
        ...(query.teacherId ? [{ teacherId: query.teacherId }] : []),
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
        ...(query.sessionId ? [{ id: query.sessionId }] : []),
        ...(query.subjectId ? [{ section: { subjectId: query.subjectId } }] : []),
      ],
    }
  }

  resolveDateRange(
    requestedStart: string | undefined,
    requestedEnd: string | undefined,
    maximumDays: number,
    defaultDays: number,
  ) {
    const endDate = requestedEnd ?? formatCampusDate()
    const parsedEnd = this.parseDate(endDate)
    const defaultStart = new Date(parsedEnd)
    defaultStart.setUTCDate(defaultStart.getUTCDate() - (defaultDays - 1))
    const startDate = requestedStart ?? defaultStart.toISOString().slice(0, 10)
    const parsedStart = this.parseDate(startDate)
    if (parsedEnd < parsedStart) throw new BadRequestException('endDate must be on or after startDate')
    const dayCount = Math.floor((parsedEnd.getTime() - parsedStart.getTime()) / 86_400_000) + 1
    if (dayCount > maximumDays) {
      throw new BadRequestException(`Date ranges are limited to ${maximumDays} days`)
    }
    return { startDate, endDate }
  }

  private parseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Dates must use YYYY-MM-DD')
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Date is invalid')
    }
    return parsed
  }
}
