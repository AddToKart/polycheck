import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { AttendanceReportQueryDto } from './dto/attendance.dto'
import { AttendanceScopeService } from './attendance-scope.service'
import { REPORT_DATE_RANGE_DAYS, REPORT_SECTION_LIMIT } from './types'

@Injectable()
export class AttendanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AttendanceScopeService,
  ) {}

  async report(user: RequestUser, query: AttendanceReportQueryDto = {}) {
    const range = this.scope.resolveDateRange(query.startDate, query.endDate, REPORT_DATE_RANGE_DAYS, 30)
    const sessionWhere = await this.scope.filteredSessionScope(user, query, range)
    const recordWhere = {
      AND: [
        await this.scope.recordScope(user),
        { session: sessionWhere },
        ...(query.sectionId ? [{ sectionId: query.sectionId }] : []),
        ...(query.sessionId ? [{ sessionId: query.sessionId }] : []),
      ],
    }
    const sessionGroups = await this.prisma.session.groupBy({
      by: ['sectionId'],
      where: sessionWhere,
      _count: { _all: true },
      orderBy: { sectionId: 'asc' },
      take: REPORT_SECTION_LIMIT + 1,
    })
    if (sessionGroups.length > REPORT_SECTION_LIMIT) {
      throw new BadRequestException(`Reports are limited to ${REPORT_SECTION_LIMIT} sections; narrow the filters`)
    }
    const statusGroups = await this.prisma.attendanceRecord.groupBy({
      by: ['sectionId', 'status'],
      where: recordWhere,
      _count: { _all: true },
    })
    const sectionIds = [
      ...new Set([...statusGroups.map((group) => group.sectionId), ...sessionGroups.map((group) => group.sectionId)]),
    ]
    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds } },
      select: { id: true, subject: { select: { name: true } } },
    })
    const subjectNames = new Map(sections.map((section) => [section.id, section.subject.name]))
    const summaries = new Map(
      sectionIds.map((sectionId) => [
        sectionId,
        {
          sectionId,
          subjectName: subjectNames.get(sectionId) ?? sectionId,
          totalSessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          disputed: 0,
          pending: 0,
        },
      ]),
    )
    for (const group of sessionGroups) summaries.get(group.sectionId)!.totalSessions = group._count._all
    for (const group of statusGroups) summaries.get(group.sectionId)![group.status] = group._count._all
    const rows = [...summaries.values()].sort((left, right) => left.subjectName.localeCompare(right.subjectName))
    const totals = rows.reduce(
      (total, row) => ({
        totalRecords: total.totalRecords + row.present + row.late + row.absent + row.pending + row.disputed,
        totalSessions: total.totalSessions + row.totalSessions,
        present: total.present + row.present,
        late: total.late + row.late,
        absent: total.absent + row.absent,
        pending: total.pending + row.pending,
        disputed: total.disputed + row.disputed,
      }),
      { totalRecords: 0, totalSessions: 0, present: 0, late: 0, absent: 0, pending: 0, disputed: 0 },
    )
    return { range, totals, summaries: rows }
  }

  async summaries(user: RequestUser, query: AttendanceReportQueryDto = {}) {
    return (await this.report(user, query)).summaries
  }
}
