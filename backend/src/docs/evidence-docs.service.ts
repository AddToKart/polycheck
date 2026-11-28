import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { campusHeading, courseShortLabel, resolveBranding, INSTITUTION_CAMPUS_KEY } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { adminSectionWhere, adminSubjectWhere } from '../common/admin-scope'
import type { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ProofStorageService } from '../proofs/proof-storage.service'
import type { GeneratedDocument } from './docs.service'

/** One export holds every photo in memory, so a very large range is split by section or date. */
export const PROOF_REPORT_PHOTO_LIMIT = 600
const ATTENDANCE_EXPORT_BATCH_SIZE = 2_000

const MARGIN = 40
const WIDTH = 515
const BODY_TOP = 132
const BOTTOM = 62
const COLUMN_GAP = 15
const CELL_WIDTH = (WIDTH - COLUMN_GAP) / 2
const PHOTO_HEIGHT = 168
const STAMP_HEIGHT = 16
const CELL_HEIGHT = PHOTO_HEIGHT + 46
const SESSION_BAR_HEIGHT = 20
const MAROON = '#7B1113'
const DEEP_MAROON = '#4A0A0B'
const GOLDEN = '#FFDF00'

export const SUBJECT_ATTENDANCE_COLUMNS = [
  'Subject code',
  'Subject',
  'Section',
  'Course',
  'Semester',
  'Professor',
  'Class date',
  'Start',
  'End',
  'Room',
  'Mode',
  'Student number',
  'Student name',
  'Status',
  'Recorded at (Philippine time)',
  'Set by professor',
  'Excuse request',
  'Dispute reason',
  'Notes',
] as const

export interface ProofReportScope {
  sessionId?: string
  sectionId?: string
  subjectId?: string
  from?: string
  to?: string
}

const photoSelect = {
  id: true,
  photoUrl: true,
  uploadedAt: true,
  uploadedByStudentName: true,
  description: true,
  session: {
    select: { id: true, date: true, startTime: true, endTime: true, room: true },
  },
  section: {
    select: {
      id: true,
      section: true,
      course: true,
      semester: true,
      teacher: { select: { fullName: true } },
      subject: { select: { name: true, code: true } },
    },
  },
} satisfies Prisma.ProofOfClassSelect

type ReportPhoto = Prisma.ProofOfClassGetPayload<{ select: typeof photoSelect }>

@Injectable()
export class EvidenceDocsService {
  private readonly logger = new Logger(EvidenceDocsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ProofStorageService,
  ) {}

  /** Class photos of a session, a section or a subject, compiled for the Quality Assurance Coordinator. */
  async proofPhotos(user: RequestUser, scope: ProofReportScope, now = new Date()): Promise<GeneratedDocument> {
    const where = await this.photoScope(user, scope)
    const total = await this.prisma.proofOfClass.count({ where })
    if (total === 0) throw new NotFoundException('There are no class photos to put in this PDF')
    if (total > PROOF_REPORT_PHOTO_LIMIT) {
      throw new BadRequestException(
        `This would be ${total} photos. One PDF holds up to ${PROOF_REPORT_PHOTO_LIMIT}: pick one section or a shorter date range.`,
      )
    }
    const photos = await this.prisma.proofOfClass.findMany({ where, select: photoSelect })
    photos.sort(
      (left, right) =>
        left.section.subject.code.localeCompare(right.section.subject.code) ||
        left.section.section.localeCompare(right.section.section) ||
        left.session.date.localeCompare(right.session.date) ||
        left.session.startTime.localeCompare(right.session.startTime) ||
        left.uploadedAt.getTime() - right.uploadedAt.getTime(),
    )
    const [institution, requester] = await Promise.all([
      this.institutionLine(),
      this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
    ])
    const first = photos[0]
    const sections = new Set(photos.map((photo) => photo.section.id))
    const dates = photos.map((photo) => photo.session.date).sort()
    const period = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`
    const name = [
      'class-photos',
      first.section.subject.code,
      ...(sections.size === 1 ? [first.section.section] : []),
      dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]}_${dates[dates.length - 1]}`,
    ]
    return {
      filename: `${name.map(filePart).join('-')}.pdf`,
      contentType: 'application/pdf',
      body: await this.renderPhotos(photos, {
        institution,
        period,
        generatedAt: philippineDateTime(now),
        generatedBy: requester?.fullName ?? 'PolyCheck user',
      }),
    }
  }

  /** Every attendance record of a subject as one spreadsheet, for keeping before a delete. */
  async subjectAttendance(user: RequestUser, subjectId: string): Promise<GeneratedDocument> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, code: true, createdById: true },
    })
    if (!subject) throw new NotFoundException('Subject not found')
    const sectionWhere: Prisma.SectionWhereInput = { subjectId }
    if (user.role === 'teacher') {
      sectionWhere.teacherId = user.id
      const teaches = await this.prisma.section.count({ where: sectionWhere })
      if (!teaches && subject.createdById !== user.id) throw new NotFoundException('Subject not found')
    } else if (user.role === 'super_admin') {
      const scoped = adminSubjectWhere(user)
      if (scoped && !(await this.prisma.subject.findFirst({ where: { AND: [{ id: subjectId }, scoped] } }))) {
        throw new NotFoundException('Subject not found')
      }
      Object.assign(sectionWhere, adminSectionWhere(user))
    } else {
      throw new ForbiddenException('Only teachers and administrators can export a subject')
    }

    const rows: string[][] = []
    let cursor: string | undefined
    while (true) {
      const records = await this.prisma.attendanceRecord.findMany({
        where: { section: sectionWhere },
        select: {
          id: true,
          studentName: true,
          status: true,
          timestamp: true,
          manuallySet: true,
          excuseStatus: true,
          disputeReason: true,
          notes: true,
          student: { select: { studentId: true } },
          session: { select: { date: true, startTime: true, endTime: true, room: true, mode: true } },
          section: {
            select: { section: true, course: true, semester: true, teacher: { select: { fullName: true } } },
          },
        },
        orderBy: { id: 'asc' },
        take: ATTENDANCE_EXPORT_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      for (const record of records) {
        rows.push([
          subject.code,
          subject.name,
          record.section.section,
          courseShortLabel(record.section.course),
          record.section.semester,
          record.section.teacher.fullName,
          record.session.date,
          record.session.startTime,
          record.session.endTime,
          record.session.room ?? '',
          record.session.mode === 'online' ? 'Online' : 'In person',
          record.student.studentId ?? '',
          record.studentName,
          record.status,
          // A class that is absent or pending has no check-in; the stored time is when the row was made.
          record.status === 'pending' ? '' : philippineDateTime(record.timestamp),
          record.manuallySet ? 'Yes' : 'No',
          record.excuseStatus ?? '',
          record.disputeReason ?? '',
          record.notes ?? '',
        ])
      }
      if (records.length < ATTENDANCE_EXPORT_BATCH_SIZE) break
      cursor = records[records.length - 1].id
    }
    // Section, date, time, then student name.
    const order = [2, 6, 7, 12]
    rows.sort((left, right) => {
      for (const column of order) {
        const difference = left[column].localeCompare(right[column])
        if (difference) return difference
      }
      return 0
    })
    const lines = [SUBJECT_ATTENDANCE_COLUMNS, ...rows].map((row) => row.map(csvCell).join(','))
    return {
      filename: `attendance-${filePart(subject.code)}-all-records.csv`,
      contentType: 'text/csv; charset=utf-8',
      // The byte-order mark makes Excel read accented names correctly.
      body: Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8'),
    }
  }

  private async photoScope(user: RequestUser, scope: ProofReportScope): Promise<Prisma.ProofOfClassWhereInput> {
    const chosen = [scope.sessionId, scope.sectionId, scope.subjectId].filter(Boolean)
    if (chosen.length !== 1) throw new BadRequestException('Choose one session, section or subject')
    if (scope.from && scope.to && scope.to < scope.from) {
      throw new BadRequestException('The end date must be on or after the start date')
    }
    const dated: Prisma.ProofOfClassWhereInput =
      scope.from || scope.to
        ? {
            session: {
              date: { ...(scope.from ? { gte: scope.from } : {}), ...(scope.to ? { lte: scope.to } : {}) },
            },
          }
        : {}

    let sectionWhere: Prisma.SectionWhereInput
    if (scope.sessionId) {
      sectionWhere = { sessions: { some: { id: scope.sessionId } } }
    } else if (scope.sectionId) sectionWhere = { id: scope.sectionId }
    else sectionWhere = { subjectId: scope.subjectId }

    let access: Prisma.SectionWhereInput
    if (user.role === 'teacher') access = { teacherId: user.id }
    else if (user.role === 'super_admin') access = adminSectionWhere(user)
    else {
      if (scope.subjectId) throw new ForbiddenException('Choose one of your sections')
      // Officers only: an ordinary classmate may not compile the section's photos.
      access = {
        sectionRoles: { some: { studentId: user.id, role: 'qac' } },
        enrollments: { some: { studentId: user.id } },
        subject: { archivedAt: null },
      }
    }
    const allowed = await this.prisma.section.findMany({
      where: { AND: [sectionWhere, access] },
      select: { id: true },
    })
    if (allowed.length === 0) {
      throw new ForbiddenException('Only the professor, an administrator or the section QAC can export these photos')
    }
    return {
      AND: [
        { sectionId: { in: allowed.map((section) => section.id) } },
        ...(scope.sessionId ? [{ sessionId: scope.sessionId }] : []),
        dated,
      ],
    }
  }

  private async institutionLine(): Promise<string> {
    const settings = await this.prisma.institutionSetting.findMany({
      where: { key: { in: ['institution_name', INSTITUTION_CAMPUS_KEY] } },
      select: { key: true, value: true },
    })
    const values = new Map(settings.map((setting) => [setting.key, setting.value.trim()]))
    const branding = resolveBranding({
      name: values.get('institution_name'),
      campus: values.get(INSTITUTION_CAMPUS_KEY),
    })
    return [branding.name, campusHeading(branding.campus)].filter(Boolean).join(' · ')
  }

  private async renderPhotos(
    photos: ReportPhoto[],
    meta: { institution: string; period: string; generatedAt: string; generatedBy: string },
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: BODY_TOP, bottom: BOTTOM, left: MARGIN, right: MARGIN },
      bufferPages: true,
      autoFirstPage: false,
      info: { Title: 'Proof of class photo report', Author: meta.institution, Creator: 'PolyCheck' },
    })
    const chunks: Buffer[] = []
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    // Which section each page belongs to, for its header.
    const pageSections: ReportPhoto['section'][] = []
    let y = BODY_TOP
    let column = 0
    let currentSection = ''
    let currentSession = ''
    let number = 0
    const bottomLimit = () => doc.page.height - BOTTOM
    const newPage = (section: ReportPhoto['section']) => {
      doc.addPage()
      pageSections.push(section)
      y = BODY_TOP
      column = 0
    }
    const endRow = () => {
      if (column !== 0) {
        y += CELL_HEIGHT
        column = 0
      }
    }

    for (const photo of photos) {
      if (photo.section.id !== currentSection) {
        // Each section starts on its own page so it can be filed separately.
        currentSection = photo.section.id
        currentSession = ''
        newPage(photo.section)
      }
      if (photo.session.id !== currentSession) {
        currentSession = photo.session.id
        number = 0
        endRow()
        if (y + SESSION_BAR_HEIGHT + CELL_HEIGHT > bottomLimit()) newPage(photo.section)
        this.drawSessionBar(doc, photo, y)
        y += SESSION_BAR_HEIGHT + 8
      }
      if (column === 0 && y + CELL_HEIGHT > bottomLimit()) {
        newPage(photo.section)
        this.drawSessionBar(doc, photo, y, true)
        y += SESSION_BAR_HEIGHT + 8
      }
      number += 1
      await this.drawPhoto(doc, photo, number, MARGIN + column * (CELL_WIDTH + COLUMN_GAP), y)
      column += 1
      if (column === 2) endRow()
    }
    endRow()

    if (y + 96 > bottomLimit()) newPage(photos[photos.length - 1].section)
    this.drawSummary(doc, photos, meta, y + 8)
    this.decorate(doc, pageSections, meta)
    doc.end()
    return done
  }

  private drawSessionBar(doc: PDFKit.PDFDocument, photo: ReportPhoto, y: number, continued = false) {
    const { session } = photo
    doc.rect(MARGIN, y, WIDTH, SESSION_BAR_HEIGHT).fill('#F3EDED')
    doc.rect(MARGIN, y, 4, SESSION_BAR_HEIGHT).fill(MAROON)
    const room = session.room ? ` · ${session.room}` : ''
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(DEEP_MAROON)
      .text(
        `${longDate(session.date)} · ${clock(session.startTime)} – ${clock(session.endTime)}${room}${continued ? ' (continued)' : ''}`,
        MARGIN + 12,
        y + 6,
        { width: WIDTH - 20, lineBreak: false, ellipsis: true },
      )
  }

  private async drawPhoto(doc: PDFKit.PDFDocument, photo: ReportPhoto, number: number, x: number, y: number) {
    doc.rect(x, y, CELL_WIDTH, PHOTO_HEIGHT).fill('#161616')
    try {
      const stored = await this.storage.read(photo.photoUrl)
      doc.image(stored.buffer, x, y, { fit: [CELL_WIDTH, PHOTO_HEIGHT], align: 'center', valign: 'center' })
    } catch (error) {
      this.logger.warn(`Photo ${photo.id} could not be placed in the report: ${String(error)}`)
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#FFFFFF')
        .text('This photo file could not be opened.', x + 8, y + PHOTO_HEIGHT / 2 - 6, {
          width: CELL_WIDTH - 16,
          align: 'center',
        })
    }
    // The stamp sits on the picture itself, so it stays with the photo if the page is cut apart.
    doc.rect(x, y + PHOTO_HEIGHT - STAMP_HEIGHT, CELL_WIDTH, STAMP_HEIGHT).fill(DEEP_MAROON)
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(GOLDEN)
      .text(
        `${philippineDateTime(photo.uploadedAt)} PHT · ${photo.section.subject.code} · Sec ${photo.section.section}`,
        x + 6,
        y + PHOTO_HEIGHT - STAMP_HEIGHT + 5,
        { width: CELL_WIDTH - 12, lineBreak: false, ellipsis: true },
      )
    const caption = (text: string, offset: number, bold = false) =>
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .fillColor('#222222')
        .text(text, x, y + PHOTO_HEIGHT + offset, { width: CELL_WIDTH, height: 10, ellipsis: true })
    caption(`Photo ${number} · uploaded ${philippineDateTime(photo.uploadedAt)}`, 5, true)
    caption(`By ${photo.uploadedByStudentName}`, 17)
    if (photo.description) caption(`Note: ${photo.description.replace(/\s+/g, ' ')}`, 29)
  }

  private drawSummary(
    doc: PDFKit.PDFDocument,
    photos: ReportPhoto[],
    meta: { generatedAt: string; generatedBy: string },
    y: number,
  ) {
    const sessions = new Set(photos.map((photo) => photo.session.id)).size
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#111111')
      .text(`Total: ${photos.length} photo(s) from ${sessions} class meeting(s).`, MARGIN, y, { lineBreak: false })
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#444444')
      .text(`Compiled by ${meta.generatedBy} on ${meta.generatedAt} (Philippine time).`, MARGIN, y + 14, {
        lineBreak: false,
      })
    const lines = ['Quality Assurance Coordinator', 'Professor']
    lines.forEach((label, index) => {
      const x = MARGIN + index * (CELL_WIDTH + COLUMN_GAP)
      doc
        .moveTo(x, y + 66)
        .lineTo(x + CELL_WIDTH - 20, y + 66)
        .lineWidth(0.75)
        .strokeColor('#333333')
        .stroke()
      doc.text(`${label} (signature over printed name)`, x, y + 70, { width: CELL_WIDTH, lineBreak: false })
    })
  }

  private decorate(
    doc: PDFKit.PDFDocument,
    pageSections: ReportPhoto['section'][],
    meta: { institution: string; period: string },
  ) {
    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index)
      const bottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      const section = pageSections[index]
      const centered = (text: string, y: number, size: number, bold: boolean, color: string) =>
        doc
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(size)
          .fillColor(color)
          .text(text, MARGIN, y, { width: WIDTH, align: 'center', lineBreak: false, ellipsis: true })
      centered(meta.institution, 28, 10, true, MAROON)
      centered('PROOF OF CLASS — PHOTO REPORT', 44, 13, true, '#111111')
      centered(`${section.subject.name} (${section.subject.code})`, 66, 9.5, true, '#111111')
      const course = courseShortLabel(section.course)
      centered(
        `Section ${section.section}${course ? ` · ${course}` : ''} · ${section.semester} · Professor: ${section.teacher.fullName}`,
        80,
        8.5,
        false,
        '#333333',
      )
      centered(`Class dates covered: ${meta.period}`, 93, 8.5, false, '#333333')
      doc
        .moveTo(MARGIN, 112)
        .lineTo(MARGIN + WIDTH, 112)
        .lineWidth(0.75)
        .strokeColor(MAROON)
        .stroke()
      centered(
        'Each time stamp is when the PolyCheck server received the photo (Philippine time).',
        doc.page.height - 46,
        7.5,
        false,
        '#555555',
      )
      centered(`Page ${index + 1} of ${range.count}`, doc.page.height - 34, 8, false, '#555555')
      doc.page.margins.bottom = bottom
    }
  }
}

const manilaParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

/** For example `Nov 28, 2026, 12:02:13 AM`. */
export function philippineDateTime(value: Date): string {
  // Some runtimes separate AM/PM with a narrow space the PDF's built-in fonts cannot draw.
  return manilaParts.format(value).replace(/\s+/g, ' ')
}

function longDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
}

function clock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

function filePart(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[.-]{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 48)
  return cleaned || 'untitled'
}

/** Quoted, and safe to open in a spreadsheet: text that looks like a formula is kept as text. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}
