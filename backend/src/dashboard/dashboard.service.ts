import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '@prisma/client'

const CALENDAR_RESULT_LIMIT = 2_000
const EXPORT_RESULT_LIMIT = 25_000
const EXPORT_BATCH_SIZE = 1_000
const REPORT_RANGE_DAYS = 366
const DASHBOARD_RANGE_DAYS = 90
const CAMPUS_TIME_ZONE = 'Asia/Manila'

const campusDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const campusDate = (date = new Date()) => {
  const parts = new Map(campusDateFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

type ReportFilters = {
  startDate?: string
  endDate?: string
  teacherId?: string
  subjectId?: string
  sectionId?: string
  sessionId?: string
}

const calendarSessionSelect = {
  id: true,
  subjectName: true,
  date: true,
  startTime: true,
  endTime: true,
  room: true,
  sectionId: true,
  isActive: true,
  endedAt: true,
  isRescheduled: true,
  rescheduledFromDate: true,
  section: {
    select: {
      section: true,
      teacher: { select: { fullName: true } },
      subject: { select: { code: true } },
    },
  },
} as const satisfies Prisma.SessionSelect

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async events(user: RequestUser, startDate: string, endDate: string) {
    this.assertDateRange(startDate, endDate)
    const query = {
      where: { ...this.sessionScope(user), date: { gte: startDate, lte: endDate } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      take: CALENDAR_RESULT_LIMIT,
    } satisfies Prisma.SessionFindManyArgs
    const sessions =
      user.role === 'student'
        ? (
            await this.prisma.session.findMany({
              ...query,
              select: {
                ...calendarSessionSelect,
                attendanceRecords: {
                  where: { studentId: user.id },
                  select: { status: true },
                  take: 1,
                },
              },
            })
          ).map((session) => ({ session, studentStatus: session.attendanceRecords[0]?.status }))
        : (await this.prisma.session.findMany({ ...query, select: calendarSessionSelect })).map((session) => ({
            session,
            studentStatus: undefined,
          }))
    return sessions.map(({ session, studentStatus }) => ({
      id: session.id,
      title: session.subjectName,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room ?? undefined,
      sectionId: session.sectionId,
      subjectName: session.subjectName,
      sectionName: session.section.section,
      type: 'session' as const,
      status: session.isActive ? ('active' as const) : session.endedAt ? ('completed' as const) : ('inactive' as const),
      teacherName: session.section.teacher.fullName,
      subjectCode: session.section.subject.code,
      studentStatus,
      isRescheduled: session.isRescheduled,
      rescheduledFromDate: session.rescheduledFromDate ?? undefined,
    }))
  }

  async overview(user: RequestUser, requested: Pick<ReportFilters, 'startDate' | 'endDate'> = {}) {
    const range = this.resolveDateRange(requested.startDate, requested.endDate, DASHBOARD_RANGE_DAYS, 7)
    const sessionScope = this.sessionScope(user)
    const recordScope = await this.recordScope(user)
    const [counts, sessionsToday, pendingDisputes, recentAttendance, recentDisputes, trendSessions] = await Promise.all(
      [
        this.overviewCounts(user),
        this.prisma.session.count({
          where: { AND: [sessionScope, { date: campusDate() }] },
        }),
        this.prisma.attendanceRecord.count({
          where: { AND: [recordScope, { status: 'disputed', disputeResolved: false }] },
        }),
        this.prisma.attendanceRecord.findMany({
          where: { AND: [recordScope, { status: { not: 'pending' } }] },
          select: {
            id: true,
            sessionId: true,
            sectionId: true,
            studentName: true,
            timestamp: true,
            status: true,
            session: { select: { subjectName: true } },
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
        }),
        this.prisma.attendanceRecord.findMany({
          where: { AND: [recordScope, { status: 'disputed', disputeResolved: false }] },
          select: { id: true, sectionId: true, studentName: true, timestamp: true, disputeReason: true },
          orderBy: { timestamp: 'desc' },
          take: 5,
        }),
        this.prisma.session.findMany({
          where: { AND: [sessionScope, { date: { gte: range.startDate, lte: range.endDate } }] },
          select: { id: true, date: true },
        }),
      ],
    )
    const trendGroups = await this.prisma.attendanceRecord.groupBy({
      by: ['sessionId', 'status'],
      where: { AND: [recordScope, { sessionId: { in: trendSessions.map((session) => session.id) } }] },
      _count: { _all: true },
    })
    const trendDates = new Map(trendSessions.map((session) => [session.id, session.date]))
    const trends = new Map<string, { date: string; present: number; late: number; absent: number; disputed: number }>()
    for (const date of this.dateSequence(range.startDate, range.endDate)) {
      trends.set(date, { date, present: 0, late: 0, absent: 0, disputed: 0 })
    }
    for (const group of trendGroups) {
      const date = trendDates.get(group.sessionId)
      if (!date || group.status === 'pending') continue
      trends.get(date)![group.status] += group._count._all
    }
    return {
      counts: { ...counts, sessionsToday, pendingDisputes },
      trendRange: range,
      trends: [...trends.values()],
      recentAttendance: recentAttendance.map(({ session, timestamp, ...record }) => ({
        ...record,
        subjectName: session.subjectName,
        timestamp: timestamp.toISOString(),
      })),
      recentDisputes: recentDisputes.map((record) => ({
        ...record,
        disputeReason: record.disputeReason ?? undefined,
        timestamp: record.timestamp.toISOString(),
      })),
    }
  }

  async exportCsv(user: RequestUser, filters: ReportFilters = {}) {
    const range = this.resolveDateRange(filters.startDate, filters.endDate, REPORT_RANGE_DAYS, 30)
    const where = await this.filteredRecordScope(user, filters, range)
    const total = await this.prisma.attendanceRecord.count({ where })
    if (total > EXPORT_RESULT_LIMIT) {
      throw new BadRequestException(
        `Export is limited to ${EXPORT_RESULT_LIMIT.toLocaleString()} records; narrow the filters`,
      )
    }
    const escape = (value: unknown) => {
      const text = String(value ?? '')
      const formulaSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
      return `"${formulaSafe.replaceAll('"', '""')}"`
    }
    const lines = [
      ['Student', 'Student ID', 'Subject', 'Date', 'Start time', 'Status', 'Checked in at', 'Latitude', 'Longitude']
        .map(escape)
        .join(','),
    ]
    let cursor: string | undefined
    while (lines.length - 1 < total) {
      const remaining = total - (lines.length - 1)
      const records = await this.prisma.attendanceRecord.findMany({
        where,
        select: {
          id: true,
          studentName: true,
          studentId: true,
          status: true,
          timestamp: true,
          latitude: true,
          longitude: true,
          session: { select: { date: true, startTime: true, subjectName: true } },
        },
        orderBy: { id: 'asc' },
        take: Math.min(EXPORT_BATCH_SIZE, remaining),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (records.length === 0) break
      for (const record of records) {
        lines.push(
          [
            record.studentName,
            record.studentId,
            record.session.subjectName,
            record.session.date,
            record.session.startTime,
            record.status,
            record.timestamp.toISOString(),
            record.latitude,
            record.longitude,
          ]
            .map(escape)
            .join(','),
        )
      }
      cursor = records.at(-1)!.id
    }
    return lines.join('\n')
  }

  async search(user: RequestUser, q: string) {
    const query = q?.trim()
    if (!query || query.length < 2) throw new BadRequestException('Search requires at least 2 characters')

    const sectionScope = this.sectionScope(user)
    const sessionScope = this.sessionScope(user)
    const studentsQuery =
      user.role === 'student'
        ? Promise.resolve([])
        : this.prisma.user.findMany({
            where: {
              role: 'student',
              ...(user.role === 'teacher' ? { enrollments: { some: { section: { teacherId: user.id } } } } : {}),
              ...(user.role === 'super_admin' && user.scope !== 'institution'
                ? user.department
                  ? { department: user.department }
                  : { id: { in: [] } }
                : {}),
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { studentId: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              studentId: true,
              fullName: true,
              program: true,
            },
            orderBy: { fullName: 'asc' },
            take: 10,
          })
    const [sections, sessions, students] = await Promise.all([
      this.prisma.section.findMany({
        where: {
          AND: [
            sectionScope,
            {
              OR: [
                { section: { contains: query, mode: 'insensitive' } },
                { room: { contains: query, mode: 'insensitive' } },
                {
                  subject: {
                    is: {
                      OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { code: { contains: query, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          subjectId: true,
          section: true,
          room: true,
        },
        orderBy: { section: 'asc' },
        take: 8,
      }),
      this.prisma.session.findMany({
        where: {
          AND: [
            sessionScope,
            { OR: [{ subjectName: { contains: query, mode: 'insensitive' } }, { date: { contains: query } }] },
          ],
        },
        select: {
          id: true,
          sectionId: true,
          subjectName: true,
          date: true,
          startTime: true,
          endTime: true,
          room: true,
          isActive: true,
          isRescheduled: true,
          rescheduledFromDate: true,
        },
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }, { id: 'asc' }],
        take: 8,
      }),
      studentsQuery,
    ])
    return {
      students: students.map((student) => ({
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        program: student.program,
      })),
      sections: sections.map((section) => ({
        id: section.id,
        subjectId: section.subjectId,
        section: section.section,
        room: section.room,
      })),
      sessions: sessions.map((session) => ({
        id: session.id,
        sectionId: session.sectionId,
        subjectName: session.subjectName,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room,
        isActive: session.isActive,
        isRescheduled: session.isRescheduled,
        rescheduledFromDate: session.rescheduledFromDate,
      })),
    }
  }

  private async overviewCounts(user: RequestUser) {
    if (user.role === 'teacher') {
      const sectionWhere: Prisma.SectionWhereInput = { teacherId: user.id }
      const [sections, subjects, students] = await Promise.all([
        this.prisma.section.count({ where: sectionWhere }),
        this.prisma.section.groupBy({ by: ['subjectId'], where: sectionWhere }),
        this.prisma.enrollment.groupBy({ by: ['studentId'], where: { section: sectionWhere } }),
      ])
      return { faculty: 1, students: students.length, subjects: subjects.length, sections }
    }

    const department = user.scope === 'institution' ? undefined : user.department
    const inaccessible = user.scope !== 'institution' && !department
    const teacherWhere: Prisma.UserWhereInput = {
      role: 'teacher',
      ...(department ? { department } : {}),
      ...(inaccessible ? { id: { in: [] } } : {}),
    }
    const studentWhere: Prisma.UserWhereInput = {
      role: 'student',
      ...(department ? { department } : {}),
      ...(inaccessible ? { id: { in: [] } } : {}),
    }
    const sectionWhere = this.sectionScope(user)
    const [faculty, students, subjects, sections] = await Promise.all([
      this.prisma.user.count({ where: teacherWhere }),
      this.prisma.user.count({ where: studentWhere }),
      this.prisma.subject.count({
        where: user.scope === 'institution' ? {} : { sections: { some: sectionWhere } },
      }),
      this.prisma.section.count({ where: sectionWhere }),
    ])
    return { faculty, students, subjects, sections }
  }

  private async filteredRecordScope(
    user: RequestUser,
    filters: ReportFilters,
    range: { startDate: string; endDate: string },
  ): Promise<Prisma.AttendanceRecordWhereInput> {
    if (user.role === 'teacher' && filters.teacherId && filters.teacherId !== user.id) {
      throw new ForbiddenException('Teachers can only export their own attendance')
    }
    const sessionWhere: Prisma.SessionWhereInput = {
      AND: [
        this.sessionScope(user),
        { date: { gte: range.startDate, lte: range.endDate } },
        ...(filters.teacherId ? [{ teacherId: filters.teacherId }] : []),
        ...(filters.subjectId ? [{ section: { subjectId: filters.subjectId } }] : []),
        ...(filters.sectionId ? [{ sectionId: filters.sectionId }] : []),
        ...(filters.sessionId ? [{ id: filters.sessionId }] : []),
      ],
    }
    return {
      AND: [
        await this.recordScope(user),
        { session: sessionWhere },
        ...(filters.sectionId ? [{ sectionId: filters.sectionId }] : []),
        ...(filters.sessionId ? [{ sessionId: filters.sessionId }] : []),
      ],
    }
  }

  private resolveDateRange(
    requestedStart: string | undefined,
    requestedEnd: string | undefined,
    maximumDays: number,
    defaultDays: number,
  ) {
    const endDate = requestedEnd ?? campusDate()
    const end = this.parseDate(endDate)
    const defaultStart = new Date(end)
    defaultStart.setUTCDate(defaultStart.getUTCDate() - (defaultDays - 1))
    const startDate = requestedStart ?? defaultStart.toISOString().slice(0, 10)
    const start = this.parseDate(startDate)
    if (end < start) throw new BadRequestException('endDate must be on or after startDate')
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
    if (days > maximumDays) throw new BadRequestException(`Date ranges are limited to ${maximumDays} days`)
    return { startDate, endDate }
  }

  private parseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Dates must use YYYY-MM-DD')
    const date = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Date is invalid')
    }
    return date
  }

  private dateSequence(startDate: string, endDate: string) {
    const dates: string[] = []
    const cursor = this.parseDate(startDate)
    const end = this.parseDate(endDate)
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return dates
  }

  private sectionScope(user: RequestUser): Prisma.SectionWhereInput {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return {}
      return user.department ? { teacher: { department: user.department } } : { id: { in: [] } }
    }
    if (user.role === 'teacher') return { teacherId: user.id }
    return { enrollments: { some: { studentId: user.id } } }
  }

  private sessionScope(user: RequestUser): Prisma.SessionWhereInput {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return {}
      return user.department ? { section: { teacher: { department: user.department } } } : { id: { in: [] } }
    }
    if (user.role === 'teacher') return { teacherId: user.id }
    return { section: { enrollments: { some: { studentId: user.id } } } }
  }

  private async recordScope(user: RequestUser): Promise<Prisma.AttendanceRecordWhereInput> {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return {}
      return user.department
        ? { session: { section: { teacher: { department: user.department } } } }
        : { id: { in: [] } }
    }
    if (user.role === 'teacher') return { session: { teacherId: user.id } }
    return { studentId: user.id }
  }

  private assertDateRange(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`)
    const end = new Date(`${endDate}T00:00:00.000Z`)
    if (end < start) throw new BadRequestException('endDate must be on or after startDate')
    if (end.getTime() - start.getTime() > 366 * 86_400_000) {
      throw new BadRequestException('Calendar ranges are limited to one year')
    }
  }
}
