import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import type { AiChatAttachment, AiToolOutcome } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import {
  adminRecordWhere,
  adminSectionInScope,
  adminSectionWhere,
  adminSessionWhere,
  adminUserWhere,
} from '../common/admin-scope'
import { isValidIsoDate } from '../common/utils/iso-date'
import { Prisma, type AttendanceStatus, type UserRole } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StandingService } from '../standing/standing.service'
import { AiAuditService } from './ai-audit.service'
import type { AiProviderTool } from './ai-provider.service'

export class AiToolError extends Error {
  constructor(
    public readonly outcome: Extract<AiToolOutcome, 'denied' | 'failed'>,
    message: string,
  ) {
    super(message)
    this.name = 'AiToolError'
  }
}

export interface AiToolExecutionResult {
  result: unknown
  attachments: AiChatAttachment[]
}

interface AiTool {
  definition: AiProviderTool
  execute(user: RequestUser, args: unknown): Promise<AiToolExecutionResult>
}

const SECTION_RESULT_LIMIT = 10
const STUDENT_SECTION_RESULT_LIMIT = 20
const SESSION_RESULT_LIMIT = 50
const USER_RESULT_LIMIT = 10
const AUDIT_RESULT_LIMIT = 10
const QUERY_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'class',
  'docx',
  'extract',
  'for',
  'generate',
  'give',
  'in',
  'list',
  'master',
  'me',
  'my',
  'of',
  'pdf',
  'please',
  'section',
  'sections',
  'subject',
  'the',
  'this',
  'to',
  'with',
])
const DAY_ORDER: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
const STUDENT_CONCERN_MAX_LENGTH = 500

const EMPTY_ATTENDANCE_COUNTS: Record<AttendanceStatus, number> = {
  present: 0,
  late: 0,
  absent: 0,
  pending: 0,
  disputed: 0,
  excused: 0,
}

const findSectionsDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'find_sections',
    description:
      'Search the sections the signed-in user may access by subject name, subject code, or section name. Distinctive words in the query are matched independently, so a subject code or section label works best. Omit query to browse up to 10 accessible sections (teachers see only their own; administrators see their administrative scope). Returns at most 10 candidates with roster size, room, schedule, teacher, and semester. Never returns student names.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Subject name/code or section name, case-insensitive contains match. Optional.',
          maxLength: 200,
        },
      },
      additionalProperties: false,
    },
  },
}

const getSectionMasterListDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_section_master_list',
    description:
      'Prepare a downloadable master list file (PDF or DOCX) for one accessible section. Returns the download metadata and the student count only; it never returns student names or rows. Format defaults to pdf.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section identifier resolved from find_sections.' },
        format: {
          type: 'string',
          enum: ['pdf', 'docx'],
          description: 'Requested master list format. Defaults to pdf.',
        },
      },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
}

const getSectionSessionsDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_section_sessions',
    description:
      'List scheduled/active/ended sessions for one accessible section, optionally filtered to a single calendar date. Returns at most 50 sessions with metadata only.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section identifier resolved from find_sections.' },
        date: { type: 'string', description: 'Optional calendar date filter in YYYY-MM-DD format.' },
      },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
}

const getSessionAttendanceDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_session_attendance',
    description:
      'Summarize attendance counts by status for one accessible session and prepare a CSV download. Returns counts and download metadata only; it never returns student names or rows.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session identifier returned by get_section_sessions.' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  },
}

const getMySubjectsDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_my_subjects',
    description:
      'List the signed-in student’s own enrolled sections, optionally filtered by subject name, subject code, or section name. Returns at most 20 sections with the professor name and room. Never returns classmates, other students, contact details, or attendance data.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional subject name/code or section name, case-insensitive contains match.',
          maxLength: 200,
        },
      },
      additionalProperties: false,
    },
  },
}

const getMyAttendanceSummaryDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_my_attendance_summary',
    description:
      'Return the signed-in student’s own attendance counts and rate for one enrolled section. The result contains only aggregate counts and the last session date: no student names, classmates, GPS coordinates, device identifiers, or other students’ records.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section identifier returned by get_my_subjects.' },
      },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
}

const evaluateAttendanceStandingDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'evaluate_attendance_standing',
    description:
      'Return the deterministic attendance standing for one section the signed-in student is enrolled in. Narration must use the returned numbers verbatim; never recompute them, and never guarantee a passing outcome.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section identifier returned by get_my_subjects.' },
      },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
}

const getProfessorDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_professor',
    description:
      'Return the professor name, subject name, and section name for one section the signed-in student is enrolled in. Never returns an email address or any other contact detail.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section identifier returned by get_my_subjects.' },
      },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
}

const draftProfessorMessageDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'draft_professor_message',
    description:
      'Draft a short, plain-text message the signed-in student can copy and send to the professor themselves. The draft greets the professor by name, states the student concern, and requests guidance. It never sends or contacts anyone and never includes anti-cheat mechanics.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section identifier returned by get_my_subjects.' },
        concern: {
          type: 'string',
          description: 'The student’s concern in their own words.',
          maxLength: STUDENT_CONCERN_MAX_LENGTH,
        },
      },
      required: ['sectionId', 'concern'],
      additionalProperties: false,
    },
  },
}

const getInstitutionOverviewDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_institution_overview',
    description:
      'Read-only institution snapshot within the administrator scope: active and disabled faculty/students, section count, sessions active right now, and pending disputes. Returns counts only.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
}

const findUsersDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'find_users',
    description:
      'Search user accounts (teachers, students, super admins) within the administrator scope by name, email, student number, or department. Read-only; returns at most 10 accounts with role, department, and active status. Never returns passwords, sessions, attendance, GPS, or other personal records.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name, email, student number, or department match. Optional.',
          maxLength: 120,
        },
        role: { type: 'string', enum: ['teacher', 'student', 'super_admin'], description: 'Optional role filter.' },
        status: { type: 'string', enum: ['active', 'inactive'], description: 'Optional account status filter.' },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Maximum accounts to return. Defaults to 10.' },
      },
      additionalProperties: false,
    },
  },
}

const getRecentAuditActivityDefinition: AiProviderTool = {
  type: 'function',
  function: {
    name: 'get_recent_audit_activity',
    description:
      'List the most recent audit-log entries within the administrator scope: actor name, action, entity, outcome, and timestamp. Read-only; never returns request metadata, IP addresses, passwords, or row-level student data.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Maximum entries to return. Defaults to 8.' },
      },
      additionalProperties: false,
    },
  },
}

const sectionReadSelect = {
  id: true,
  section: true,
  teacherId: true,
  studentCount: true,
  semester: true,
  room: true,
  subject: { select: { name: true, code: true } },
  teacher: { select: { fullName: true } },
  schedule: { select: { day: true, startTime: true, endTime: true } },
} as const satisfies Prisma.SectionSelect

type SectionRead = Prisma.SectionGetPayload<{ select: typeof sectionReadSelect }>

const studentSectionReadSelect = {
  id: true,
  section: true,
  room: true,
  subject: { select: { name: true, code: true } },
  teacher: { select: { fullName: true } },
} as const satisfies Prisma.SectionSelect

type StudentSectionRead = Prisma.SectionGetPayload<{ select: typeof studentSectionReadSelect }>

@Injectable()
export class AiToolRegistryService {
  private readonly logger = new Logger(AiToolRegistryService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AiAuditService,
    private readonly standing: StandingService,
  ) {}

  toOpenAiTools(role: UserRole): AiProviderTool[] {
    return this.toolsFor(role).map((tool) => tool.definition)
  }

  async execute(
    role: UserRole,
    user: RequestUser,
    name: string,
    rawArgs: unknown,
    threadId?: string,
  ): Promise<AiToolExecutionResult> {
    const tool = this.toolsFor(role).find((candidate) => candidate.definition.function.name === name)
    if (!tool || !name || name.length > 64) {
      const message = 'Unknown tool'
      await this.audit.recordToolInvocation(user, threadId, name || 'unknown', 'failed', message)
      throw new AiToolError('failed', message)
    }

    try {
      const result = await tool.execute(user, rawArgs)
      await this.audit.recordToolInvocation(user, threadId, name, 'succeeded')
      return result
    } catch (error) {
      if (error instanceof AiToolError) {
        await this.audit.recordToolInvocation(user, threadId, name, error.outcome, error.message)
        throw error
      }
      this.logger.error(`AI tool ${name} failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      const message = 'The tool could not complete that request'
      await this.audit.recordToolInvocation(user, threadId, name, 'failed', message)
      throw new AiToolError('failed', message)
    }
  }

  private toolsFor(role: UserRole): AiTool[] {
    if (role === 'teacher') {
      return [
        { definition: findSectionsDefinition, execute: (user, args) => this.findSections(user, args) },
        { definition: getSectionMasterListDefinition, execute: (user, args) => this.getSectionMasterList(user, args) },
        { definition: getSectionSessionsDefinition, execute: (user, args) => this.getSectionSessions(user, args) },
        { definition: getSessionAttendanceDefinition, execute: (user, args) => this.getSessionAttendance(user, args) },
      ]
    }
    if (role === 'super_admin') {
      return [
        { definition: findSectionsDefinition, execute: (user, args) => this.findSections(user, args) },
        { definition: getSectionMasterListDefinition, execute: (user, args) => this.getSectionMasterList(user, args) },
        { definition: getSectionSessionsDefinition, execute: (user, args) => this.getSectionSessions(user, args) },
        { definition: getSessionAttendanceDefinition, execute: (user, args) => this.getSessionAttendance(user, args) },
        {
          definition: getInstitutionOverviewDefinition,
          execute: (user) => this.getInstitutionOverview(user),
        },
        { definition: findUsersDefinition, execute: (user, args) => this.findUsers(user, args) },
        {
          definition: getRecentAuditActivityDefinition,
          execute: (user, args) => this.getRecentAuditActivity(user, args),
        },
      ]
    }
    if (role === 'student') {
      return [
        { definition: getMySubjectsDefinition, execute: (user, args) => this.getMySubjects(user, args) },
        {
          definition: getMyAttendanceSummaryDefinition,
          execute: (user, args) => this.getMyAttendanceSummary(user, args),
        },
        {
          definition: evaluateAttendanceStandingDefinition,
          execute: (user, args) => this.evaluateAttendanceStanding(user, args),
        },
        { definition: getProfessorDefinition, execute: (user, args) => this.getProfessor(user, args) },
        {
          definition: draftProfessorMessageDefinition,
          execute: (user, args) => this.draftProfessorMessage(user, args),
        },
      ]
    }
    throw new ForbiddenException('Unsupported assistant role')
  }

  private async findSections(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertSupportedRole(user)
    const args = this.objectArgs(rawArgs)
    const query = this.optionalString(args, 'query', 200)
    const scope = user.role === 'teacher' ? { teacherId: user.id } : adminSectionWhere(user)
    const terms = query
      ? [
          ...new Set(
            query
              .split(/[^a-zA-Z0-9-]+/)
              .filter((term) => term.length >= 2 && !QUERY_STOPWORDS.has(term.toLowerCase())),
          ),
        ].slice(0, 6)
      : []
    const sections = await this.prisma.section.findMany({
      where: {
        ...scope,
        ...(query
          ? {
              OR: (terms.length > 0 ? terms : [query]).flatMap((term) => [
                { section: { contains: term, mode: 'insensitive' as const } },
                { subject: { name: { contains: term, mode: 'insensitive' as const } } },
                { subject: { code: { contains: term, mode: 'insensitive' as const } } },
              ]),
            }
          : {}),
      },
      select: {
        id: true,
        section: true,
        room: true,
        semester: true,
        studentCount: true,
        subject: { select: { name: true, code: true } },
        teacher: { select: { fullName: true } },
        schedule: { select: { day: true, startTime: true, endTime: true } },
      },
      orderBy: [{ semester: 'desc' }, { section: 'asc' }],
      take: SECTION_RESULT_LIMIT,
    })

    return {
      result: {
        query: query ?? null,
        count: sections.length,
        truncated: sections.length === SECTION_RESULT_LIMIT,
        sections: sections.map((section) => ({
          id: section.id,
          subject: section.subject.name,
          subjectCode: section.subject.code,
          section: section.section,
          studentCount: section.studentCount,
          room: section.room,
          scheduleSummary: this.scheduleSummary(section.schedule),
          teacherName: section.teacher.fullName,
          semester: section.semester,
        })),
      },
      attachments: [],
    }
  }

  private async getSectionMasterList(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    const args = this.objectArgs(rawArgs)
    const sectionId = this.requiredString(args, 'sectionId', 128)
    const format = this.optionalString(args, 'format', 8) ?? 'pdf'
    if (format !== 'pdf' && format !== 'docx') {
      throw new AiToolError('failed', 'format must be either pdf or docx')
    }
    const section = await this.getSectionForRead(user, sectionId)
    const attachment: AiChatAttachment = {
      id: `master-list-${sectionId}-${format}`,
      kind: 'master_list',
      format,
      label: `Master list — ${section.subject.name} Section ${section.section}`,
      filename: `master-list-${this.filenameSegment(section.section)}-${this.filenameSegment(section.subject.code)}.${format}`,
      downloadPath: `/docs/master-list/${sectionId}?format=${format}`,
    }
    return {
      result: { attachment, studentCount: section.studentCount },
      attachments: [attachment],
    }
  }

  private async getSectionSessions(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    const args = this.objectArgs(rawArgs)
    const sectionId = this.requiredString(args, 'sectionId', 128)
    const date = this.optionalString(args, 'date', 10)
    if (date && !isValidIsoDate(date)) {
      throw new AiToolError('failed', 'date must be a real calendar date in YYYY-MM-DD format')
    }
    await this.getSectionForRead(user, sectionId)

    const sessions = await this.prisma.session.findMany({
      where: { sectionId, ...(date ? { date } : {}) },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        room: true,
        isActive: true,
        endedAt: true,
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      take: SESSION_RESULT_LIMIT,
    })

    return {
      result: {
        sectionId,
        count: sessions.length,
        sessions: sessions.map((session) => ({
          id: session.id,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          room: session.room,
          isActive: session.isActive,
          endedAt: session.endedAt?.toISOString() ?? null,
          status: session.isActive ? 'active' : session.endedAt ? 'ended' : 'scheduled',
        })),
      },
      attachments: [],
    }
  }

  private async getSessionAttendance(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    const args = this.objectArgs(rawArgs)
    const sessionId = this.requiredString(args, 'sessionId', 128)
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        sectionId: true,
        teacherId: true,
        section: { select: { section: true } },
      },
    })
    if (!session) throw new AiToolError('failed', 'Session not found')

    if (user.role === 'teacher') {
      if (session.teacherId !== user.id) {
        throw new AiToolError('denied', 'You can only access your own sessions')
      }
    } else if (user.role === 'super_admin') {
      if (!(await adminSectionInScope(user, session.sectionId, this.prisma))) {
        throw new AiToolError('denied', 'This session is outside your administrative scope')
      }
    } else {
      throw new AiToolError('denied', 'You cannot access this session')
    }

    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { sessionId },
      _count: { status: true },
    })
    const counts = { ...EMPTY_ATTENDANCE_COUNTS }
    for (const row of grouped) counts[row.status] = row._count.status

    const attachment: AiChatAttachment = {
      id: `session-attendance-${sessionId}-csv`,
      kind: 'session_attendance',
      format: 'csv',
      label: `Attendance — ${session.section.section}`,
      filename: `attendance-${this.filenameSegment(sessionId)}.csv`,
      downloadPath: `/docs/session-attendance/${sessionId}?format=csv`,
    }

    return {
      result: {
        sessionId,
        sectionId: session.sectionId,
        section: session.section.section,
        counts,
        csvDownloadPath: attachment.downloadPath,
        attachment,
      },
      attachments: [attachment],
    }
  }

  private async getMySubjects(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertStudent(user)
    const args = this.objectArgs(rawArgs)
    const query = this.optionalString(args, 'query', 200)
    const sections = await this.prisma.section.findMany({
      where: {
        enrollments: { some: { studentId: user.id } },
        ...(query
          ? {
              OR: [
                { section: { contains: query, mode: 'insensitive' } },
                { subject: { name: { contains: query, mode: 'insensitive' } } },
                { subject: { code: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        section: true,
        room: true,
        subject: { select: { name: true, code: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }, { section: 'asc' }],
      take: STUDENT_SECTION_RESULT_LIMIT,
    })

    return {
      result: {
        count: sections.length,
        truncated: sections.length === STUDENT_SECTION_RESULT_LIMIT,
        sections: sections.map((section) => ({
          sectionId: section.id,
          subjectName: section.subject.name,
          subjectCode: section.subject.code,
          sectionName: section.section,
          professorName: section.teacher.fullName,
          ...(section.room ? { room: section.room } : {}),
        })),
      },
      attachments: [],
    }
  }

  private async getMyAttendanceSummary(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertStudent(user)
    const args = this.objectArgs(rawArgs)
    const sectionId = this.requiredString(args, 'sectionId', 128)
    const section = await this.getStudentSection(user, sectionId)
    const records = await this.prisma.attendanceRecord.findMany({
      where: { sectionId, studentId: user.id },
      select: {
        status: true,
        timestamp: true,
        session: { select: { date: true } },
      },
    })

    const counts = { ...EMPTY_ATTENDANCE_COUNTS }
    let lastSessionDate: string | null = null
    for (const record of records) {
      counts[record.status] += 1
      const date = record.session?.date ?? record.timestamp.toISOString().slice(0, 10)
      if (!lastSessionDate || date > lastSessionDate) lastSessionDate = date
    }

    const countedSessions = counts.present + counts.late + counts.absent
    const attendanceRate =
      countedSessions === 0 ? null : Math.round(((counts.present + counts.late) / countedSessions) * 1000) / 10

    return {
      result: {
        sectionId,
        subjectName: section.subject.name,
        subjectCode: section.subject.code,
        sectionName: section.section,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        pending: counts.pending,
        disputed: counts.disputed,
        excused: counts.excused,
        attendanceRate,
        lastSessionDate,
      },
      attachments: [],
    }
  }

  private async evaluateAttendanceStanding(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertStudent(user)
    const args = this.objectArgs(rawArgs)
    const sectionId = this.requiredString(args, 'sectionId', 128)
    await this.getStudentSection(user, sectionId)
    const standing = await this.standing.forStudentSection(user, sectionId)
    if (!standing) throw new AiToolError('denied', 'You are not enrolled in this section')
    return { result: standing, attachments: [] }
  }

  private async getProfessor(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertStudent(user)
    const args = this.objectArgs(rawArgs)
    const sectionId = this.requiredString(args, 'sectionId', 128)
    const section = await this.getStudentSection(user, sectionId)
    return {
      result: {
        professorName: section.teacher.fullName,
        subjectName: section.subject.name,
        sectionName: section.section,
      },
      attachments: [],
    }
  }

  private async draftProfessorMessage(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertStudent(user)
    const args = this.objectArgs(rawArgs)
    const sectionId = this.requiredString(args, 'sectionId', 128)
    const concern = this.requiredString(args, 'concern', STUDENT_CONCERN_MAX_LENGTH)
    const section = await this.getStudentSection(user, sectionId)
    const safeConcern = this.sanitizeConcern(concern)
    const concernSentence = /[.!?]$/.test(safeConcern) ? safeConcern : `${safeConcern}.`
    const message = [
      `Dear ${section.teacher.fullName},`,
      '',
      `I hope you are well. I am writing about my attendance in ${section.subject.name} (Section ${section.section}). ${concernSentence}`,
      '',
      'Could we discuss how I can improve my attendance and what guidance you can offer? I would appreciate your advice.',
      '',
      'Thank you,',
      '[Your name]',
    ].join('\n')

    return {
      result: {
        professorName: section.teacher.fullName,
        subjectName: section.subject.name,
        sectionName: section.section,
        message,
      },
      attachments: [],
    }
  }

  private async getInstitutionOverview(user: RequestUser): Promise<AiToolExecutionResult> {
    this.assertAdmin(user)
    const userScope = adminUserWhere(user) ?? {}
    const [
      activeFaculty,
      inactiveFaculty,
      activeStudents,
      inactiveStudents,
      sections,
      activeSessions,
      pendingDisputes,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...userScope, role: 'teacher', isActive: true } }),
      this.prisma.user.count({ where: { ...userScope, role: 'teacher', isActive: false } }),
      this.prisma.user.count({ where: { ...userScope, role: 'student', isActive: true } }),
      this.prisma.user.count({ where: { ...userScope, role: 'student', isActive: false } }),
      this.prisma.section.count({ where: adminSectionWhere(user) }),
      this.prisma.session.count({ where: { ...adminSessionWhere(user), isActive: true } }),
      this.prisma.attendanceRecord.count({ where: { ...adminRecordWhere(user), status: 'disputed' } }),
    ])

    return {
      result: {
        faculty: { active: activeFaculty, inactive: inactiveFaculty },
        students: { active: activeStudents, inactive: inactiveStudents },
        sections,
        activeSessions,
        pendingDisputes,
      },
      attachments: [],
    }
  }

  private async findUsers(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertAdmin(user)
    const args = this.objectArgs(rawArgs)
    const query = this.optionalString(args, 'query', 120)
    const role = this.optionalString(args, 'role', 20)
    if (role && role !== 'teacher' && role !== 'student' && role !== 'super_admin') {
      throw new AiToolError('failed', 'role must be teacher, student, or super_admin')
    }
    const status = this.optionalString(args, 'status', 10)
    if (status && status !== 'active' && status !== 'inactive') {
      throw new AiToolError('failed', 'status must be active or inactive')
    }
    const limit = this.optionalInteger(args, 'limit', 1, USER_RESULT_LIMIT) ?? USER_RESULT_LIMIT

    const users = await this.prisma.user.findMany({
      where: {
        ...(adminUserWhere(user) ?? {}),
        ...(role ? { role: role as UserRole } : {}),
        ...(status ? { isActive: status === 'active' } : {}),
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { studentId: { contains: query, mode: 'insensitive' } },
                { department: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        email: true,
        studentId: true,
        department: true,
        isActive: true,
        program: true,
        yearLevel: true,
      },
      orderBy: [{ fullName: 'asc' }],
      take: limit,
    })

    return {
      result: {
        count: users.length,
        truncated: users.length === limit,
        users,
      },
      attachments: [],
    }
  }

  private async getRecentAuditActivity(user: RequestUser, rawArgs: unknown): Promise<AiToolExecutionResult> {
    this.assertAdmin(user)
    const args = this.objectArgs(rawArgs)
    const limit = this.optionalInteger(args, 'limit', 1, AUDIT_RESULT_LIMIT) ?? 8
    const scopedUsers = adminUserWhere(user)
    let actorIds: string[] | undefined
    if (scopedUsers) {
      const actors = await this.prisma.user.findMany({ where: scopedUsers, select: { id: true } })
      actorIds = actors.map((actor) => actor.id)
    }
    const logs = await this.prisma.auditLog.findMany({
      where: actorIds ? { actorId: { in: actorIds } } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    })
    const actorNames = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: [...new Set(logs.map((log) => log.actorId))] } },
          select: { id: true, fullName: true },
        })
      ).map((actor) => [actor.id, actor.fullName]),
    )

    return {
      result: {
        count: logs.length,
        entries: logs.map((log) => ({
          id: log.id,
          actorName: actorNames.get(log.actorId) ?? 'Unknown account',
          actorRole: log.actorRole,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          outcome: this.auditOutcome(log.metadata),
          createdAt: log.createdAt.toISOString(),
        })),
      },
      attachments: [],
    }
  }

  private async getStudentSection(user: RequestUser, sectionId: string): Promise<StudentSectionRead> {
    this.assertStudent(user)
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: user.id, sectionId } },
      select: { section: { select: studentSectionReadSelect } },
    })
    if (!enrollment) throw new AiToolError('denied', 'You are not enrolled in this section')
    return enrollment.section
  }

  private sanitizeConcern(concern: string) {
    return concern
      .replace(
        /\b(?:geo-?fenc\w*|gps|geolocation|coordinates?|latitudes?|longitudes?|radius|device\s*(?:id|fingerprint)s?|fingerprints?|anti-cheat|token\s+signature)\b/gi,
        'check-in area',
      )
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async getSectionForRead(user: RequestUser, sectionId: string): Promise<SectionRead> {
    this.assertSupportedRole(user)
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: sectionReadSelect,
    })
    if (!section) throw new AiToolError('failed', 'Section not found')

    if (user.role === 'teacher') {
      if (section.teacherId !== user.id) {
        throw new AiToolError('denied', 'You can only access your own sections')
      }
    } else if (user.role === 'super_admin') {
      if (!(await adminSectionInScope(user, sectionId, this.prisma))) {
        throw new AiToolError('denied', 'This section is outside your administrative scope')
      }
    }
    return section
  }

  private assertSupportedRole(user: RequestUser) {
    if (user.role !== 'teacher' && user.role !== 'super_admin') {
      throw new AiToolError('denied', 'You cannot access these tools')
    }
  }

  private assertStudent(user: RequestUser) {
    if (user.role !== 'student') {
      throw new AiToolError('denied', 'You cannot access these tools')
    }
  }

  private assertAdmin(user: RequestUser) {
    if (user.role !== 'super_admin') {
      throw new AiToolError('denied', 'You cannot access these tools')
    }
  }

  private objectArgs(rawArgs: unknown): Record<string, unknown> {
    if (rawArgs === undefined || rawArgs === null) return {}
    if (typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
      throw new AiToolError('failed', 'Tool arguments must be an object')
    }
    return rawArgs as Record<string, unknown>
  }

  private requiredString(args: Record<string, unknown>, key: string, maxLength: number): string {
    const value = args[key]
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AiToolError('failed', `${key} is required`)
    }
    const trimmed = value.trim()
    if (trimmed.length > maxLength) throw new AiToolError('failed', `${key} is too long`)
    return trimmed
  }

  private optionalString(args: Record<string, unknown>, key: string, maxLength: number): string | undefined {
    const value = args[key]
    if (value === undefined || value === null) return undefined
    if (typeof value !== 'string') throw new AiToolError('failed', `${key} must be a string`)
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (trimmed.length > maxLength) throw new AiToolError('failed', `${key} is too long`)
    return trimmed
  }

  private optionalInteger(args: Record<string, unknown>, key: string, min: number, max: number): number | undefined {
    const value = args[key]
    if (value === undefined || value === null || value === '') return undefined
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
    if (!Number.isInteger(numeric)) throw new AiToolError('failed', `${key} must be an integer`)
    if (numeric < min || numeric > max) throw new AiToolError('failed', `${key} must be between ${min} and ${max}`)
    return numeric
  }

  private auditOutcome(metadata: Prisma.JsonValue | null) {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return 'initiated'
    const outcome = (metadata as { outcome?: unknown }).outcome
    return outcome === 'succeeded' || outcome === 'failed' ? outcome : 'initiated'
  }

  private scheduleSummary(schedule: Array<{ day: string; startTime: string; endTime: string }>): string {
    if (schedule.length === 0) return 'No schedule'
    return [...schedule]
      .sort(
        (left, right) =>
          (DAY_ORDER[left.day] ?? 99) - (DAY_ORDER[right.day] ?? 99) || left.startTime.localeCompare(right.startTime),
      )
      .map((entry) => `${entry.day} ${entry.startTime}-${entry.endTime}`)
      .join(', ')
  }

  private filenameSegment(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
  }
}
