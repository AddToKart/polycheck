import { ForbiddenException, Injectable, Optional } from '@nestjs/common'
import type { AttendanceStanding, AttendanceStandingStatus } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

const ATTENDANCE_THRESHOLD_KEY = 'attendance_min_rate_percent'
const DEFAULT_THRESHOLD_PERCENT = 75
const MIN_THRESHOLD_PERCENT = 0
const MAX_THRESHOLD_PERCENT = 100

interface StandingSection {
  id: string
  section: string
  subject: { name: string; code: string }
  teacher: { fullName: string }
  attendanceRecords: Array<{
    status: string
    timestamp: Date
    session: { date: string } | null
  }>
}

interface StatusCounts {
  present: number
  late: number
  absent: number
  pending: number
  disputed: number
  excused: number
}

@Injectable()
export class StandingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async thresholdPercent(): Promise<number> {
    const setting = await this.prisma.institutionSetting.findUnique({
      where: { key: ATTENDANCE_THRESHOLD_KEY },
      select: { value: true },
    })
    if (!setting) return DEFAULT_THRESHOLD_PERCENT
    const parsed = Number(setting.value)
    if (!Number.isFinite(parsed)) return DEFAULT_THRESHOLD_PERCENT
    return Math.min(MAX_THRESHOLD_PERCENT, Math.max(MIN_THRESHOLD_PERCENT, Math.round(parsed)))
  }

  async forStudent(user: RequestUser): Promise<AttendanceStanding[]> {
    this.assertStudent(user)
    const [thresholdPercent, sections] = await Promise.all([
      this.thresholdPercent(),
      this.prisma.section.findMany({
        where: { enrollments: { some: { studentId: user.id } } },
        select: this.sectionSelect(user.id),
        orderBy: [{ subject: { name: 'asc' } }, { section: 'asc' }],
      }),
    ])
    const standings = sections
      .map((section) => this.evaluate(section, thresholdPercent))
      .sort(
        (left, right) =>
          left.subjectName.localeCompare(right.subjectName) || left.sectionName.localeCompare(right.sectionName),
      )
    for (const standing of standings) await this.maybeNotify(standing, user)
    return standings
  }

  /**
   * Evaluates a single section for a student. Returns null when the student is
   * not enrolled in that section, so callers can map the result to their own
   * not-found/denied contract.
   */
  async forStudentSection(user: RequestUser, sectionId: string): Promise<AttendanceStanding | null> {
    this.assertStudent(user)
    const [thresholdPercent, section] = await Promise.all([
      this.thresholdPercent(),
      this.prisma.section.findFirst({
        where: { id: sectionId, enrollments: { some: { studentId: user.id } } },
        select: this.sectionSelect(user.id),
      }),
    ])
    if (!section) return null
    return this.evaluate(section, thresholdPercent)
  }

  private assertStudent(user: RequestUser) {
    if (user.role !== 'student') {
      throw new ForbiddenException('Attendance standing is only available to students')
    }
  }

  private sectionSelect(studentId: string) {
    return {
      id: true,
      section: true,
      subject: { select: { name: true, code: true } },
      teacher: { select: { fullName: true } },
      attendanceRecords: {
        where: { studentId },
        select: {
          status: true,
          timestamp: true,
          session: { select: { date: true } },
        },
      },
    } as const satisfies Prisma.SectionSelect
  }

  private evaluate(section: StandingSection, thresholdPercent: number): AttendanceStanding {
    const counts: StatusCounts = { present: 0, late: 0, absent: 0, pending: 0, disputed: 0, excused: 0 }
    let lastSessionDate: string | undefined
    for (const record of section.attendanceRecords) {
      switch (record.status) {
        case 'present':
          counts.present += 1
          break
        case 'late':
          counts.late += 1
          break
        case 'absent':
          counts.absent += 1
          break
        case 'pending':
          counts.pending += 1
          break
        case 'disputed':
          counts.disputed += 1
          break
        case 'excused':
          counts.excused += 1
          break
      }
      const date = record.session?.date ?? record.timestamp.toISOString().slice(0, 10)
      if (!lastSessionDate || date > lastSessionDate) lastSessionDate = date
    }

    const countedSessions = counts.present + counts.late + counts.absent
    const attendedSessions = counts.present + counts.late
    const attendanceRate = countedSessions === 0 ? null : roundOneDecimal((attendedSessions / countedSessions) * 100)
    const absencesBeforeBelowThreshold =
      countedSessions === 0 || thresholdPercent <= 0
        ? null
        : Math.max(0, Math.floor((attendedSessions * 100) / thresholdPercent) - countedSessions)
    const status: AttendanceStandingStatus =
      countedSessions === 0
        ? 'insufficient_data'
        : attendanceRate! < thresholdPercent
          ? 'below_threshold'
          : absencesBeforeBelowThreshold === 0
            ? 'at_risk'
            : 'on_track'

    const caveats: string[] = []
    if (counts.disputed > 0) {
      caveats.push(`${counts.disputed} disputed record(s) excluded from the rate.`)
    }
    if (counts.pending > 0) {
      caveats.push(`${counts.pending} pending record(s) excluded from the rate.`)
    }
    if (counts.excused > 0) {
      caveats.push(`${counts.excused} excused record(s) excluded from the rate.`)
    }

    return {
      sectionId: section.id,
      subjectName: section.subject.name,
      subjectCode: section.subject.code,
      sectionName: section.section,
      professorName: section.teacher.fullName,
      thresholdPercent,
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      disputed: counts.disputed,
      countedSessions,
      attendanceRate,
      status,
      absencesBeforeBelowThreshold,
      ...(lastSessionDate ? { lastSessionDate } : {}),
      ...(caveats.length > 0 ? { caveat: caveats.join(' ') } : {}),
    }
  }

  private async maybeNotify(standing: AttendanceStanding, user: RequestUser) {
    if (!this.notifications) return
    if (standing.status !== 'below_threshold' && standing.status !== 'at_risk') return
    await this.notifications.notifyStandingRisk(user.id, {
      sectionId: standing.sectionId,
      subjectName: standing.subjectName,
      status: standing.status,
      attendanceRate: standing.attendanceRate,
    })
  }
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}
