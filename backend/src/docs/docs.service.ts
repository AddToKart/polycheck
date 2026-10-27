import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { RequestUser } from '../auth/authenticated-principal'
import { adminSectionInScope } from '../common/admin-scope'
import { PrismaService } from '../prisma/prisma.service'

export type MasterListFormat = 'pdf' | 'docx'
export type SessionAttendanceFormat = 'csv' | 'pdf'

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
const MASTER_LIST_TITLE = 'CLASS MASTER LIST'
const SESSION_ATTENDANCE_TITLE = 'SESSION ATTENDANCE'
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
const SIGNATURE_LINES = [
  'Prepared by: ____________________  Instructor',
  'Verified by: ____________________  Program Chair',
] as const
const A4_WIDTH_TWIPS = 11906
const A4_HEIGHT_TWIPS = 16838

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

@Injectable()
export class DocsService {
  constructor(private readonly prisma: PrismaService) {}

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
        `Present: ${counts.present}   Late: ${counts.late}   Absent: ${counts.absent}`,
        `Pending: ${counts.pending}   Disputed: ${counts.disputed}   Excused: ${counts.excused}   Total: ${rows.length}`,
      ],
    })
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

  private docxCell(text: string, width: number, bold: boolean): TableCell {
    const widthSize = Math.round((width / PDF_CONTENT_WIDTH) * 10000) / 100
    return new TableCell({
      width: { size: widthSize, type: WidthType.PERCENTAGE },
      shading: bold ? { fill: 'EFEAEA' } : undefined,
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

  private async institutionName(): Promise<string> {
    const setting = await this.prisma.institutionSetting.findUnique({
      where: { key: INSTITUTION_NAME_KEY },
      select: { value: true },
    })
    return setting?.value?.trim() || DEFAULT_INSTITUTION_NAME
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

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  const formulaSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${formulaSafe.replaceAll('"', '""')}"`
}
