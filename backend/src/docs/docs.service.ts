import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PDFDocument from 'pdfkit'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { clampRetentionDays, consentCoveragePercent, PRIVACY_DATA_INVENTORY } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { adminSectionInScope } from '../common/admin-scope'
import { academicOversightDepartment } from '../common/designations/department-pin'
import { GEOLOCATION_RETENTION_DAYS_KEY } from '../common/constants/privacy'
import { classifyAtRiskRow, type AtRiskClassification } from '../attendance/attendance-at-risk.service'
import { PrismaService } from '../prisma/prisma.service'

export type MasterListFormat = 'pdf' | 'docx'
export type SessionAttendanceFormat = 'csv' | 'pdf'
export type DpoSummaryFormat = 'pdf' | 'docx'
export type ClassRecordFormat = 'pdf' | 'docx'
export type AtRiskNoticeFormat = 'pdf' | 'docx'

export interface GeneratedDocument {
  filename: string
  contentType: string
  body: Buffer
}

interface PdfColumn {
  readonly header: string
  readonly width: number
}

const DEFAULT_INSTITUTION_NAME = 'Polytechnic University of the Philippines'
const INSTITUTION_NAME_KEY = 'institution_name'
const GEOLOCATION_RETENTION_FALLBACK_DAYS = 30
const MASTER_LIST_TITLE = 'CLASS MASTER LIST'
const SESSION_ATTENDANCE_TITLE = 'SESSION ATTENDANCE'
const DPO_SUMMARY_TITLE = 'DATA PROTECTION OFFICER — COMPLIANCE SUMMARY (RA 10173)'
/** PDF Info-dictionary title stays ASCII: pdfkit hex-escapes non-Latin1 glyphs (—). */
const DPO_SUMMARY_INFO_TITLE = 'DATA PROTECTION OFFICER - COMPLIANCE SUMMARY (RA 10173)'
const CLASS_RECORD_TITLE = 'OFFICIAL CLASS RECORD'
const CAMPUS_LINE = 'Santa Maria Campus'
const MS_PER_DAY = 24 * 60 * 60 * 1000
/** Official PUP grading sheet covers an 18-week semester (WF-LD6 / F4). */
export const CLASS_RECORD_WEEKS = 18
/**
 * Footer sign-off of the official class record; one boxed area each with
 * signature and date lines (rendered identically from the constant).
 */
export const CLASS_RECORD_SIGNOFF_LINES = [
  'Instructor signature over printed name',
  'Endorsed by: Department Chairperson',
  "Dean's Office stamp box",
] as const
const DOCX_FONT = 'Helvetica'
const PDF_FONT = 'Helvetica'
const PDF_FONT_BOLD = 'Helvetica-Bold'
const PDF_MARGIN_X = 50
const PDF_CONTENT_WIDTH = 495
const PDF_BODY_TOP = 118
const PDF_BOTTOM = 56
const PDF_TABLE_HEADER_HEIGHT = 18
const PDF_TABLE_ROW_HEIGHT = 16
const PUP_MAROON = '#7B1113'
const ZEBRA_FILL = '#F3EDED'
const LANDSCAPE_MARGIN_X = 50
const LANDSCAPE_CONTENT_WIDTH = 742
const LANDSCAPE_BODY_TOP = 150
const CLASS_RECORD_ROW_HEIGHT = 13
const CLASS_RECORD_HEADER_HEIGHT = 16
const SIGNOFF_BOX_GAP = 16
const CLASS_RECORD_SECTION_HEIGHT = 74
const SIGNATURE_LINES = [
  'Prepared by: ____________________  Instructor',
  'Verified by: ____________________  Program Chair',
] as const
const A4_WIDTH_TWIPS = 11906
const A4_HEIGHT_TWIPS = 16838

// ── F5 (WF-LD7): CHED CMO No. 40 notice of impending drop ──

const NOTICE_LINE_HEIGHT = 12
const NOTICE_HEADING_HEIGHT = 14

export const AT_RISK_NOTICE_TITLE = 'NOTICE OF IMPENDING DROP'
/** PDF Info-dictionary title stays ASCII (pdfkit hex-escapes non-Latin1 glyphs). */
const AT_RISK_NOTICE_INFO_TITLE = AT_RISK_NOTICE_TITLE
export const AT_RISK_NOTICE_CITATION_LINES = [
  'Pursuant to CHED CMO No. 40 and Article V, Section 21 of the PUP',
  'Student Handbook: a student whose unexcused absences reach twenty percent (20%)',
  'of the scheduled class sessions may be issued this notice of impending drop.',
] as const
export const AT_RISK_NOTICE_ACTIONS = ['Guidance counseling', 'Chair consultation', 'Parental contact'] as const
export const AT_RISK_NOTICE_SIGNOFFS = ['Advisor', 'Guidance Counselor', 'Department Chairperson'] as const
const ATTENDANCE_THRESHOLD_FALLBACK_PERCENT = 75
/** Institution-configurable minimum attendance rate (keep in sync with StandingService). */
const ATTENDANCE_THRESHOLD_SETTING_KEY = 'attendance_min_rate_percent'

/** Ledger table plan for the notice (green-stamp columns, 495pt body). */
export const AT_RISK_NOTICE_LEDGER_COLUMNS = [
  { key: 'date', header: 'Session date', width: 130 },
  { key: 'time', header: 'Time', width: 90 },
  { key: 'status', header: 'Status', width: 110 },
] as const

export interface NoticeLedgerRow {
  /** Session calendar date (YYYY-MM-DD) or the record timestamp date fallback. */
  date: string
  /** Scheduled start time (HH:mm) when the session is known. */
  time?: string
  status: string
}

/**
 * The directive-fixed computation line: absence percentage against counted
 * sessions, anchored to CHED's 20% impending-drop rule.
 */
export function noticeComputationLine(absences: number, countedSessions: number): string {
  const rate = countedSessions === 0 ? 0 : Math.round((absences / countedSessions) * 1000) / 10
  return `${absences} unexcused absences of ${countedSessions} sessions = ${rate}% — at/below the 20% impending-drop threshold`
}

export const MASTER_LIST_COLUMNS = [
  { key: 'index', header: 'No.', width: 32 },
  { key: 'studentNumber', header: 'Student Number', width: 92 },
  { key: 'fullName', header: 'Full Name', width: 171 },
  { key: 'program', header: 'Program', width: 130 },
  { key: 'yearLevel', header: 'Year Level', width: 70 },
] as const

export const SESSION_ATTENDANCE_COLUMNS = [
  { key: 'studentNumber', header: 'Student Number', width: 110 },
  { key: 'fullName', header: 'Full Name', width: 205 },
  { key: 'status', header: 'Status', width: 80 },
  { key: 'timestamp', header: 'Timestamp', width: 100 },
] as const

const DPO_INVENTORY_COLUMNS: readonly PdfColumn[] = [
  { header: 'Personal data', width: 150 },
  { header: 'Purpose', width: 130 },
  { header: 'Lawful basis', width: 100 },
  { header: 'Lifetime', width: 115 },
]

/** Weekly session symbols of the official class record (P/L/A/E/I/–). */
export const CLASS_RECORD_WEEK_SYMBOLS: Record<string, string> = {
  present: 'P',
  late: 'L',
  absent: 'A',
  excused: 'E',
  incomplete: 'I',
} as const

/** Landscape column plan: 740pt total inside the 742pt A4-landscape body. */
const CLASS_RECORD_FIXED_COLUMNS = [
  { header: 'No.', width: 24 },
  { header: 'Student Number', width: 78 },
  { header: 'Full Name', width: 140 },
] as const
const CLASS_RECORD_WEEK_COLUMN_WIDTH = 20
const CLASS_RECORD_TOTAL_COLUMNS = [
  { header: 'P', width: 23 },
  { header: 'L', width: 23 },
  { header: 'A', width: 23 },
  { header: 'E', width: 23 },
  { header: 'Rate %', width: 46 },
] as const

interface MasterListRow {
  index: string
  studentNumber: string
  fullName: string
  program: string
  yearLevel: string
}

interface SessionAttendanceRow {
  studentNumber: string
  fullName: string
  status: string
  timestamp: string
}

interface MasterListMeta {
  institutionName: string
  subjectName: string
  subjectCode: string
  sectionName: string
  semester: string
  room: string
  professorName: string
}

interface SessionAttendanceMeta {
  institutionName: string
  subjectName: string
  subjectCode: string
  sectionName: string
  semester: string
  room: string
  professorName: string
  date: string
  startTime: string
  endTime: string
}

const PDF_CONTENT_TYPE = 'application/pdf'
const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8'

interface DpoSummaryMeta {
  institutionName: string
  version: string
  retentionDays: number
  staleCoordinateRows: number
  covered: number
  totalActive: number
  coveragePercent: number | null
  verifiedAt: string
}

interface ClassRecordMeta {
  institutionName: string
  subjectName: string
  subjectCode: string
  sectionName: string
  semester: string
  room: string
  professorName: string
  department: string
}

interface AtRiskNoticeMeta {
  institutionName: string
  studentName: string
  studentNumber: string
  program: string
  subjectName: string
  subjectCode: string
  sectionName: string
  semester: string
  professorName: string
  generatedBy: string
  generatedAt: string
  note?: string
}

@Injectable()
export class DocsService {
  constructor(
    private readonly prisma: PrismaService,
    // Optional for legacy unit specs that construct the service directly.
    @Optional() private readonly config?: ConfigService,
  ) {}

  async masterList(user: RequestUser, sectionId: string, format: MasterListFormat): Promise<GeneratedDocument> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        id: true,
        teacherId: true,
        section: true,
        room: true,
        semester: true,
        subject: { select: { name: true, code: true } },
        teacher: { select: { fullName: true } },
        enrollments: {
          select: {
            student: {
              select: { studentId: true, fullName: true, program: true, yearLevel: true },
            },
          },
          orderBy: { student: { fullName: 'asc' } },
        },
      },
    })
    if (!section) throw new NotFoundException('Section not found')
    await this.assertSectionAccess(user, section.id, section.teacherId)

    const institutionName = await this.institutionName()
    const meta: MasterListMeta = {
      institutionName,
      subjectName: section.subject.name,
      subjectCode: section.subject.code,
      sectionName: section.section,
      semester: section.semester,
      room: section.room,
      professorName: section.teacher.fullName,
    }
    const rows: MasterListRow[] = section.enrollments.map((enrollment, index) => ({
      index: String(index + 1),
      studentNumber: enrollment.student.studentId ?? '',
      fullName: enrollment.student.fullName,
      program: enrollment.student.program ?? '',
      yearLevel: enrollment.student.yearLevel == null ? '' : String(enrollment.student.yearLevel),
    }))
    const filename = `master-list-${sanitizeFilenamePart(section.section)}-${sanitizeFilenamePart(
      section.subject.code,
    )}.${format}`

    if (format === 'docx') {
      return {
        filename,
        contentType: DOCX_CONTENT_TYPE,
        body: await this.renderMasterListDocx(meta, rows),
      }
    }
    return {
      filename,
      contentType: PDF_CONTENT_TYPE,
      body: await this.renderMasterListPdf(meta, rows),
    }
  }

  async sessionAttendance(
    user: RequestUser,
    sessionId: string,
    format: SessionAttendanceFormat,
  ): Promise<GeneratedDocument> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        sectionId: true,
        teacherId: true,
        subjectName: true,
        date: true,
        startTime: true,
        endTime: true,
        room: true,
        section: {
          select: {
            section: true,
            room: true,
            semester: true,
            subject: { select: { name: true, code: true } },
            teacher: { select: { fullName: true } },
            enrollments: {
              select: {
                student: { select: { id: true, studentId: true, fullName: true } },
              },
              orderBy: { student: { fullName: 'asc' } },
            },
          },
        },
        attendanceRecords: {
          select: {
            studentId: true,
            studentName: true,
            status: true,
            timestamp: true,
            student: { select: { studentId: true, fullName: true } },
          },
        },
      },
    })
    if (!session) throw new NotFoundException('Session not found')
    await this.assertSectionAccess(user, session.sectionId, session.teacherId)

    const institutionName = await this.institutionName()
    const meta: SessionAttendanceMeta = {
      institutionName,
      subjectName: session.subjectName || session.section.subject.name,
      subjectCode: session.section.subject.code,
      sectionName: session.section.section,
      semester: session.section.semester,
      room: session.room ?? session.section.room,
      professorName: session.section.teacher.fullName,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
    }
    const rows = this.sessionAttendanceRows(session)
    const counts = this.statusCounts(rows)
    const filename = `attendance-${sanitizeFilenamePart(session.section.section)}-${sanitizeFilenamePart(
      session.date,
    )}.${format}`

    if (format === 'csv') {
      return {
        filename,
        contentType: CSV_CONTENT_TYPE,
        body: Buffer.from(this.renderSessionAttendanceCsv(rows, counts), 'utf8'),
      }
    }
    return {
      filename,
      contentType: PDF_CONTENT_TYPE,
      body: await this.renderSessionAttendancePdf(meta, rows, counts),
    }
  }

  /**
   * F6: RA 10173 one-pager for the DPO. All numbers are computed live at
   * render time — the retention attestation counts rows that still carry
   * coordinates past the window, so an inactive shredder can never produce a
   * clean attestation.
   */
  async dpoSummary(user: RequestUser, format: DpoSummaryFormat): Promise<GeneratedDocument> {
    this.assertItOperationsAccess(user)
    const institutionName = await this.institutionName()
    const version = this.privacyNoticeVersion()
    const retentionDays = await this.geolocationRetentionDays()
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY)
    const staleWhere = {
      timestamp: { lt: cutoff },
      OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
    }
    const [staleRecords, staleAttempts, covered, totalActive] = await Promise.all([
      this.prisma.attendanceRecord.count({ where: staleWhere }),
      this.prisma.scanAttempt.count({ where: staleWhere }),
      this.prisma.user.count({ where: { isActive: true, privacyConsentVersion: version } }),
      this.prisma.user.count({ where: { isActive: true } }),
    ])
    const meta: DpoSummaryMeta = {
      institutionName,
      version,
      retentionDays,
      staleCoordinateRows: staleRecords + staleAttempts,
      covered,
      totalActive,
      coveragePercent: consentCoveragePercent(covered, totalActive),
      verifiedAt: new Date().toISOString(),
    }
    const filename = `dpo-summary.${format}`
    if (format === 'docx') {
      return { filename, contentType: DOCX_CONTENT_TYPE, body: await this.renderDpoSummaryDocx(meta) }
    }
    return { filename, contentType: PDF_CONTENT_TYPE, body: await this.renderDpoSummaryPdf(meta) }
  }

  /**
   * F4 (WF-LD6): the 1-click official PUP class record. Scoped like the master
   * list with one widening — the academic-oversight department head may read
   * the class record of any section taught by a colleague in their department.
   */
  async classRecord(
    user: RequestUser,
    sectionId: string,
    format: ClassRecordFormat,
    fromOverride?: string | null,
  ): Promise<GeneratedDocument> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        id: true,
        teacherId: true,
        section: true,
        room: true,
        semester: true,
        subject: { select: { name: true, code: true } },
        teacher: { select: { fullName: true, department: true } },
        enrollments: {
          select: { student: { select: { id: true, studentId: true, fullName: true } } },
          orderBy: { student: { fullName: 'asc' } },
        },
        sessions: {
          select: { id: true, date: true, startTime: true },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        },
      },
    })
    if (!section) throw new NotFoundException('Section not found')
    await this.assertClassRecordAccess(user, {
      id: section.id,
      teacherId: section.teacherId,
      teacherDepartment: section.teacher.department,
    })

    const records = await this.prisma.attendanceRecord.findMany({
      where: { sectionId: section.id },
      select: { studentId: true, status: true, sessionId: true },
    })
    const grid = buildClassRecordGrid(
      section.sessions,
      records,
      section.enrollments.map((enrollment) => ({
        studentId: enrollment.student.id,
        studentNumber: enrollment.student.studentId,
        fullName: enrollment.student.fullName,
      })),
      CLASS_RECORD_WEEKS,
      fromOverride ?? undefined,
    )
    const meta: ClassRecordMeta = {
      institutionName: await this.institutionName(),
      subjectName: section.subject.name,
      subjectCode: section.subject.code,
      sectionName: section.section,
      semester: section.semester,
      room: section.room,
      professorName: section.teacher.fullName,
      department: section.teacher.department ?? '',
    }
    const filename = `PUP-ClassRecord-${sanitizeFilenamePart(section.subject.code)}-${sanitizeFilenamePart(
      section.section,
    )}-${sanitizeFilenamePart(section.semester)}.${format}`
    if (format === 'docx') {
      return { filename, contentType: DOCX_CONTENT_TYPE, body: await this.renderClassRecordDocx(meta, grid) }
    }
    return { filename, contentType: PDF_CONTENT_TYPE, body: await this.renderClassRecordPdf(meta, grid) }
  }

  /**
   * F5 (WF-LD7): the official CHED "Notice of Impending Drop" slip. Same
   * parties as the referral read scope (owning teacher / department head /
   * scoped super admin). The absence ledger and the computation line come from
   * the same deterministic engine math as the at-risk list — the document is
   * server-rendered and cannot be gamed from the UI.
   */
  async atRiskNotice(user: RequestUser, referralId: string, format: AtRiskNoticeFormat): Promise<GeneratedDocument> {
    const referral = await this.prisma.atRiskReferral.findUnique({
      where: { id: referralId },
      include: {
        student: { select: { id: true, studentId: true, fullName: true, program: true } },
        section: {
          select: {
            section: true,
            semester: true,
            teacherId: true,
            subject: { select: { name: true, code: true } },
            teacher: { select: { fullName: true, department: true } },
          },
        },
        generatedBy: { select: { fullName: true } },
      },
    })
    if (!referral) throw new NotFoundException('Referral not found')
    await this.assertNoticeAccess(user, {
      id: referral.sectionId,
      teacherId: referral.section.teacherId,
      teacherDepartment: referral.section.teacher.department,
    })

    const [thresholdPercent, grouped, ledgerRaw] = await Promise.all([
      this.attendanceMinRatePercent(),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { sectionId: referral.sectionId, studentId: referral.studentId },
        _count: { _all: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { sectionId: referral.sectionId, studentId: referral.studentId, status: 'absent' },
        select: {
          timestamp: true,
          notes: true,
          session: { select: { date: true, startTime: true } },
        },
      }),
    ])
    const counts: Record<string, number> = {}
    for (const group of grouped) counts[group.status] = group._count._all
    const classification = classifyAtRiskRow(counts, thresholdPercent)
    const ledger = buildNoticeLedgerRows(ledgerRaw)
    const meta: AtRiskNoticeMeta = {
      institutionName: await this.institutionName(),
      studentName: referral.student.fullName,
      studentNumber: referral.student.studentId ?? '',
      program: referral.student.program ?? '',
      subjectName: referral.section.subject.name,
      subjectCode: referral.section.subject.code,
      sectionName: referral.section.section,
      semester: referral.section.semester,
      professorName: referral.section.teacher.fullName,
      generatedBy: referral.generatedBy.fullName,
      generatedAt: referral.createdAt.toISOString(),
      note: referral.note ?? undefined,
    }
    const filename = `PUP-AtRiskNotice-${sanitizeFilenamePart(meta.studentNumber || 'STUDENT')}-${sanitizeFilenamePart(
      referral.section.section,
    )}.${format}`
    if (format === 'docx') {
      return {
        filename,
        contentType: DOCX_CONTENT_TYPE,
        body: await this.renderNoticeDocx(meta, ledger, classification),
      }
    }
    return { filename, contentType: PDF_CONTENT_TYPE, body: await this.renderNoticePdf(meta, ledger, classification) }
  }

  private sessionAttendanceRows(session: {
    section: {
      enrollments: Array<{ student: { id: string; studentId: string | null; fullName: string } }>
    }
    attendanceRecords: Array<{
      studentId: string
      studentName: string
      status: string
      timestamp: Date
      student: { studentId: string | null; fullName: string | null }
    }>
  }): SessionAttendanceRow[] {
    const recordsByStudent = new Map(session.attendanceRecords.map((record) => [record.studentId, record]))
    const enrolledStudentIds = new Set(session.section.enrollments.map((enrollment) => enrollment.student.id))
    const rosterRows = session.section.enrollments.map((enrollment) => {
      const record = recordsByStudent.get(enrollment.student.id)
      return {
        studentNumber: enrollment.student.studentId ?? '',
        fullName: enrollment.student.fullName,
        status: record?.status ?? 'pending',
        timestamp: record && record.status !== 'pending' ? record.timestamp.toISOString() : '',
      }
    })
    const removedRows = session.attendanceRecords
      .filter((record) => !enrolledStudentIds.has(record.studentId))
      .sort((left, right) =>
        (left.student.fullName ?? left.studentName).localeCompare(right.student.fullName ?? right.studentName),
      )
      .map((record) => ({
        studentNumber: record.student.studentId ?? '',
        fullName: record.student.fullName ?? record.studentName,
        status: record.status,
        timestamp: record.status === 'pending' ? '' : record.timestamp.toISOString(),
      }))
    return [...rosterRows, ...removedRows]
  }

  private statusCounts(rows: SessionAttendanceRow[]): Record<string, number> {
    const counts: Record<string, number> = {
      present: 0,
      late: 0,
      absent: 0,
      pending: 0,
      disputed: 0,
      excused: 0,
      incomplete: 0,
    }
    for (const row of rows) {
      counts[row.status] = (counts[row.status] ?? 0) + 1
    }
    return counts
  }

  private renderSessionAttendanceCsv(rows: SessionAttendanceRow[], counts: Record<string, number>): string {
    const lines = [
      SESSION_ATTENDANCE_COLUMNS.map((column) => escapeCsv(column.header)).join(','),
      ...rows.map((row) => SESSION_ATTENDANCE_COLUMNS.map((column) => escapeCsv(row[column.key])).join(',')),
      '',
      [escapeCsv('Status'), escapeCsv('Count')].join(','),
      ...[
        ['Present', counts.present],
        ['Late', counts.late],
        ['Absent', counts.absent],
        ['Incomplete', counts.incomplete],
        ['Pending', counts.pending],
        ['Disputed', counts.disputed],
        ['Excused', counts.excused],
        ['Total', rows.length],
      ].map(([label, count]) => [escapeCsv(label), escapeCsv(count)].join(',')),
    ]
    return lines.join('\n')
  }

  private renderMasterListPdf(meta: MasterListMeta, rows: MasterListRow[]): Promise<Buffer> {
    return this.renderPdfTable({
      institutionName: meta.institutionName,
      title: MASTER_LIST_TITLE,
      metaLines: [
        `Subject: ${meta.subjectName} (${meta.subjectCode})`,
        `Section: ${meta.sectionName}   Semester: ${meta.semester}   Room: ${meta.room}`,
        `Professor: ${meta.professorName}`,
      ],
      columns: MASTER_LIST_COLUMNS,
      rows: rows.map((row) => MASTER_LIST_COLUMNS.map((column) => row[column.key])),
      signature: true,
    })
  }

  private renderSessionAttendancePdf(
    meta: SessionAttendanceMeta,
    rows: SessionAttendanceRow[],
    counts: Record<string, number>,
  ): Promise<Buffer> {
    return this.renderPdfTable({
      institutionName: meta.institutionName,
      title: SESSION_ATTENDANCE_TITLE,
      metaLines: [
        `Subject: ${meta.subjectName} (${meta.subjectCode})`,
        `Section: ${meta.sectionName}   Semester: ${meta.semester}   Room: ${meta.room}`,
        `Professor: ${meta.professorName}`,
        `Date: ${meta.date}   Time: ${meta.startTime} - ${meta.endTime}`,
      ],
      columns: SESSION_ATTENDANCE_COLUMNS,
      rows: rows.map((row) => SESSION_ATTENDANCE_COLUMNS.map((column) => row[column.key])),
      summaryLines: [
        `Present: ${counts.present}   Late: ${counts.late}   Absent: ${counts.absent}   Incomplete: ${counts.incomplete}`,
        `Pending: ${counts.pending}   Disputed: ${counts.disputed}   Excused: ${counts.excused}   Total: ${rows.length}`,
      ],
    })
  }

  /** Shared stream sink for the bespoke renderers below (same pattern as renderPdfTable). */
  private openPdfSink(doc: PDFKit.PDFDocument): Promise<Buffer> {
    const chunks: Buffer[] = []
    return new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })
  }

  private renderDpoSummaryPdf(meta: DpoSummaryMeta): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PDF_BODY_TOP, bottom: PDF_BOTTOM, left: PDF_MARGIN_X, right: PDF_MARGIN_X },
      bufferPages: true,
      info: { Title: DPO_SUMMARY_INFO_TITLE, Author: meta.institutionName, Creator: 'Polycheck' },
    })
    const completed = this.openPdfSink(doc)
    let y = this.drawPdfSectionHeading(doc, 'Data inventory — what Polycheck stores and why', PDF_BODY_TOP)
    y = this.drawInventoryPdfTable(doc, y + 6)
    y += 12
    y = this.drawPdfSectionHeading(doc, 'Retention attestation', y)
    y = this.drawPdfLines(doc, y, [
      `${meta.staleCoordinateRows} coordinate rows older than ${meta.retentionDays} days — verified ${meta.verifiedAt}`,
      `Enforced nightly by the telemetry shredder (03:00); the window is institution-configurable between 7 and 90 days (currently ${meta.retentionDays}).`,
    ])
    y += 10
    y = this.drawPdfSectionHeading(doc, 'Consent coverage', y)
    y = this.drawPdfLines(doc, y, [
      meta.coveragePercent === null
        ? 'No active accounts yet — coverage reports after the first consent is captured.'
        : `${meta.coveragePercent}% of active accounts on notice v${meta.version} (${meta.covered} of ${meta.totalActive} active accounts).`,
    ])
    y += 10
    y = this.drawPdfSectionHeading(doc, 'Lawful basis', y)
    y = this.drawPdfLines(doc, y, [
      'RA 10173 §12/§13 — legitimate educational interests: attendance and academic records are processed to produce official class records, at-risk notices, and registrar reports.',
      `Consent: geofence verification for in-person check-ins relies on the RA 10173 notice captured at onboarding (notice v${meta.version}).`,
    ])
    y += 10
    y = this.drawPdfSectionHeading(doc, 'Breach log', y)
    y = this.drawPdfLines(doc, y, ['None recorded.'])
    y += 10
    this.drawPdfSectionHeading(doc, 'Data protection officer', y)
    this.drawPdfLines(doc, y + 11, [
      `Institution: ${meta.institutionName}`,
      'Email: dpo@example.edu.ph   Phone: (000) 000-0000',
      "Office: Registrar's Office, Main Building, Santa Maria Campus",
      '(Contact lines are placeholders until the institution publishes its DPO directory.)',
    ])
    this.decoratePdfPages(doc, {
      institutionName: meta.institutionName,
      title: DPO_SUMMARY_TITLE,
      metaLines: [
        `Privacy notice version: v${meta.version}`,
        `Geolocation retention window: ${meta.retentionDays} day(s)`,
      ],
    })
    doc.end()
    return completed
  }

  private drawPdfSectionHeading(doc: PDFKit.PDFDocument, heading: string, y: number): number {
    doc.font(PDF_FONT_BOLD).fontSize(8).fillColor(PUP_MAROON).text(heading.toUpperCase(), PDF_MARGIN_X, y, {
      width: PDF_CONTENT_WIDTH,
      lineBreak: false,
      ellipsis: true,
    })
    return y + 11
  }

  /** Draws wrapped lines and returns the y-pointer measured with heightOfString. */
  private drawPdfLines(doc: PDFKit.PDFDocument, startY: number, lines: readonly string[], size = 7.5): number {
    let y = startY
    for (const line of lines) {
      doc.font(PDF_FONT).fontSize(size).fillColor('#111111')
      const height = doc.heightOfString(line, { width: PDF_CONTENT_WIDTH })
      doc.text(line, PDF_MARGIN_X, y, { width: PDF_CONTENT_WIDTH })
      y += height + 2.5
    }
    return y
  }

  /** Inventory rows wrap; every row is measured so columns stay aligned. */
  private drawInventoryPdfTable(doc: PDFKit.PDFDocument, startY: number): number {
    let y = startY
    const bottomLimit = doc.page.height - PDF_BOTTOM - 24
    const drawHeaderRow = () => {
      let x = PDF_MARGIN_X
      doc.rect(x, y, PDF_CONTENT_WIDTH, PDF_TABLE_HEADER_HEIGHT).fillColor('#EFEAEA').fill()
      for (const column of DPO_INVENTORY_COLUMNS) {
        doc
          .font(PDF_FONT_BOLD)
          .fontSize(7.5)
          .fillColor('#111111')
          .text(column.header, x + 4, y + 5, { width: column.width - 8, ellipsis: true, lineBreak: false })
        doc.rect(x, y, column.width, PDF_TABLE_HEADER_HEIGHT).lineWidth(0.5).strokeColor('#7A7A7A').stroke()
        x += column.width
      }
      y += PDF_TABLE_HEADER_HEIGHT
    }
    drawHeaderRow()
    const rowValues = PRIVACY_DATA_INVENTORY.map((row) => [row.data, row.purpose, row.lawfulBasis, row.lifetime])
    for (let rowIndex = 0; rowIndex < rowValues.length; rowIndex++) {
      const values = rowValues[rowIndex]
      doc.font(PDF_FONT).fontSize(7).fillColor('#111111')
      let rowHeight = 7
      DPO_INVENTORY_COLUMNS.forEach((column, columnIndex) => {
        rowHeight = Math.max(rowHeight, doc.heightOfString(values[columnIndex] ?? '', { width: column.width - 8 }) + 6)
      })
      if (y + rowHeight > bottomLimit) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeaderRow()
      }
      let x = PDF_MARGIN_X
      DPO_INVENTORY_COLUMNS.forEach((column, columnIndex) => {
        if (rowIndex % 2 === 1) {
          doc.rect(x, y, column.width, rowHeight).fillColor(ZEBRA_FILL).fill()
        }
        doc
          .font(PDF_FONT)
          .fontSize(7)
          .fillColor('#111111')
          .text(values[columnIndex] ?? '', x + 4, y + 3, {
            width: column.width - 8,
            height: rowHeight,
            ellipsis: true,
          })
        doc.rect(x, y, column.width, rowHeight).lineWidth(0.5).strokeColor('#C4C4C4').stroke()
        x += column.width
      })
      y += rowHeight
    }
    return y
  }

  private renderDpoSummaryDocx(meta: DpoSummaryMeta): Promise<Buffer> {
    const inventoryRows = PRIVACY_DATA_INVENTORY.map((row) => [row.data, row.purpose, row.lawfulBasis, row.lifetime])
    const heading = (text: string, before: number) =>
      new Paragraph({
        spacing: { before },
        children: [new TextRun({ text, bold: true, size: 17, font: DOCX_FONT, color: '7B1113' })],
      })
    const body = (text: string) =>
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text, size: 16, font: DOCX_FONT })],
      })
    const document = new Document({
      creator: 'Polycheck',
      title: DPO_SUMMARY_TITLE,
      styles: { default: { document: { run: { font: DOCX_FONT, size: 20 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
              margin: { top: 1800, right: 1000, bottom: 1000, left: 1000, header: 400, footer: 500 },
            },
          },
          headers: {
            default: this.docxHeader(meta.institutionName, DPO_SUMMARY_TITLE, [
              `Privacy notice version: v${meta.version}`,
              `Geolocation retention window: ${meta.retentionDays} day(s)`,
            ]),
          },
          footers: { default: this.docxFooter() },
          children: [
            heading('DATA INVENTORY — WHAT POLYCHECK STORES AND WHY', 0),
            this.docxTable(DPO_INVENTORY_COLUMNS, inventoryRows),
            heading('RETENTION ATTESTATION', 200),
            body(
              `${meta.staleCoordinateRows} coordinate rows older than ${meta.retentionDays} days — verified ${meta.verifiedAt}`,
            ),
            body(
              `Enforced nightly by the telemetry shredder (03:00); the window is institution-configurable between 7 and 90 days (currently ${meta.retentionDays}).`,
            ),
            heading('CONSENT COVERAGE', 160),
            body(
              meta.coveragePercent === null
                ? 'No active accounts yet — coverage reports after the first consent is captured.'
                : `${meta.coveragePercent}% of active accounts on notice v${meta.version} (${meta.covered} of ${meta.totalActive} active accounts).`,
            ),
            heading('LAWFUL BASIS', 160),
            body(
              'RA 10173 §12/§13 — legitimate educational interests: attendance and academic records are processed to produce official class records, at-risk notices, and registrar reports.',
            ),
            body(
              `Consent: geofence verification for in-person check-ins relies on the RA 10173 notice captured at onboarding (notice v${meta.version}).`,
            ),
            heading('BREACH LOG', 160),
            body('None recorded.'),
            heading('DATA PROTECTION OFFICER', 160),
            body(`Institution: ${meta.institutionName}`),
            body('Email: dpo@example.edu.ph   Phone: (000) 000-0000'),
            body("Office: Registrar's Office, Main Building, Santa Maria Campus"),
            body('(Contact lines are placeholders until the institution publishes its DPO directory.)'),
          ],
        },
      ],
    })
    return Packer.toBuffer(document)
  }

  private classRecordColumns(weeks: number): PdfColumn[] {
    return [
      ...CLASS_RECORD_FIXED_COLUMNS,
      ...Array.from({ length: weeks }, (_, index) => ({
        header: `W${index + 1}`,
        width: CLASS_RECORD_WEEK_COLUMN_WIDTH,
      })),
      ...CLASS_RECORD_TOTAL_COLUMNS,
    ]
  }

  private classRecordRowCells(grid: ClassRecordGrid): string[][] {
    return grid.rows.map((row) => [
      String(row.index),
      row.studentNumber,
      row.fullName,
      ...row.cells,
      String(row.totals.present),
      String(row.totals.late),
      String(row.totals.absent),
      String(row.totals.excused),
      row.rate,
    ])
  }

  private renderClassRecordPdf(meta: ClassRecordMeta, grid: ClassRecordGrid): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: LANDSCAPE_BODY_TOP, bottom: PDF_BOTTOM, left: LANDSCAPE_MARGIN_X, right: LANDSCAPE_MARGIN_X },
      bufferPages: true,
      info: { Title: CLASS_RECORD_TITLE, Author: meta.institutionName, Creator: 'Polycheck' },
    })
    const completed = this.openPdfSink(doc)
    const columns = this.classRecordColumns(grid.weeks)
    let y = this.drawClassRecordTable(doc, columns, this.classRecordRowCells(grid), doc.page.margins.top)
    const requiredHeight = CLASS_RECORD_SECTION_HEIGHT + 18
    if (y + requiredHeight > doc.page.height - PDF_BOTTOM) {
      doc.addPage()
      y = doc.page.margins.top
    }
    this.drawSignoffBoxes(doc, y + 18)
    this.decorateClassRecordPdf(doc, meta, grid)
    doc.end()
    return completed
  }

  private drawClassRecordTable(
    doc: PDFKit.PDFDocument,
    columns: readonly PdfColumn[],
    rows: readonly (readonly string[])[],
    startY: number,
  ): number {
    let y = startY
    const totalWidth = columns.reduce((total, column) => total + column.width, 0)
    const bottomLimit = doc.page.height - PDF_BOTTOM - 24

    const drawHeaderRow = () => {
      let column = LANDSCAPE_MARGIN_X
      doc.rect(LANDSCAPE_MARGIN_X, y, totalWidth, CLASS_RECORD_HEADER_HEIGHT).fillColor('#EFEAEA').fill()
      for (const item of columns) {
        const alignment = this.classRecordCellAlignment(item.header)
        doc
          .font(PDF_FONT_BOLD)
          .fontSize(6.5)
          .fillColor('#111111')
          .text(item.header, column + 2, y + 5, {
            width: item.width - 4,
            height: CLASS_RECORD_HEADER_HEIGHT - 6,
            ellipsis: true,
            lineBreak: false,
            align: alignment,
          })
        doc.rect(column, y, item.width, CLASS_RECORD_HEADER_HEIGHT).lineWidth(0.5).strokeColor('#7A7A7A').stroke()
        column += item.width
      }
      y += CLASS_RECORD_HEADER_HEIGHT
    }

    drawHeaderRow()
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      if (y + CLASS_RECORD_ROW_HEIGHT > bottomLimit) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeaderRow()
      }
      if (rowIndex % 2 === 1) {
        doc.rect(LANDSCAPE_MARGIN_X, y, totalWidth, CLASS_RECORD_ROW_HEIGHT).fillColor(ZEBRA_FILL).fill()
      }
      let x = LANDSCAPE_MARGIN_X
      const values = rows[rowIndex] ?? []
      columns.forEach((column, columnIndex) => {
        doc
          .font(PDF_FONT)
          .fontSize(6.5)
          .fillColor('#111111')
          .text(values[columnIndex] ?? '', x + 2, y + 3.5, {
            width: column.width - 4,
            height: CLASS_RECORD_ROW_HEIGHT - 4,
            ellipsis: true,
            lineBreak: false,
            align: this.classRecordCellAlignment(column.header),
          })
        doc.rect(x, y, column.width, CLASS_RECORD_ROW_HEIGHT).lineWidth(0.5).strokeColor('#C4C4C4').stroke()
        x += column.width
      })
      y += CLASS_RECORD_ROW_HEIGHT
    }
    return y
  }

  private classRecordCellAlignment(header: string): 'left' | 'center' | 'right' {
    if (header === 'No.' || /^W\d+$/.test(header) || /^[PLAE]$/.test(header)) return 'center'
    if (header === 'Rate %') return 'right'
    return 'left'
  }

  private drawSignoffBoxes(doc: PDFKit.PDFDocument, startY: number): void {
    const gap = SIGNOFF_BOX_GAP
    const boxWidth = (LANDSCAPE_CONTENT_WIDTH - (CLASS_RECORD_SIGNOFF_LINES.length - 1) * gap) / 3
    const boxHeight = CLASS_RECORD_SECTION_HEIGHT
    CLASS_RECORD_SIGNOFF_LINES.forEach((caption, index) => {
      const x = LANDSCAPE_MARGIN_X + index * (boxWidth + gap)
      doc.rect(x, startY, boxWidth, boxHeight).lineWidth(0.75).strokeColor('#7A7A7A').stroke()
      this.drawSignoffBoxText(doc, x, startY, boxWidth, boxHeight, caption, index)
    })
  }

  private drawSignoffBoxText(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    boxWidth: number,
    boxHeight: number,
    caption: string,
    index: number,
  ): void {
    const isStampBox = index === CLASS_RECORD_SIGNOFF_LINES.length - 1
    doc
      .font(PDF_FONT_BOLD)
      .fontSize(7)
      .fillColor('#111111')
      .text(caption, x + 8, y + 6, { width: boxWidth - 16, ellipsis: true, lineBreak: false })
    doc.font(PDF_FONT).fontSize(7).fillColor('#111111')
    doc.text('_________________________', x + 8, y + 30, {
      width: boxWidth - 16,
      ellipsis: true,
      lineBreak: false,
    })
    doc
      .font(PDF_FONT)
      .fontSize(6.5)
      .fillColor('#333333')
      .text(
        isStampBox ? 'Received by: _________________________' : 'Printed name: _________________________',
        x + 8,
        y + 42,
        { width: boxWidth - 16, ellipsis: true, lineBreak: false },
      )
    doc
      .font(PDF_FONT)
      .fontSize(6.5)
      .fillColor('#333333')
      .text('Date: _______________________', x + 8, y + boxHeight - 16, {
        width: boxWidth - 16,
        ellipsis: true,
        lineBreak: false,
      })
  }

  private decorateClassRecordPdf(doc: PDFKit.PDFDocument, meta: ClassRecordMeta, grid: ClassRecordGrid): void {
    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index++) {
      doc.switchToPage(range.start + index)
      this.drawClassRecordPageHeader(doc, meta, grid)
      const bottomMargin = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc
        .font(PDF_FONT)
        .fontSize(8)
        .fillColor('#555555')
        .text(`Page ${index + 1} of ${range.count}`, LANDSCAPE_MARGIN_X, doc.page.height - 36, {
          width: LANDSCAPE_CONTENT_WIDTH,
          align: 'center',
          lineBreak: false,
        })
      doc.page.margins.bottom = bottomMargin
    }
  }

  private drawClassRecordPageHeader(doc: PDFKit.PDFDocument, meta: ClassRecordMeta, grid: ClassRecordGrid): void {
    const centerX = doc.page.width / 2
    const contentWidth = LANDSCAPE_CONTENT_WIDTH
    const centered = (text: string, y: number, size: number, bold: boolean, color: string) => {
      doc
        .font(bold ? PDF_FONT_BOLD : PDF_FONT)
        .fontSize(size)
        .fillColor(color)
        .text(text, LANDSCAPE_MARGIN_X, y, { width: contentWidth, align: 'center', lineBreak: false, ellipsis: true })
    }
    centered('Republic of the Philippines', 16, 9, false, '#333333')
    // Vector PUP seal: maroon monogram medallion (no bitmap asset is embedded).
    doc.circle(centerX, 42, 14).lineWidth(1.25).strokeColor(PUP_MAROON).stroke()
    centered('PUP', 37.5, 8, true, PUP_MAROON)
    centered(meta.institutionName, 58, 12, true, PUP_MAROON)
    centered(CAMPUS_LINE, 71, 9, false, '#333333')
    centered(CLASS_RECORD_TITLE, 82, 13, true, '#111111')
    centered(`Course: ${meta.subjectCode} — ${meta.subjectName}`, 97, 8.5, false, '#111111')
    centered(
      `Section: ${meta.sectionName}   Semester: ${meta.semester}   Room: ${meta.room}`,
      107,
      8.5,
      false,
      '#111111',
    )
    centered(
      meta.department
        ? `Instructor: ${meta.professorName}   College / Department: ${meta.department}`
        : `Instructor: ${meta.professorName}`,
      117,
      8.5,
      false,
      '#111111',
    )
    centered(
      `Weeks covered: ${grid.startIso} to ${grid.endIso}   Symbols: P present · L late · A absent · E excused · I incomplete · – no session`,
      127,
      7.5,
      false,
      '#555555',
    )
    doc
      .moveTo(LANDSCAPE_MARGIN_X, 138)
      .lineTo(LANDSCAPE_MARGIN_X + contentWidth, 138)
      .lineWidth(0.75)
      .strokeColor(PUP_MAROON)
      .stroke()
  }

  // ── F5 at-risk notice (WF-LD7) ──────────────────────────────────────────────

  private renderNoticePdf(
    meta: AtRiskNoticeMeta,
    ledger: NoticeLedgerRow[],
    classification: AtRiskClassification,
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PDF_BODY_TOP, bottom: PDF_BOTTOM, left: PDF_MARGIN_X, right: PDF_MARGIN_X },
      bufferPages: true,
      info: { Title: AT_RISK_NOTICE_INFO_TITLE, Author: meta.institutionName, Creator: 'Polycheck' },
    })
    const completed = this.openPdfSink(doc)
    const bottomLimit = doc.page.height - PDF_BOTTOM - 24

    let y = doc.page.margins.top
    const ensureSpace = (needed: number) => {
      if (y + needed > bottomLimit) {
        doc.addPage()
        y = doc.page.margins.top
      }
    }

    // Student block
    const studentLines = [
      ['Student name', meta.studentName],
      ['Student number', meta.studentNumber || '—'],
      ['Program', meta.program || '—'],
      ['Subject', `${meta.subjectName} (${meta.subjectCode})`],
      ['Section', `${meta.sectionName}   Semester: ${meta.semester}`],
      ['Professor', meta.professorName],
      ['Issued by', `${meta.generatedBy} on ${meta.generatedAt.slice(0, 10)}`],
      ...(meta.note ? ([['Referral note', meta.note]] as [string, string][]) : []),
    ]
    ensureSpace(NOTICE_HEADING_HEIGHT + studentLines.length * NOTICE_LINE_HEIGHT)
    y = this.drawPdfSectionHeading(doc, 'Student referred', y)
    y =
      this.drawPdfLines(
        doc,
        y,
        studentLines.map(([label, value]) => `${label}: ${value}`),
      ) + 8

    // Absence ledger (the counted absences that drove the threshold)
    const ledgerRows = ledger.map((row) => [
      row.date,
      row.time ?? '—',
      row.status === 'absent' ? 'Absent' : capitalizeStatus(row.status),
    ])
    ensureSpace(48 + ledgerRows.length * PDF_TABLE_ROW_HEIGHT)
    y = this.drawPdfSectionHeading(doc, 'Absence ledger — counting absences', y) + 2
    y = this.drawPdfTable(doc, AT_RISK_NOTICE_LEDGER_COLUMNS, ledgerRows, y) + 10

    // Computation + standing
    ensureSpace(NOTICE_LINE_HEIGHT * 6 + 24)
    y = this.drawPdfSectionHeading(doc, 'Computation', y)
    doc.font(PDF_FONT_BOLD).fontSize(7.5).fillColor('#111111')
    const computation = noticeComputationLine(classification.absent, classification.countedSessions)
    const computationHeight = doc.heightOfString(computation, { width: PDF_CONTENT_WIDTH })
    doc.text(computation, PDF_MARGIN_X, y, { width: PDF_CONTENT_WIDTH })
    y += computationHeight + 3
    y =
      this.drawPdfLines(doc, y, [
        `Attendance rate: ${classification.attendanceRate === null ? '—' : `${classification.attendanceRate}%`} of counted sessions (institution threshold ${classification.thresholdPercent}%).`,
        `Deterministic standing: ${classification.status}.`,
      ]) + 10

    // Citation (CHED CMO No. 40 / Article V Section 21 / PUP Student Handbook)
    ensureSpace(48)
    y = this.drawPdfSectionHeading(doc, 'Legal basis', y)
    y = this.drawPdfLines(doc, y, AT_RISK_NOTICE_CITATION_LINES) + 8

    // Action checkboxes
    const actionLine = AT_RISK_NOTICE_ACTIONS.map((action) => `[  ] ${action}`).join('     ')
    ensureSpace(NOTICE_LINE_HEIGHT * 3 + 8)
    y = this.drawPdfSectionHeading(doc, 'Recommended actions', y)
    y = this.drawPdfLines(doc, y, [actionLine]) + 10

    // Signature lines
    ensureSpace(AT_RISK_NOTICE_SIGNOFFS.length * 26 + 16)
    y = this.drawPdfSectionHeading(doc, 'Sign-off', y) + 10
    doc.font(PDF_FONT).fontSize(10).fillColor('#111111')
    for (const signoff of AT_RISK_NOTICE_SIGNOFFS) {
      doc.text(`${signoff}: _______________________________`, PDF_MARGIN_X, y, { lineBreak: false })
      y += 26
    }

    this.decoratePdfPages(doc, {
      institutionName: meta.institutionName,
      title: AT_RISK_NOTICE_TITLE,
      metaLines: [
        'Republic of the Philippines',
        'Santa Maria Campus',
        'CHED CMO No. 40 — Article V, Section 21',
        'PUP Student Handbook',
      ],
    })
    doc.end()
    return completed
  }

  private renderNoticeDocx(
    meta: AtRiskNoticeMeta,
    ledger: NoticeLedgerRow[],
    classification: AtRiskClassification,
  ): Promise<Buffer> {
    const centered = (text: string, size: number, bold: boolean, color?: string) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text, bold, size, font: DOCX_FONT, ...(color ? { color } : {}) })],
      })
    const heading = (text: string) =>
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text, bold: true, size: 17, font: DOCX_FONT, color: '7B1113' })],
      })
    const body = (text: string, bold = false) =>
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text, bold, size: 16, font: DOCX_FONT })],
      })
    const studentLines = [
      `Student name: ${meta.studentName}`,
      `Student number: ${meta.studentNumber || '—'}`,
      `Program: ${meta.program || '—'}`,
      `Subject: ${meta.subjectName} (${meta.subjectCode})`,
      `Section: ${meta.sectionName}   Semester: ${meta.semester}`,
      `Professor: ${meta.professorName}`,
      `Issued by: ${meta.generatedBy} on ${meta.generatedAt.slice(0, 10)}`,
      ...(meta.note ? [`Referral note: ${meta.note}`] : []),
    ]
    const document = new Document({
      creator: 'Polycheck',
      title: AT_RISK_NOTICE_TITLE,
      styles: { default: { document: { run: { font: DOCX_FONT, size: 20 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
              margin: { top: 1800, right: 1000, bottom: 1000, left: 1000, header: 400, footer: 500 },
            },
          },
          headers: {
            default: new Header({
              children: [
                centered(meta.institutionName, 20, true, '7B1113'),
                centered(AT_RISK_NOTICE_TITLE, 24, true),
                centered('Republic of the Philippines — Santa Maria Campus', 15, false),
                centered('CHED CMO No. 40 — Article V, Section 21 — PUP Student Handbook', 15, false),
              ],
            }),
          },
          footers: { default: this.docxFooter() },
          children: [
            heading('STUDENT REFERRED'),
            ...studentLines.map((line) => body(line)),
            heading('ABSENCE LEDGER — COUNTING ABSENCES'),
            this.docxTable(
              AT_RISK_NOTICE_LEDGER_COLUMNS,
              ledger.map((row) => [
                row.date,
                row.time ?? '—',
                row.status === 'absent' ? 'Absent' : capitalizeStatus(row.status),
              ]),
            ),
            heading('COMPUTATION'),
            body(noticeComputationLine(classification.absent, classification.countedSessions), true),
            body(
              `Attendance rate: ${classification.attendanceRate === null ? '—' : `${classification.attendanceRate}%`} of counted sessions (institution threshold ${classification.thresholdPercent}%).`,
            ),
            body(`Deterministic standing: ${classification.status}.`),
            heading('LEGAL BASIS'),
            ...AT_RISK_NOTICE_CITATION_LINES.map((line) => body(line)),
            heading('RECOMMENDED ACTIONS'),
            body(AT_RISK_NOTICE_ACTIONS.map((action) => `[  ] ${action}`).join('     ')),
            heading('SIGN-OFF'),
            ...AT_RISK_NOTICE_SIGNOFFS.map(
              (signoff, index) =>
                new Paragraph({
                  spacing: { before: index === 0 ? 120 : 280 },
                  children: [
                    new TextRun({
                      text: `${signoff}: _______________________________`,
                      font: DOCX_FONT,
                      size: 20,
                    }),
                  ],
                }),
            ),
          ],
        },
      ],
    })
    return Packer.toBuffer(document)
  }

  private renderClassRecordDocx(meta: ClassRecordMeta, grid: ClassRecordGrid): Promise<Buffer> {
    const columns = this.classRecordColumns(grid.weeks)
    const centered = (text: string, size: number, bold: boolean, color?: string) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text, bold, size, font: DOCX_FONT, ...(color ? { color } : {}) })],
      })
    const document = new Document({
      creator: 'Polycheck',
      title: CLASS_RECORD_TITLE,
      styles: { default: { document: { run: { font: DOCX_FONT, size: 18 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS, orientation: PageOrientation.LANDSCAPE },
              margin: { top: 2000, right: 900, bottom: 900, left: 900, header: 500, footer: 500 },
            },
          },
          headers: {
            default: new Header({
              children: [
                centered('Republic of the Philippines', 16, false),
                centered(meta.institutionName, 22, true, '7B1113'),
                centered(CAMPUS_LINE, 16, false),
                centered(CLASS_RECORD_TITLE, 24, true),
                centered(`Course: ${meta.subjectCode} — ${meta.subjectName}`, 15, false),
                centered(`Section: ${meta.sectionName}   Semester: ${meta.semester}   Room: ${meta.room}`, 15, false),
                centered(
                  meta.department
                    ? `Instructor: ${meta.professorName}   College / Department: ${meta.department}`
                    : `Instructor: ${meta.professorName}`,
                  15,
                  false,
                ),
                centered(
                  `Weeks covered: ${grid.startIso} to ${grid.endIso}   Symbols: P present · L late · A absent · E excused · I incomplete · – no session`,
                  13,
                  false,
                  '555555',
                ),
              ],
            }),
          },
          footers: { default: this.docxFooter() },
          children: [
            this.docxClassRecordTable(columns, this.classRecordRowCells(grid)),
            ...this.docxClassRecordSignoff(),
          ],
        },
      ],
    })
    return Packer.toBuffer(document)
  }

  /** Class-record DOCX table with zebra shading; width base = column-plan total (740). */
  private docxClassRecordTable(columns: readonly PdfColumn[], rows: readonly (readonly string[])[]): Table {
    const widthBase = columns.reduce((total, column) => total + column.width, 0)
    const header = new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: columns.map((column) => this.docxCell(column.header, column.width, true, widthBase)),
    })
    const body = rows.map(
      (row, rowIndex) =>
        new TableRow({
          cantSplit: true,
          children: columns.map((column, columnIndex) =>
            this.docxCell(
              row[columnIndex] ?? '',
              column.width,
              false,
              widthBase,
              rowIndex % 2 === 1 ? 'F3EDED' : undefined,
            ),
          ),
        }),
    )
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'C4C4C4' },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'C4C4C4' },
      },
      rows: [header, ...body],
    })
  }

  /** Three boxed sign-off areas (docx): caption, signature line, name/date lines. */
  private docxClassRecordSignoff(): (Paragraph | Table)[] {
    const stampBoxCaption = CLASS_RECORD_SIGNOFF_LINES[CLASS_RECORD_SIGNOFF_LINES.length - 1]
    const rows = [
      new TableRow({
        cantSplit: true,
        children: CLASS_RECORD_SIGNOFF_LINES.map(
          (caption) =>
            new TableCell({
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: caption, bold: true, size: 16, font: DOCX_FONT })],
                }),
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: '_____________________________________', size: 16, font: DOCX_FONT })],
                }),
                new Paragraph({
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text:
                        caption === stampBoxCaption
                          ? 'Received by: ___________________'
                          : 'Printed name: ___________________',
                      size: 14,
                      font: DOCX_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 60 },
                  children: [new TextRun({ text: 'Date: __________________________', size: 14, font: DOCX_FONT })],
                }),
              ],
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
            }),
        ),
      }),
    ]
    return [
      new Paragraph({ spacing: { before: 320 }, children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        },
        rows,
      }),
    ]
  }

  private renderPdfTable(options: {
    institutionName: string
    title: string
    metaLines: string[]
    columns: readonly PdfColumn[]
    rows: readonly (readonly string[])[]
    signature?: boolean
    summaryLines?: string[]
  }): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PDF_BODY_TOP, bottom: PDF_BOTTOM, left: PDF_MARGIN_X, right: PDF_MARGIN_X },
      bufferPages: true,
      info: {
        Title: options.title,
        Author: options.institutionName,
        Creator: 'Polycheck',
      },
    })
    const chunks: Buffer[] = []
    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    let y = this.drawPdfTable(doc, options.columns, options.rows, doc.page.margins.top)

    if (options.signature) {
      const requiredHeight = 28 + SIGNATURE_LINES.length * 28
      if (y + requiredHeight > doc.page.height - PDF_BOTTOM) {
        doc.addPage()
        y = doc.page.margins.top
      }
      y += 28
      doc.font(PDF_FONT).fontSize(10).fillColor('#111111')
      for (const line of SIGNATURE_LINES) {
        doc.text(line, PDF_MARGIN_X, y, { lineBreak: false })
        y += 28
      }
    }

    if (options.summaryLines?.length) {
      const requiredHeight = 18 + options.summaryLines.length * 16
      if (y + requiredHeight > doc.page.height - PDF_BOTTOM) {
        doc.addPage()
        y = doc.page.margins.top
      }
      y += 18
      doc.font(PDF_FONT_BOLD).fontSize(9).fillColor('#111111').text('Summary', PDF_MARGIN_X, y)
      y += 16
      doc.font(PDF_FONT).fontSize(9).fillColor('#111111')
      for (const line of options.summaryLines) {
        doc.text(line, PDF_MARGIN_X, y, { lineBreak: false })
        y += 16
      }
    }

    this.decoratePdfPages(doc, options)
    doc.end()
    return completed
  }

  private drawPdfTable(
    doc: PDFKit.PDFDocument,
    columns: readonly PdfColumn[],
    rows: readonly (readonly string[])[],
    startY: number,
  ): number {
    let y = startY
    const bottomLimit = doc.page.height - PDF_BOTTOM - 24

    const drawHeaderRow = () => {
      let x = PDF_MARGIN_X
      doc.rect(PDF_MARGIN_X, y, PDF_CONTENT_WIDTH, PDF_TABLE_HEADER_HEIGHT).fillColor('#EFEAEA').fill()
      for (const column of columns) {
        doc
          .font(PDF_FONT_BOLD)
          .fontSize(8.5)
          .fillColor('#111111')
          .text(column.header, x + 4, y + 4, {
            width: column.width - 8,
            height: PDF_TABLE_HEADER_HEIGHT - 6,
            ellipsis: true,
          })
        doc.rect(x, y, column.width, PDF_TABLE_HEADER_HEIGHT).lineWidth(0.5).strokeColor('#7A7A7A').stroke()
        x += column.width
      }
      y += PDF_TABLE_HEADER_HEIGHT
    }

    drawHeaderRow()
    for (const row of rows) {
      if (y + PDF_TABLE_ROW_HEIGHT > bottomLimit) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeaderRow()
      }
      let x = PDF_MARGIN_X
      for (let index = 0; index < columns.length; index++) {
        const column = columns[index]
        doc
          .font(PDF_FONT)
          .fontSize(8.5)
          .fillColor('#111111')
          .text(row[index] ?? '', x + 4, y + 4, {
            width: column.width - 8,
            height: PDF_TABLE_ROW_HEIGHT - 6,
            ellipsis: true,
          })
        doc.rect(x, y, column.width, PDF_TABLE_ROW_HEIGHT).lineWidth(0.5).strokeColor('#C4C4C4').stroke()
        x += column.width
      }
      y += PDF_TABLE_ROW_HEIGHT
    }
    return y
  }

  private decoratePdfPages(
    doc: PDFKit.PDFDocument,
    options: { institutionName: string; title: string; metaLines: string[] },
  ): void {
    const range = doc.bufferedPageRange()
    const pageCount = range.count
    for (let index = 0; index < pageCount; index++) {
      doc.switchToPage(range.start + index)
      const bottomMargin = doc.page.margins.bottom
      doc.page.margins.bottom = 0

      doc.font(PDF_FONT_BOLD).fontSize(10).fillColor(PUP_MAROON).text(options.institutionName, PDF_MARGIN_X, 24, {
        width: PDF_CONTENT_WIDTH,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      })
      doc.font(PDF_FONT_BOLD).fontSize(13).fillColor('#111111').text(options.title, PDF_MARGIN_X, 40, {
        width: PDF_CONTENT_WIDTH,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      })
      doc.font(PDF_FONT).fontSize(8.5).fillColor('#333333')
      options.metaLines.slice(0, 4).forEach((line, lineIndex) => {
        doc.text(line, PDF_MARGIN_X, 58 + lineIndex * 11.5, {
          width: PDF_CONTENT_WIDTH,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        })
      })
      doc
        .moveTo(PDF_MARGIN_X, 108)
        .lineTo(PDF_MARGIN_X + PDF_CONTENT_WIDTH, 108)
        .lineWidth(0.75)
        .strokeColor(PUP_MAROON)
        .stroke()
      doc
        .font(PDF_FONT)
        .fontSize(8)
        .fillColor('#555555')
        .text(`Page ${index + 1} of ${pageCount}`, PDF_MARGIN_X, doc.page.height - 36, {
          width: PDF_CONTENT_WIDTH,
          align: 'center',
          lineBreak: false,
        })

      doc.page.margins.bottom = bottomMargin
    }
  }

  private renderMasterListDocx(meta: MasterListMeta, rows: MasterListRow[]): Promise<Buffer> {
    const document = new Document({
      creator: 'Polycheck',
      title: MASTER_LIST_TITLE,
      styles: {
        default: {
          document: { run: { font: DOCX_FONT, size: 20 } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
              margin: { top: 1800, right: 1000, bottom: 1000, left: 1000, header: 400, footer: 500 },
            },
          },
          headers: {
            default: this.docxHeader(meta.institutionName, MASTER_LIST_TITLE, [
              `Subject: ${meta.subjectName} (${meta.subjectCode})`,
              `Section: ${meta.sectionName}   Semester: ${meta.semester}   Room: ${meta.room}`,
              `Professor: ${meta.professorName}`,
            ]),
          },
          footers: { default: this.docxFooter() },
          children: [
            this.docxTable(
              MASTER_LIST_COLUMNS,
              rows.map((row) => MASTER_LIST_COLUMNS.map((column) => row[column.key])),
            ),
            ...this.docxSignature(),
          ],
        },
      ],
    })
    return Packer.toBuffer(document)
  }

  private docxHeader(institutionName: string, title: string, metaLines: string[]): Header {
    const centered = (text: string, bold: boolean, size: number, after: number) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after },
        children: [new TextRun({ text, bold, size, font: DOCX_FONT })],
      })
    return new Header({
      children: [
        centered(institutionName, true, 20, 40),
        centered(title, true, 24, 80),
        ...metaLines.map((line) => centered(line, false, 16, 20)),
      ],
    })
  }

  private docxFooter(): Footer {
    return new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
              font: DOCX_FONT,
              size: 16,
            }),
          ],
        }),
      ],
    })
  }

  private docxTable(columns: readonly PdfColumn[], rows: readonly (readonly string[])[]): Table {
    const tableHeader = new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: columns.map((column) => this.docxCell(column.header, column.width, true)),
    })
    const body = rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: columns.map((column, index) => this.docxCell(row[index] ?? '', column.width, false)),
        }),
    )
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '7A7A7A' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'C4C4C4' },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'C4C4C4' },
      },
      rows: [tableHeader, ...body],
    })
  }

  private docxCell(
    text: string,
    width: number,
    bold: boolean,
    widthBase = PDF_CONTENT_WIDTH,
    shading?: string,
  ): TableCell {
    const widthSize = Math.round((width / widthBase) * 10000) / 100
    return new TableCell({
      width: { size: widthSize, type: WidthType.PERCENTAGE },
      shading: bold ? { fill: 'EFEAEA' } : shading ? { fill: shading } : undefined,
      children: [
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text, bold, font: DOCX_FONT, size: 18 })],
        }),
      ],
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
    })
  }

  private docxSignature(): Paragraph[] {
    return SIGNATURE_LINES.map(
      (line, index) =>
        new Paragraph({
          spacing: { before: index === 0 ? 480 : 240 },
          children: [new TextRun({ text: line, font: DOCX_FONT, size: 20 })],
        }),
    )
  }

  private async assertSectionAccess(user: RequestUser, sectionId: string, teacherId: string): Promise<void> {
    if (user.role === 'teacher') {
      if (teacherId !== user.id) {
        throw new ForbiddenException('You can only generate documents for your own sections')
      }
      return
    }
    if (user.role === 'super_admin') {
      if (!(await adminSectionInScope(user, sectionId, this.prisma))) {
        throw new ForbiddenException('This section is outside your administrative scope')
      }
      return
    }
    throw new ForbiddenException('You do not have access to this section')
  }

  /** IT-suite gate for the DPO summary (same widening pattern as the maintenance PUT). */
  private assertItOperationsAccess(user: RequestUser): void {
    if (user.role === 'super_admin') return
    if (user.role === 'teacher' && user.isItCoordinator === true) return
    throw new ForbiddenException(
      'The DPO compliance summary is limited to IT coordinators and institution administrators',
    )
  }

  /** Class-record scope: owning teacher, academic-oversight department head
   * (department-pinned via the section teacher's department), or a super admin
   * within `adminSectionInScope`.
   */
  private async assertClassRecordAccess(
    user: RequestUser,
    section: { id: string; teacherId: string; teacherDepartment: string | null },
  ): Promise<void> {
    if (user.role === 'teacher') {
      if (section.teacherId === user.id) return
      const oversightDepartment = academicOversightDepartment(user)
      if (oversightDepartment && departmentsMatch(section.teacherDepartment, oversightDepartment)) return
      throw new ForbiddenException('You can only generate class records for your own sections')
    }
    if (user.role === 'super_admin') {
      if (!(await adminSectionInScope(user, section.id, this.prisma))) {
        throw new ForbiddenException('This section is outside your administrative scope')
      }
      return
    }
    throw new ForbiddenException('You do not have access to this section')
  }

  /**
   * Notice scope mirrors the class-record widening: the owning teacher, a
   * department head of the section teacher's department, or a scoped super
   * admin — the same parties as the referral read scope.
   */
  private async assertNoticeAccess(
    user: RequestUser,
    section: { id: string; teacherId: string; teacherDepartment: string | null },
  ): Promise<void> {
    if (user.role === 'teacher') {
      if (section.teacherId === user.id) return
      const oversightDepartment = academicOversightDepartment(user)
      if (oversightDepartment && departmentsMatch(section.teacherDepartment, oversightDepartment)) return
      throw new ForbiddenException('You can only generate at-risk notices for your own sections')
    }
    if (user.role === 'super_admin') {
      if (!(await adminSectionInScope(user, section.id, this.prisma))) {
        throw new ForbiddenException('This referral is outside your administrative scope')
      }
      return
    }
    throw new ForbiddenException('You do not have access to this referral')
  }

  /** Mirror of StandingService's threshold read (kept local: no module coupling). */
  private async attendanceMinRatePercent(): Promise<number> {
    const setting = await this.prisma.institutionSetting.findUnique({
      where: { key: ATTENDANCE_THRESHOLD_SETTING_KEY },
      select: { value: true },
    })
    const parsed = Number(setting?.value)
    if (!Number.isFinite(parsed)) return ATTENDANCE_THRESHOLD_FALLBACK_PERCENT
    return Math.min(100, Math.max(0, Math.round(parsed)))
  }

  private async institutionName(): Promise<string> {
    const setting = await this.prisma.institutionSetting.findUnique({
      where: { key: INSTITUTION_NAME_KEY },
      select: { value: true },
    })
    return setting?.value?.trim() || DEFAULT_INSTITUTION_NAME
  }

  private privacyNoticeVersion(): string {
    return this.config?.get<string>('PRIVACY_NOTICE_VERSION')?.trim() || 'unknown'
  }

  /** Retention row read + clamp; mirrors SettingsService without a module coupling. */
  private async geolocationRetentionDays(): Promise<number> {
    const setting = await this.prisma.institutionSetting.findUnique({
      where: { key: GEOLOCATION_RETENTION_DAYS_KEY },
      select: { value: true },
    })
    if (!setting?.value?.trim()) return GEOLOCATION_RETENTION_FALLBACK_DAYS
    return clampRetentionDays(Number(setting.value))
  }
}

function sanitizeFilenamePart(value: string): string {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/[.-]{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 64)
    .replace(/^[.-]+|[.-]+$/g, '')
  return sanitized || 'untitled'
}

/** Case-insensitive department equality for the academic-oversight widening. */
function departmentsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = left?.trim().toLowerCase()
  const normalizedRight = right?.trim().toLowerCase()
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  const formulaSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${formulaSafe.replaceAll('"', '""')}"`
}

// ── At-risk notice ledger (F5, pure) ─────────────────────────────────────────

export interface NoticeLedgerSource {
  timestamp: Date
  notes: string | null
  session: { date: string; startTime: string } | null
}

/**
 * The counting absences that drove the threshold: every `absent` record in the
 * section, ordered by session date (server-arrival fallback). Excused rows are
 * already `excused`, so every ledger row is unexcused.
 */
export function buildNoticeLedgerRows(records: readonly NoticeLedgerSource[]): NoticeLedgerRow[] {
  return records
    .slice()
    .sort((left, right) => {
      const leftKey = left.session?.date ?? left.timestamp.toISOString().slice(0, 10)
      const rightKey = right.session?.date ?? right.timestamp.toISOString().slice(0, 10)
      return leftKey.localeCompare(rightKey)
    })
    .map((record) => ({
      date: record.session?.date ?? record.timestamp.toISOString().slice(0, 10),
      ...(record.session?.startTime ? { time: record.session.startTime } : {}),
      status: 'absent',
    }))
}

function capitalizeStatus(status: string): string {
  if (!status) return ''
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ── Class-record weekly aggregation (F4, pure) ────────────────────────────────

export interface ClassRecordSession {
  id: string
  date: string
  startTime: string
}

export interface ClassRecordRecord {
  studentId: string
  status: string
  sessionId: string
}

export interface ClassRecordRosterEntry {
  studentId: string
  studentNumber: string | null
  fullName: string
}

export interface ClassRecordRow {
  index: number
  studentNumber: string
  fullName: string
  /** One cell per week column: joined session symbols or '–'. */
  cells: string[]
  totals: { present: number; late: number; absent: number; excused: number }
  /** Rate % mirrors the standing rule: (P+L) over P+L+A+I, excused excluded. */
  rate: string
}

export interface ClassRecordGrid {
  weeks: number
  /** First Monday of column W1 (ISO). */
  startIso: string
  /** Sunday ending column W<weeks> (ISO). */
  endIso: string
  weekHeaders: string[]
  rows: ClassRecordRow[]
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
const NO_SESSION_SYMBOL = '–'

function parseIsoDay(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const dayOfMonth = Number(match[3])
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > 31) return null
  return Date.UTC(year, month - 1, dayOfMonth)
}

function isoDayOf(dayMs: number): string {
  return new Date(dayMs).toISOString().slice(0, 10)
}

/** Monday anchor of the grid: the first Monday strictly on/after `dayMs`. */
function firstMondayOnOrAfter(dayMs: number): number {
  const weekday = new Date(dayMs).getUTCDay() // 0 Sun … 6 Sat
  return dayMs + ((8 - weekday) % 7) * MS_PER_DAY
}

/**
 * Weekly aggregation for the official class record. The column grid is
 * derived from the semester anchor:
 *
 * - Anchor = first Monday on/after the section's earliest session date, or the
 *   first Monday on/after the `?from=YYYY-MM-DD` override when given.
 * - Week column k covers `[start + 7k, start + 7k + 6]` (calendar Mon–Sun weeks).
 * - Cell = the week's sessions mapped to `P/L/A/E/I` symbols and joined with
 *   `/` when a week holds several sessions; a session without a final record
 *   (pending/disputed/not yet resolved) contributes nothing; a week with no
 *   renderable symbol shows '–'.
 * - A single-session week therefore shows exactly the dominant rule: the
 *   status of that (latest) session in the week.
 * - Totals count every rendered session symbol per row; the rate denominator
 *   includes incomplete (half-attended) and excludes excused, mirroring
 *   StandingService.
 */
export function buildClassRecordGrid(
  sessions: readonly ClassRecordSession[],
  records: readonly ClassRecordRecord[],
  roster: readonly ClassRecordRosterEntry[],
  weeks: number,
  fromOverride?: string,
): ClassRecordGrid {
  const validSessionDays = sessions
    .map((session) => parseIsoDay(session.date))
    .filter((dayMs): dayMs is number => dayMs !== null)
  const overrideMs = fromOverride ? parseIsoDay(fromOverride) : null
  const earliestMs = validSessionDays.length > 0 ? Math.min(...validSessionDays) : null
  const anchorMs = overrideMs ?? earliestMs ?? firstMondayOnOrAfter(parseIsoDay(isoDayOf(Date.now())) ?? Date.now())
  const startMs = firstMondayOnOrAfter(anchorMs)

  const sessionsByWeek = new Map<number, ClassRecordSession[]>()
  for (const session of sessions) {
    const dayMs = parseIsoDay(session.date)
    if (dayMs === null) continue
    const weekIndex = Math.floor((dayMs - startMs) / MS_PER_WEEK)
    if (weekIndex < 0 || weekIndex >= weeks) continue
    const bucket = sessionsByWeek.get(weekIndex) ?? []
    bucket.push(session)
    sessionsByWeek.set(weekIndex, bucket)
  }

  const recordByKey = new Map<string, ClassRecordRecord>()
  for (const record of records) {
    recordByKey.set(`${record.studentId}\u0000${record.sessionId}`, record)
  }

  const rows: ClassRecordRow[] = roster.map((entry, index) => {
    const totals = { present: 0, late: 0, absent: 0, excused: 0 }
    let incomplete = 0
    const cells: string[] = []
    for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
      const weekSessions = (sessionsByWeek.get(weekIndex) ?? [])
        .slice()
        .sort((left, right) =>
          left.date === right.date
            ? left.startTime.localeCompare(right.startTime)
            : left.date.localeCompare(right.date),
        )
      if (weekSessions.length === 0) {
        cells.push(NO_SESSION_SYMBOL)
        continue
      }
      const symbols: string[] = []
      for (const session of weekSessions) {
        const status = recordByKey.get(`${entry.studentId}\u0000${session.id}`)?.status
        const symbol = status ? (CLASS_RECORD_WEEK_SYMBOLS[status] ?? '') : ''
        if (!symbol) continue
        switch (status) {
          case 'present':
            totals.present += 1
            break
          case 'late':
            totals.late += 1
            break
          case 'absent':
            totals.absent += 1
            break
          case 'excused':
            totals.excused += 1
            break
          case 'incomplete':
            incomplete += 1
            break
          default:
            break
        }
        symbols.push(symbol)
      }
      cells.push(symbols.length > 0 ? symbols.join('/') : NO_SESSION_SYMBOL)
    }
    const counted = totals.present + totals.late + totals.absent + incomplete
    const rate =
      counted === 0 ? NO_SESSION_SYMBOL : `${Math.round(((totals.present + totals.late) / counted) * 1000) / 10}%`
    return {
      index: index + 1,
      studentNumber: entry.studentNumber ?? '',
      fullName: entry.fullName,
      cells,
      totals,
      rate,
    }
  })

  return {
    weeks,
    startIso: isoDayOf(startMs),
    endIso: isoDayOf(startMs + weeks * MS_PER_WEEK - MS_PER_DAY),
    weekHeaders: Array.from({ length: weeks }, (_, index) => `W${index + 1}`),
    rows,
  }
}
