import { ForbiddenException, Injectable } from '@nestjs/common'
import type { AttendanceStandingStatus, StudentAtRisk } from '@polycheck/shared'
import { academicOversightDepartment } from '../common/designations/department-pin'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StandingService } from '../standing/standing.service'
import { adminSectionWhere } from '../common/admin-scope'
import { attendanceStandingFromRate, computeAttendanceRate } from '../common/utils/attendance-rate'
import type { AtRiskQueryDto } from './dto/attendance.dto'
import { REPORT_SECTION_LIMIT } from './types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const STATUS_RANK: Record<AttendanceStandingStatus, number> = {
  below_threshold: 0,
  at_risk: 1,
  on_track: 2,
  insufficient_data: 3,
}

/**
 * The deterministic at-risk classification shared by the at-risk list, the
 * F5 referral gate, and the CHED notice document (same math everywhere).
 * Counts come from the shared attendance-rate helper: pending/disputed/excused
 * rows are excluded and incomplete (half-attended) rows count toward the
 * denominator but not as attended sessions.
 */
export interface AtRiskClassification {
  thresholdPercent: number
  present: number
  late: number
  absent: number
  countedSessions: number
  attendedSessions: number
  attendanceRate: number | null
  absencesBeforeBelowThreshold: number | null
  status: AttendanceStandingStatus
}

export function classifyAtRiskRow(counts: Record<string, number>, thresholdPercent: number): AtRiskClassification {
  const present = counts.present ?? 0
  const late = counts.late ?? 0
  const absent = counts.absent ?? 0
  const incomplete = counts.incomplete ?? 0
  // Same denominator as `/me/standing` and the class record: pending/disputed/
  // excused rows are excluded and a half-attended session counts as not
  // attended. One incomplete can no longer flip a student between surfaces.
  const rate = computeAttendanceRate({ present, late, absent, incomplete })
  const standing = attendanceStandingFromRate(rate, thresholdPercent)
  return {
    thresholdPercent,
    present,
    late,
    absent,
    ...rate,
    ...standing,
  }
}

/** True when the engine currently says this student deserves a CHED slip. */
export function isReferralEligible(classification: Pick<AtRiskClassification, 'status'>): boolean {
  return classification.status === 'below_threshold' || classification.status === 'at_risk'
}

interface SectionInfo {
  id: string
  name: string
  subjectName: string
  professorName: string
}

interface StudentSectionRow {
  studentId: string
  studentName: string
  studentNumber?: string
  sectionId: string
  sectionName: string
  subjectName: string
  professorName: string
  thresholdPercent: number
  attendanceRate: number | null
  status: AttendanceStandingStatus
  absencesBeforeBelowThreshold: number | null
  lastAbsenceDate?: string
}

@Injectable()
export class AttendanceAtRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly standing: StandingService,
  ) {}

  async list(user: RequestUser, query: AtRiskQueryDto = {}): Promise<StudentAtRisk[]> {
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      throw new ForbiddenException('At-risk oversight is only available to teachers and administrators')
    }
    const limit = Math.min(Math.max(1, Math.floor(query.limit ?? DEFAULT_LIMIT)), MAX_LIMIT)
    const oversight = academicOversightDepartment(user)
    const sectionWhere: Prisma.SectionWhereInput = {
      ...(user.role === 'teacher'
        ? oversight
          ? { teacher: { department: { equals: oversight, mode: 'insensitive' as const } } }
          : { teacherId: user.id }
        : adminSectionWhere(user)),
      ...(query.sectionId ? { id: query.sectionId } : {}),
    }
    if (query.sectionId) {
      const allowed = await this.prisma.section.findFirst({ where: sectionWhere, select: { id: true } })
      if (!allowed) throw new ForbiddenException('This section is outside your scope')
    }

    const sections = await this.prisma.section.findMany({
      where: sectionWhere,
      select: {
        id: true,
        section: true,
        subject: { select: { name: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { section: 'asc' }],
      take: REPORT_SECTION_LIMIT,
    })
    if (sections.length === 0) return []
    const sectionIds = sections.map((section) => section.id)
    const [thresholdPercent, enrollments, grouped] = await Promise.all([
      this.standing.thresholdPercent(),
      this.prisma.enrollment.findMany({
        where: { sectionId: { in: sectionIds } },
        select: {
          sectionId: true,
          student: { select: { id: true, studentId: true, fullName: true } },
        },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['sectionId', 'studentId', 'status'],
        where: { sectionId: { in: sectionIds } },
        _count: { _all: true },
        _max: { timestamp: true },
      }),
    ])

    const counts = new Map<string, Record<string, number>>()
    const lastAbsence = new Map<string, Date>()
    for (const group of grouped) {
      const key = this.key(group.sectionId, group.studentId)
      const entry = counts.get(key) ?? {}
      entry[group.status] = group._count._all
      counts.set(key, entry)
      if (group.status === 'absent' && group._max.timestamp) {
        const previous = lastAbsence.get(key)
        if (!previous || group._max.timestamp > previous) lastAbsence.set(key, group._max.timestamp)
      }
    }

    const sectionsById = new Map<string, SectionInfo>(
      sections.map((section) => [
        section.id,
        {
          id: section.id,
          name: section.section,
          subjectName: section.subject.name,
          professorName: section.teacher.fullName,
        },
      ]),
    )
    const rows: StudentSectionRow[] = []
    for (const enrollment of enrollments) {
      const section = sectionsById.get(enrollment.sectionId)
      if (!section) continue
      const key = this.key(enrollment.sectionId, enrollment.student.id)
      const statusCounts = counts.get(key) ?? {}
      const classification = classifyAtRiskRow(statusCounts, thresholdPercent)
      const lastAbsenceDate = lastAbsence.get(key)
      rows.push({
        studentId: enrollment.student.id,
        studentName: enrollment.student.fullName,
        ...(enrollment.student.studentId ? { studentNumber: enrollment.student.studentId } : {}),
        sectionId: section.id,
        sectionName: section.name,
        subjectName: section.subjectName,
        professorName: section.professorName,
        thresholdPercent: classification.thresholdPercent,
        attendanceRate: classification.attendanceRate,
        status: classification.status,
        absencesBeforeBelowThreshold: classification.absencesBeforeBelowThreshold,
        ...(lastAbsenceDate ? { lastAbsenceDate: lastAbsenceDate.toISOString().slice(0, 10) } : {}),
      })
    }

    rows.sort(
      (left, right) =>
        STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
        (left.attendanceRate ?? Number.POSITIVE_INFINITY) - (right.attendanceRate ?? Number.POSITIVE_INFINITY) ||
        left.studentName.localeCompare(right.studentName) ||
        left.sectionName.localeCompare(right.sectionName),
    )
    return rows.slice(0, limit)
  }

  /**
   * Single-row classification for one (section, student) pair — the F5 referral
   * gate and the CHED notice reuse the exact engine math without loading the
   * whole roster. Resolves null when the student has no records in the section
   * (the referral gate treats unknown data as ineligible).
   */
  async classifyStudent(sectionId: string, studentId: string): Promise<AtRiskClassification | null> {
    const [thresholdPercent, grouped] = await Promise.all([
      this.standing.thresholdPercent(),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { sectionId, studentId },
        _count: { _all: true },
      }),
    ])
    if (grouped.length === 0) return null
    const counts: Record<string, number> = {}
    for (const group of grouped) counts[group.status] = group._count._all
    return classifyAtRiskRow(counts, thresholdPercent)
  }

  private key(sectionId: string, studentId: string) {
    return `${sectionId}:${studentId}`
  }
}
