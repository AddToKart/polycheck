import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '@prisma/client'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async events(user: RequestUser, startDate: string, endDate: string) {
    this.assertDateRange(startDate, endDate)
    const sessions = await this.prisma.session.findMany({
      where: { ...(await this.sessionScope(user)), date: { gte: startDate, lte: endDate } },
      include: {
        section: { include: { subject: true, teacher: { select: { fullName: true } } } },
        attendanceRecords: { where: user.role === 'student' ? { studentId: user.id } : {} },
      },
    })
    return sessions.map((session) => ({
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
      status: session.isActive ? ('active' as const) : ('completed' as const),
      teacherName: session.section.teacher.fullName,
      subjectCode: session.section.subject.code,
      studentStatus: user.role === 'student' ? session.attendanceRecords[0]?.status : undefined,
      isRescheduled: session.isRescheduled,
      rescheduledFromDate: session.rescheduledFromDate ?? undefined,
    }))
  }

  async exportCsv(user: RequestUser, sectionId?: string, sessionId?: string) {
    const where = {
      ...(await this.recordScope(user)),
      ...(sectionId ? { sectionId } : {}),
      ...(sessionId ? { sessionId } : {}),
    }
    const total = await this.prisma.attendanceRecord.count({ where })
    if (total > 50_000) throw new BadRequestException('Export is limited to 50,000 records; narrow the filters')
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: { session: { select: { date: true, startTime: true, subjectName: true } } },
      orderBy: { timestamp: 'asc' },
    })
    const escape = (value: unknown) => {
      const text = String(value ?? '')
      const formulaSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
      return `"${formulaSafe.replaceAll('"', '""')}"`
    }
    const rows = [
      ['Student', 'Student ID', 'Subject', 'Date', 'Start time', 'Status', 'Checked in at', 'Latitude', 'Longitude'],
      ...records.map((record) => [
        record.studentName,
        record.studentId,
        record.session.subjectName,
        record.session.date,
        record.session.startTime,
        record.status,
        record.timestamp.toISOString(),
        record.latitude,
        record.longitude,
      ]),
    ]
    return rows.map((row) => row.map(escape).join(',')).join('\n')
  }

  async search(user: RequestUser, q: string) {
    if (!q?.trim()) return { students: [], sections: [], sessions: [] }
    const query = q.trim()
    const sectionScope = await this.sectionScope(user)
    const [sections, sessions] = await Promise.all([
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
        include: { schedule: true, teacher: { select: { fullName: true } }, subject: true },
        take: 8,
      }),
      this.prisma.session.findMany({
        where: {
          AND: [
            await this.sessionScope(user),
            { OR: [{ subjectName: { contains: query, mode: 'insensitive' } }, { date: { contains: query } }] },
          ],
        },
        take: 8,
      }),
    ])
    const students =
      user.role === 'student'
        ? []
        : await this.prisma.user.findMany({
            where: {
              role: 'student',
              ...(user.role === 'teacher' ? { enrollments: { some: { section: { teacherId: user.id } } } } : {}),
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { studentId: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              studentId: true,
              fullName: true,
              email: true,
              program: true,
              yearLevel: true,
              photoUrl: true,
              isActive: true,
            },
            take: 10,
          })
    return {
      students,
      sections: sections.map((section) => ({ ...section, teacherName: section.teacher.fullName })),
      sessions: sessions.map(({ qrToken: _qrToken, ...session }) => ({
        ...session,
        geofence: {
          latitude: session.geofenceLatitude,
          longitude: session.geofenceLongitude,
          radiusMeters: session.geofenceRadiusMeters,
        },
      })),
    }
  }

  private async sectionScope(user: RequestUser): Promise<Prisma.SectionWhereInput> {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return {}
      return user.department ? { teacher: { department: user.department } } : { id: { in: [] } }
    }
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { id: { in: enrollments.map((item) => item.sectionId) } }
  }

  private async sessionScope(user: RequestUser): Promise<Prisma.SessionWhereInput> {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return {}
      return user.department ? { section: { teacher: { department: user.department } } } : { id: { in: [] } }
    }
    if (user.role === 'teacher') return { teacherId: user.id }
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    return { sectionId: { in: enrollments.map((item) => item.sectionId) } }
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
