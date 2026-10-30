import { AiToolError, AiToolRegistryService } from './ai-tool-registry.service'

const teacher = { id: 'teacher-1', role: 'teacher' as const }
const otherTeacher = { id: 'teacher-2', role: 'teacher' as const }
const student = { id: 'student-1', role: 'student' as const }
const departmentAdmin = {
  id: 'admin-1',
  role: 'super_admin' as const,
  scope: 'department',
  department: 'CCIS',
}
const institutionAdmin = { id: 'admin-2', role: 'super_admin' as const, scope: 'institution' }

const sectionRow = {
  id: 'sec-1',
  section: '1',
  teacherId: 'teacher-1',
  studentCount: 40,
  semester: '2026-1',
  room: 'Room 101',
  subject: { name: 'Software Engineering', code: 'SE101' },
  teacher: { fullName: 'Prof. Cruz', email: 'cruz@pup.edu.ph' },
  schedule: [
    { day: 'Wed', startTime: '10:00', endTime: '11:30' },
    { day: 'Mon', startTime: '09:00', endTime: '10:00' },
  ],
}

const studentSectionRow = {
  id: 'sec-1',
  section: '1',
  room: 'Room 101',
  subject: { name: 'Software Engineering', code: 'SE101' },
  teacher: { fullName: 'Prof. Cruz', email: 'cruz@pup.edu.ph' },
}

const standingRow = {
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  subjectCode: 'SE101',
  sectionName: '1',
  professorName: 'Prof. Cruz',
  thresholdPercent: 75,
  present: 8,
  late: 1,
  absent: 2,
  disputed: 1,
  countedSessions: 11,
  attendanceRate: 81.8,
  status: 'on_track' as const,
  absencesBeforeBelowThreshold: 1,
  lastSessionDate: '2026-10-20',
}

function record(status: string, date: string) {
  return { status, timestamp: new Date(`${date}T01:00:00.000Z`), session: { date } }
}

function makeRegistry() {
  const prisma = {
    section: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(sectionRow),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    attendanceRecord: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    enrollment: {
      findUnique: jest.fn().mockResolvedValue({ section: studentSectionRow }),
    },
    user: {
      count: jest.fn().mockResolvedValue(3),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }
  const audit = { recordToolInvocation: jest.fn().mockResolvedValue(undefined) }
  const standing = { forStudentSection: jest.fn().mockResolvedValue(standingRow) }
  const registry = new AiToolRegistryService(prisma as never, audit as never, standing as never)
  return { registry, prisma, audit, standing }
}

describe('AiToolRegistryService', () => {
  it('exposes the teacher tools and the super-admin-only administrative tools', () => {
    const { registry } = makeRegistry()

    expect(registry.toOpenAiTools('teacher').map((tool) => tool.function.name)).toEqual([
      'find_sections',
      'get_section_master_list',
      'get_section_sessions',
      'get_session_attendance',
    ])
    expect(registry.toOpenAiTools('super_admin').map((tool) => tool.function.name)).toEqual([
      'find_sections',
      'get_section_master_list',
      'get_section_sessions',
      'get_session_attendance',
      'get_institution_overview',
      'find_users',
      'get_recent_audit_activity',
    ])
  })

  it('exposes only the five own-data tools to students', () => {
    const { registry } = makeRegistry()

    expect(registry.toOpenAiTools('student').map((tool) => tool.function.name)).toEqual([
      'get_my_subjects',
      'get_my_attendance_summary',
      'evaluate_attendance_standing',
      'get_professor',
      'draft_professor_message',
    ])
  })

  it('scopes own-subject lookup to the student enrollment and filters optional queries', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.section.findMany.mockResolvedValue([sectionRow])

    const execution = await registry.execute('student', student as never, 'get_my_subjects', {}, 'thread-student')

    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollments: { some: { studentId: 'student-1' } } },
        take: 20,
      }),
    )
    expect(execution.result).toEqual({
      count: 1,
      truncated: false,
      sections: [
        {
          sectionId: 'sec-1',
          subjectName: 'Software Engineering',
          subjectCode: 'SE101',
          sectionName: '1',
          professorName: 'Prof. Cruz',
          room: 'Room 101',
        },
      ],
    })
    expect(JSON.stringify(execution.result)).not.toContain('@')
    expect(JSON.stringify(execution.result)).not.toContain('studentName')

    await registry.execute('student', student as never, 'get_my_subjects', { query: 'soft' }, 'thread-student')
    expect(prisma.section.findMany.mock.calls[1][0].where.OR).toEqual([
      { section: { contains: 'soft', mode: 'insensitive' } },
      { subject: { name: { contains: 'soft', mode: 'insensitive' } } },
      { subject: { code: { contains: 'soft', mode: 'insensitive' } } },
    ])
  })

  it('returns only the requesting student’s attendance aggregates without identifiers', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.attendanceRecord.findMany.mockResolvedValue([
      ...Array.from({ length: 8 }, () => record('present', '2026-10-01')),
      record('late', '2026-10-08'),
      ...Array.from({ length: 2 }, () => record('absent', '2026-10-15')),
      record('pending', '2026-10-20'),
      record('disputed', '2026-10-22'),
    ])

    const execution = await registry.execute(
      'student',
      student as never,
      'get_my_attendance_summary',
      { sectionId: 'sec-1' },
      'thread-student',
    )

    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith({
      where: { sectionId: 'sec-1', studentId: 'student-1' },
      select: {
        status: true,
        timestamp: true,
        session: { select: { date: true } },
      },
    })
    expect(execution.result).toEqual({
      sectionId: 'sec-1',
      subjectName: 'Software Engineering',
      subjectCode: 'SE101',
      sectionName: '1',
      present: 8,
      late: 1,
      absent: 2,
      pending: 1,
      disputed: 1,
      excused: 0,
      attendanceRate: 81.8,
      lastSessionDate: '2026-10-22',
    })
    const serialized = JSON.stringify(execution.result)
    expect(serialized).not.toMatch(/studentName|latitude|longitude|deviceId|@/)
  })

  it('returns the standing evaluator output verbatim', async () => {
    const { registry, standing } = makeRegistry()

    const execution = await registry.execute(
      'student',
      student as never,
      'evaluate_attendance_standing',
      { sectionId: 'sec-1' },
      'thread-student',
    )

    expect(standing.forStudentSection).toHaveBeenCalledWith(student, 'sec-1')
    expect(execution.result).toEqual(standingRow)
  })

  it('returns the professor name only, never contact details', async () => {
    const { registry } = makeRegistry()

    const execution = await registry.execute(
      'student',
      student as never,
      'get_professor',
      { sectionId: 'sec-1' },
      'thread-student',
    )

    expect(execution.result).toEqual({
      professorName: 'Prof. Cruz',
      subjectName: 'Software Engineering',
      sectionName: '1',
    })
    expect(JSON.stringify(execution.result)).not.toMatch(/@|email|phone|contact/i)
  })

  it('drafts a deterministic professor message with no anti-cheat details', async () => {
    const { registry } = makeRegistry()
    const args = {
      sectionId: 'sec-1',
      concern: 'I have missed several classes because of work and want to catch up',
    }

    const first = await registry.execute('student', student as never, 'draft_professor_message', args, 'thread-student')
    const second = await registry.execute(
      'student',
      student as never,
      'draft_professor_message',
      args,
      'thread-student',
    )

    expect(first.result).toEqual(second.result)
    const message = (first.result as { message: string }).message
    expect(message).toContain('Prof. Cruz')
    expect(message).toContain(args.concern)
    expect(message).toContain('guidance')
    expect(message).not.toMatch(/geofence|radius|coordinates?|latitude|longitude|gps|device|fingerprint|anti-cheat/i)
  })

  it('sanitizes anti-cheat mechanics out of a student-provided concern', async () => {
    const { registry } = makeRegistry()

    const execution = await registry.execute(
      'student',
      student as never,
      'draft_professor_message',
      { sectionId: 'sec-1', concern: 'I was marked absent outside the geofence radius' },
      'thread-student',
    )

    const message = (execution.result as { message: string }).message
    expect(message).toContain('check-in area')
    expect(message).not.toMatch(/geofence|radius|coordinates?|latitude|longitude|gps|device|fingerprint|anti-cheat/i)
  })

  it.each<[string, Record<string, unknown>]>([
    ['get_my_attendance_summary', { sectionId: 'sec-1' }],
    ['evaluate_attendance_standing', { sectionId: 'sec-1' }],
    ['get_professor', { sectionId: 'sec-1' }],
    ['draft_professor_message', { sectionId: 'sec-1', concern: 'I have missed classes' }],
  ])('denies %s for a section the student is not enrolled in', async (tool, args) => {
    const { registry, prisma, audit, standing } = makeRegistry()
    prisma.enrollment.findUnique.mockResolvedValue(null)

    await expect(registry.execute('student', student as never, tool, args, 'thread-denied')).rejects.toMatchObject({
      outcome: 'denied',
      message: 'You are not enrolled in this section',
    })
    expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
      where: { studentId_sectionId: { studentId: 'student-1', sectionId: 'sec-1' } },
      select: expect.anything(),
    })
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled()
    expect(standing.forStudentSection).not.toHaveBeenCalled()
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(
      student,
      'thread-denied',
      tool,
      'denied',
      'You are not enrolled in this section',
    )
  })

  it('scopes teacher section search to the signed-in teacher', async () => {
    const { registry, prisma, audit } = makeRegistry()
    prisma.section.findMany.mockResolvedValue([sectionRow])

    const execution = await registry.execute(
      'teacher',
      teacher as never,
      'find_sections',
      { query: 'software' },
      'thread-1',
    )

    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teacherId: 'teacher-1' }),
        take: 10,
      }),
    )
    expect(execution.result).toEqual({
      query: 'software',
      count: 1,
      truncated: false,
      sections: [
        {
          id: 'sec-1',
          subject: 'Software Engineering',
          subjectCode: 'SE101',
          section: '1',
          studentCount: 40,
          room: 'Room 101',
          scheduleSummary: 'Mon 09:00-10:00, Wed 10:00-11:30',
          teacherName: 'Prof. Cruz',
          semester: '2026-1',
        },
      ],
    })
    expect(execution.attachments).toEqual([])
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(teacher, 'thread-1', 'find_sections', 'succeeded')
  })

  it('uses the department scope for a department super admin', async () => {
    const { registry, prisma } = makeRegistry()

    await registry.execute('super_admin', departmentAdmin as never, 'find_sections', { query: 'math' })
    expect(prisma.section.findMany.mock.calls[0][0].where.teacher).toEqual({ department: 'CCIS' })

    await registry.execute('super_admin', institutionAdmin as never, 'find_sections', { query: 'math' })
    expect(prisma.section.findMany.mock.calls[1][0].where.teacher).toBeUndefined()
  })

  it('denies a teacher resolving another teacher section and audits the denial', async () => {
    const { registry, audit } = makeRegistry()

    await expect(
      registry.execute(
        'teacher',
        otherTeacher as never,
        'get_section_master_list',
        { sectionId: 'sec-1', format: 'pdf' },
        'thread-1',
      ),
    ).rejects.toMatchObject({ outcome: 'denied' })
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(
      otherTeacher,
      'thread-1',
      'get_section_master_list',
      'denied',
      'You can only access your own sections',
    )
  })

  it('denies a department admin a section outside their department', async () => {
    const { registry, prisma, audit } = makeRegistry()
    prisma.section.findFirst.mockResolvedValue(null)

    await expect(
      registry.execute(
        'super_admin',
        departmentAdmin as never,
        'get_section_master_list',
        { sectionId: 'sec-1', format: 'docx' },
        'thread-2',
      ),
    ).rejects.toMatchObject({ outcome: 'denied' })
    expect(prisma.section.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sec-1', teacher: { department: 'CCIS' } },
      }),
    )
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(
      departmentAdmin,
      'thread-2',
      'get_section_master_list',
      'denied',
      'This section is outside your administrative scope',
    )
  })

  it('builds the master-list download attachment and returns counts only', async () => {
    const { registry } = makeRegistry()

    const execution = await registry.execute(
      'teacher',
      teacher as never,
      'get_section_master_list',
      { sectionId: 'sec-1', format: 'pdf' },
      'thread-1',
    )

    expect(execution.attachments).toEqual([
      {
        id: 'master-list-sec-1-pdf',
        kind: 'master_list',
        format: 'pdf',
        label: 'Master list — Software Engineering Section 1',
        filename: 'master-list-1-SE101.pdf',
        downloadPath: '/docs/master-list/sec-1?format=pdf',
      },
    ])
    expect(execution.result).toEqual({ attachment: execution.attachments[0], studentCount: 40 })
    expect(JSON.stringify(execution.result)).not.toContain('studentName')
  })

  it('rejects unsupported master-list formats with a failed audit', async () => {
    const { registry, audit } = makeRegistry()

    await expect(
      registry.execute(
        'teacher',
        teacher as never,
        'get_section_master_list',
        { sectionId: 'sec-1', format: 'xlsx' },
        'thread-1',
      ),
    ).rejects.toMatchObject({ outcome: 'failed' })
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(
      teacher,
      'thread-1',
      'get_section_master_list',
      'failed',
      'format must be either pdf or docx',
    )
  })

  it('returns scoped sessions with a date filter and status mapping', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.session.findMany.mockResolvedValue([
      {
        id: 'sess-1',
        date: '2026-10-26',
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room 101',
        isActive: false,
        endedAt: new Date('2026-10-26T10:00:00.000Z'),
      },
      {
        id: 'sess-2',
        date: '2026-10-27',
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room 101',
        isActive: true,
        endedAt: null,
      },
    ])

    const execution = await registry.execute(
      'teacher',
      teacher as never,
      'get_section_sessions',
      { sectionId: 'sec-1', date: '2026-10-26' },
      'thread-1',
    )

    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sectionId: 'sec-1', date: '2026-10-26' },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: 50,
      }),
    )
    expect(execution.result).toEqual({
      sectionId: 'sec-1',
      count: 2,
      sessions: [
        {
          id: 'sess-1',
          date: '2026-10-26',
          startTime: '09:00',
          endTime: '10:00',
          room: 'Room 101',
          isActive: false,
          endedAt: '2026-10-26T10:00:00.000Z',
          status: 'ended',
        },
        {
          id: 'sess-2',
          date: '2026-10-27',
          startTime: '09:00',
          endTime: '10:00',
          room: 'Room 101',
          isActive: true,
          endedAt: null,
          status: 'active',
        },
      ],
    })
  })

  it('maps attendance counts and returns the CSV attachment without student rows', async () => {
    const { registry, prisma, audit } = makeRegistry()
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-1',
      section: { section: '1' },
    })
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      { status: 'present', _count: { status: 3 } },
      { status: 'late', _count: { status: 1 } },
      { status: 'absent', _count: { status: 2 } },
      { status: 'pending', _count: { status: 4 } },
      { status: 'disputed', _count: { status: 5 } },
    ])

    const execution = await registry.execute(
      'teacher',
      teacher as never,
      'get_session_attendance',
      { sessionId: 'sess-1' },
      'thread-7',
    )

    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { sessionId: 'sess-1' },
      _count: { status: true },
    })
    expect(execution.result).toEqual({
      sessionId: 'sess-1',
      sectionId: 'sec-1',
      section: '1',
      counts: { present: 3, late: 1, absent: 2, pending: 4, disputed: 5, excused: 0 },
      csvDownloadPath: '/docs/session-attendance/sess-1?format=csv',
      attachment: execution.attachments[0],
    })
    expect(execution.attachments).toEqual([
      {
        id: 'session-attendance-sess-1-csv',
        kind: 'session_attendance',
        format: 'csv',
        label: 'Attendance — 1',
        filename: 'attendance-sess-1.csv',
        downloadPath: '/docs/session-attendance/sess-1?format=csv',
      },
    ])
    expect(JSON.stringify(execution.result)).not.toContain('studentName')
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(teacher, 'thread-7', 'get_session_attendance', 'succeeded')
  })

  it('denies a teacher access to another teacher session', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      sectionId: 'sec-1',
      teacherId: 'teacher-2',
      section: { section: '1' },
    })

    await expect(
      registry.execute('teacher', teacher as never, 'get_session_attendance', { sessionId: 'sess-1' }, 'thread-1'),
    ).rejects.toBeInstanceOf(AiToolError)
  })

  it('audits unknown tools as failed', async () => {
    const { registry, audit } = makeRegistry()

    await expect(registry.execute('teacher', teacher as never, 'drop_tables', {}, 'thread-1')).rejects.toMatchObject({
      outcome: 'failed',
    })
    expect(audit.recordToolInvocation).toHaveBeenCalledWith(
      teacher,
      'thread-1',
      'drop_tables',
      'failed',
      'Unknown tool',
    )
  })

  it('browses accessible sections when find_sections is called without a query', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.section.findMany.mockResolvedValue([sectionRow])

    await registry.execute('teacher', teacher as never, 'find_sections', {}, 'thread-1')

    const where = prisma.section.findMany.mock.calls[0][0].where
    expect(where).toEqual({ teacherId: 'teacher-1' })
    expect(where.OR).toBeUndefined()
  })

  it('tokenizes natural-language section queries instead of matching the whole sentence', async () => {
    const { registry, prisma } = makeRegistry()

    await registry.execute(
      'teacher',
      teacher as never,
      'find_sections',
      { query: 'Extract the master list for Software Engineering CCIS 3104 Section A as PDF' },
      'thread-1',
    )

    const or = prisma.section.findMany.mock.calls[0][0].where.OR
    const serialized = JSON.stringify(or)
    expect(serialized).toContain('CCIS')
    expect(serialized).toContain('Software')
    expect(serialized).not.toContain('master list')
    expect(serialized).not.toContain('Extract the')
  })

  it('defaults the master list format to PDF', async () => {
    const { registry } = makeRegistry()

    const execution = await registry.execute('teacher', teacher as never, 'get_section_master_list', {
      sectionId: 'sec-1',
    })

    expect(execution.attachments).toEqual([
      expect.objectContaining({
        kind: 'master_list',
        format: 'pdf',
        downloadPath: '/docs/master-list/sec-1?format=pdf',
      }),
    ])
  })

  it('returns a scoped institution overview for administrators', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.user.count.mockResolvedValue(7)
    prisma.section.count.mockResolvedValue(12)
    prisma.session.count.mockResolvedValue(3)
    prisma.attendanceRecord.count.mockResolvedValue(4)

    const execution = await registry.execute(
      'super_admin',
      departmentAdmin as never,
      'get_institution_overview',
      {},
      'thread-admin',
    )

    expect(execution.result).toEqual({
      faculty: { active: 7, inactive: 7 },
      students: { active: 7, inactive: 7 },
      sections: 12,
      activeSessions: 3,
      pendingDisputes: 4,
    })
    expect(prisma.user.count.mock.calls[0][0].where).toMatchObject({
      role: 'teacher',
      isActive: true,
      department: 'CCIS',
    })
  })

  it('searches user accounts within the administrator scope only', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'student-1',
        fullName: 'Juan Dela Cruz',
        role: 'student',
        email: 'juan@pup.edu.ph',
        studentId: '2024-00001-MN-0',
        department: 'CCIS',
        isActive: false,
        program: 'BSIT',
        yearLevel: 1,
      },
    ])

    const execution = await registry.execute(
      'super_admin',
      departmentAdmin as never,
      'find_users',
      { query: 'juan', status: 'inactive' },
      'thread-admin',
    )

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          department: 'CCIS',
          isActive: false,
          OR: expect.any(Array),
        }),
        take: 10,
      }),
    )
    expect(JSON.stringify(execution.result)).not.toContain('password')
    expect(execution.result).toMatchObject({ count: 1 })
  })

  it('denies administrative tools to teachers', async () => {
    const { registry } = makeRegistry()

    await expect(
      registry.execute('teacher', teacher as never, 'get_institution_overview', {}, 'thread-1'),
    ).rejects.toMatchObject({ outcome: 'failed' })
  })

  it('lists recent audit entries scoped to the administrator', async () => {
    const { registry, prisma } = makeRegistry()
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'admin-1' }, { id: 'teacher-1' }])
      .mockResolvedValueOnce([{ id: 'teacher-1', fullName: 'Prof. Cruz' }])
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        actorId: 'teacher-1',
        actorRole: 'teacher',
        action: 'PATCH /sections/sec-1',
        entityType: 'sections',
        entityId: 'sec-1',
        metadata: { outcome: 'succeeded' },
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
      },
    ])

    const execution = await registry.execute(
      'super_admin',
      departmentAdmin as never,
      'get_recent_audit_activity',
      { limit: 5 },
      'thread-admin',
    )

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actorId: { in: ['admin-1', 'teacher-1'] } },
        take: 5,
      }),
    )
    expect(execution.result).toMatchObject({
      count: 1,
      entries: [
        expect.objectContaining({
          actorName: 'Prof. Cruz',
          outcome: 'succeeded',
        }),
      ],
    })
  })
})
