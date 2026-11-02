import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import {
  AT_RISK_NOTICE_ACTIONS,
  AT_RISK_NOTICE_CITATION_LINES,
  AT_RISK_NOTICE_SIGNOFFS,
  AT_RISK_NOTICE_TITLE,
  buildClassRecordGrid,
  buildNoticeLedgerRows,
  CLASS_RECORD_WEEK_SYMBOLS,
  CLASS_RECORD_WEEKS,
  DocsService,
  MASTER_LIST_COLUMNS,
  noticeComputationLine,
} from './docs.service'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const otherTeacher: RequestUser = { id: 'teacher-2', role: 'teacher' }
const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const departmentAdmin: RequestUser = {
  id: 'admin-2',
  role: 'super_admin',
  scope: 'department',
  department: 'CCIS',
}

const masterSection = {
  id: 'sec-1',
  teacherId: 'teacher-1',
  section: 'BSIT 1-A',
  room: 'Room 201',
  semester: '2026-2027 First Semester',
  subject: { name: 'Software Engineering', code: 'COMP 20043' },
  teacher: { fullName: 'Prof. Maria Santos' },
  enrollments: [
    {
      student: { studentId: '2023-0001', fullName: 'Alpha, Juan', program: 'BSIT', yearLevel: 3 },
    },
    {
      student: { studentId: '2023-0002', fullName: 'Beta, Maria', program: 'BSIT', yearLevel: 2 },
    },
  ],
}

const session = {
  id: 'sess-1',
  sectionId: 'sec-1',
  teacherId: 'teacher-1',
  subjectName: 'Software Engineering',
  date: '2026-10-26',
  startTime: '09:00',
  endTime: '10:30',
  room: 'Room 201',
  section: {
    section: 'BSIT 1-A',
    room: 'Room 201',
    semester: '2026-2027 First Semester',
    subject: { name: 'Software Engineering', code: 'COMP 20043' },
    teacher: { fullName: 'Prof. Maria Santos' },
    enrollments: [
      { student: { id: 'stu-1', studentId: '2023-0001', fullName: 'Alpha, Juan' } },
      { student: { id: 'stu-2', studentId: '2023-0002', fullName: 'Beta, Maria' } },
      { student: { id: 'stu-3', studentId: '2023-0003', fullName: 'Gamma, Ana' } },
      { student: { id: 'stu-4', studentId: '2023-0004', fullName: 'Dela "Cruz", Ana' } },
    ],
  },
  attendanceRecords: [
    {
      studentId: 'stu-1',
      studentName: 'Alpha, Juan',
      status: 'present',
      timestamp: new Date('2026-10-26T01:00:00.000Z'),
      student: { studentId: '2023-0001', fullName: 'Alpha, Juan' },
    },
    {
      studentId: 'stu-2',
      studentName: 'Beta, Maria',
      status: 'late',
      timestamp: new Date('2026-10-26T01:20:00.000Z'),
      student: { studentId: '2023-0002', fullName: 'Beta, Maria' },
    },
    {
      studentId: 'stu-4',
      studentName: 'Dela "Cruz", Ana',
      status: 'disputed',
      timestamp: new Date('2026-10-26T01:30:00.000Z'),
      student: { studentId: '2023-0004', fullName: 'Dela "Cruz", Ana' },
    },
    {
      studentId: 'stu-9',
      studentName: '=REMOVED, Eve',
      status: 'absent',
      timestamp: new Date('2026-10-26T01:40:00.000Z'),
      student: { studentId: '2022-9999', fullName: '=REMOVED, Eve' },
    },
  ],
}

function createPrisma(section: unknown = masterSection, sessionFixture: unknown = session) {
  return {
    section: {
      findUnique: jest.fn().mockResolvedValue(section),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    session: { findUnique: jest.fn().mockResolvedValue(sessionFixture) },
    institutionSetting: {
      findUnique: jest.fn().mockResolvedValue({ value: 'Polytechnic University of the Philippines' }),
    },
  }
}

describe('DocsService', () => {
  it('keeps the master-list column order and widths stable', () => {
    expect(MASTER_LIST_COLUMNS.map((column) => column.header)).toEqual([
      'No.',
      'Student Number',
      'Full Name',
      'Program',
      'Year Level',
    ])
    expect(MASTER_LIST_COLUMNS.reduce((total, column) => total + column.width, 0)).toBe(495)
  })

  it('renders a valid PDF master list with a sanitized filename', async () => {
    const prisma = createPrisma()
    const service = new DocsService(prisma as never)

    const document = await service.masterList(teacher, 'sec-1', 'pdf')

    expect(document.filename).toBe('master-list-BSIT-1-A-COMP-20043.pdf')
    expect(document.contentType).toBe('application/pdf')
    expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
    expect(document.body.length).toBeGreaterThan(1_000)
    expect(prisma.institutionSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'institution_name' },
      select: { value: true },
    })
  })

  it('renders a valid DOCX master list', async () => {
    const service = new DocsService(createPrisma() as never)

    const document = await service.masterList(teacher, 'sec-1', 'docx')

    expect(document.filename).toBe('master-list-BSIT-1-A-COMP-20043.docx')
    expect(document.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(document.body[0]).toBe(0x50)
    expect(document.body[1]).toBe(0x4b)
    expect(document.body.length).toBeGreaterThan(1_000)
  })

  it('sanitizes unsafe section and subject code characters in filenames', async () => {
    const unsafeSection = {
      ...masterSection,
      section: 'BSIT/1:../A',
      subject: { name: 'Software Engineering', code: 'COMP*200?' },
    }
    const service = new DocsService(createPrisma(unsafeSection) as never)

    const document = await service.masterList(teacher, 'sec-1', 'pdf')

    expect(document.filename).toBe('master-list-BSIT-1-A-COMP-200.pdf')
    expect(document.filename).not.toContain('/')
    expect(document.filename).not.toContain('..')
  })

  it('still renders when the institution setting is missing', async () => {
    const prisma = createPrisma()
    prisma.institutionSetting.findUnique.mockResolvedValue(null)
    const service = new DocsService(prisma as never)

    const document = await service.masterList(teacher, 'sec-1', 'pdf')

    expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
  })

  describe('authorization', () => {
    it('forbids teachers from generating another teacher section master list', async () => {
      const service = new DocsService(createPrisma() as never)

      await expect(service.masterList(otherTeacher, 'sec-1', 'pdf')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('forbids a department admin outside the section scope', async () => {
      const prisma = createPrisma()
      const service = new DocsService(prisma as never)

      await expect(service.masterList(departmentAdmin, 'sec-1', 'pdf')).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.section.findFirst).toHaveBeenCalledWith({
        where: { id: 'sec-1', teacher: { department: 'CCIS' } },
        select: { id: true },
      })
    })

    it('allows an institution admin to generate any section master list', async () => {
      const prisma = createPrisma()
      const service = new DocsService(prisma as never)

      const document = await service.masterList(institutionAdmin, 'sec-1', 'pdf')

      expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
      expect(prisma.section.findFirst).not.toHaveBeenCalled()
    })

    it('forbids students from reaching the service directly', async () => {
      const service = new DocsService(createPrisma() as never)

      await expect(service.masterList({ id: 'student-1', role: 'student' }, 'sec-1', 'pdf')).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })

    it('returns not found for an unknown section', async () => {
      const service = new DocsService(createPrisma(null) as never)

      await expect(service.masterList(teacher, 'missing', 'pdf')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('forbids teachers from generating another teacher session attendance', async () => {
      const service = new DocsService(createPrisma() as never)

      await expect(service.sessionAttendance(otherTeacher, 'sess-1', 'csv')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('forbids a department admin outside the session scope', async () => {
      const prisma = createPrisma()
      const service = new DocsService(prisma as never)

      await expect(service.sessionAttendance(departmentAdmin, 'sess-1', 'csv')).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      expect(prisma.section.findFirst).toHaveBeenCalled()
    })
  })

  describe('session attendance CSV', () => {
    it('escapes CSV values, includes pending rows, and appends counts', async () => {
      const service = new DocsService(createPrisma() as never)

      const document = await service.sessionAttendance(teacher, 'sess-1', 'csv')
      const csv = document.body.toString('utf8')
      const lines = csv.split('\n')

      expect(document.filename).toBe('attendance-BSIT-1-A-2026-10-26.csv')
      expect(document.contentType).toBe('text/csv; charset=utf-8')
      expect(document.body.subarray(0, 3)).not.toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
      expect(lines[0]).toBe('"Student Number","Full Name","Status","Timestamp"')
      expect(csv).toContain('"2023-0001","Alpha, Juan","present","2026-10-26T01:00:00.000Z"')
      expect(csv).toContain('"2023-0003","Gamma, Ana","pending",""')
      expect(csv).toContain('"Dela ""Cruz"", Ana"')
      expect(csv).toContain('"\'=REMOVED, Eve"')
      expect(lines).toContain('"Present","1"')
      expect(lines).toContain('"Late","1"')
      expect(lines).toContain('"Absent","1"')
      expect(lines).toContain('"Pending","1"')
      expect(lines).toContain('"Disputed","1"')
      expect(lines).toContain('"Excused","0"')
      expect(lines).toContain('"Total","5"')
    })

    it('renders a valid PDF session attendance report', async () => {
      const service = new DocsService(createPrisma() as never)

      const document = await service.sessionAttendance(teacher, 'sess-1', 'pdf')

      expect(document.filename).toBe('attendance-BSIT-1-A-2026-10-26.pdf')
      expect(document.contentType).toBe('application/pdf')
      expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
      expect(document.body.length).toBeGreaterThan(1_000)
    })

    it('returns not found for an unknown session', async () => {
      const service = new DocsService(createPrisma(masterSection, null) as never)

      await expect(service.sessionAttendance(teacher, 'missing', 'csv')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('class record (F4)', () => {
    const classRecordSection = {
      id: 'sec-1',
      teacherId: 'teacher-1',
      section: 'BSIT 1-A',
      room: 'Room 201',
      semester: '2026-2027 First Semester',
      subject: { name: 'Software Engineering', code: 'COMP 20043' },
      teacher: { fullName: 'Prof. Maria Santos', department: 'CCIS' },
      enrollments: [
        { student: { id: 'stu-1', studentId: '2023-0001', fullName: 'Alpha, Juan' } },
        { student: { id: 'stu-2', studentId: '2023-0002', fullName: 'Beta, Maria' } },
        { student: { id: 'stu-3', studentId: '2023-0003', fullName: 'Gamma, Ana' } },
      ],
      sessions: [
        { id: 'sess-w1a', date: '2026-08-10', startTime: '08:00' },
        { id: 'sess-w1b', date: '2026-08-11', startTime: '08:00' },
        { id: 'sess-w2', date: '2026-08-17', startTime: '08:00' },
        { id: 'sess-w3', date: '2026-08-24', startTime: '08:00' },
        { id: 'sess-w6', date: '2026-09-14', startTime: '08:00' },
        { id: 'sess-beyond', date: '2026-12-14', startTime: '08:00' },
      ],
    }

    const classRecords = [
      {
        studentId: 'stu-1',
        status: 'present',
        sessionId: 'sess-w1a',
      },
      {
        studentId: 'stu-1',
        status: 'absent',
        sessionId: 'sess-w1b',
      },
      {
        studentId: 'stu-1',
        status: 'absent',
        sessionId: 'sess-w2',
      },
      {
        studentId: 'stu-1',
        status: 'excused',
        sessionId: 'sess-w3',
      },
      {
        studentId: 'stu-1',
        status: 'incomplete',
        sessionId: 'sess-w6',
      },
      {
        studentId: 'stu-2',
        status: 'present',
        sessionId: 'sess-w1a',
      },
      {
        studentId: 'stu-1',
        status: 'absent',
        sessionId: 'sess-beyond',
      },
    ]

    function createClassRecordPrisma(section: unknown = classRecordSection, records: unknown = classRecords) {
      return {
        section: {
          findUnique: jest.fn().mockResolvedValue(section),
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
        attendanceRecord: { findMany: jest.fn().mockResolvedValue(records) },
        institutionSetting: {
          findUnique: jest.fn().mockResolvedValue({ value: 'Polytechnic University of the Philippines' }),
        },
      }
    }

    const roster = [
      { studentId: 'stu-1', studentNumber: '2023-0001', fullName: 'Alpha, Juan' },
      { studentId: 'stu-2', studentNumber: '2023-0002', fullName: 'Beta, Maria' },
      { studentId: 'stu-3', studentNumber: '2023-0003', fullName: 'Gamma, Ana' },
    ]

    it('derives 18 Monday-anchored weeks from the earliest session', () => {
      const grid = buildClassRecordGrid(classRecordSection.sessions, classRecords, roster, CLASS_RECORD_WEEKS)

      expect(grid.weeks).toBe(18)
      expect(grid.startIso).toBe('2026-08-10')
      expect(grid.endIso).toBe('2026-12-13')
      expect(grid.weekHeaders).toEqual(Array.from({ length: 18 }, (_, index) => `W${index + 1}`))
    })

    it('maps statuses to week symbols, joins multi-session weeks, and keeps no-session dashes', () => {
      const grid = buildClassRecordGrid(classRecordSection.sessions, classRecords, roster, CLASS_RECORD_WEEKS)
      const [alpha, beta, gamma] = grid.rows

      expect(CLASS_RECORD_WEEK_SYMBOLS).toEqual({
        present: 'P',
        late: 'L',
        absent: 'A',
        excused: 'E',
        incomplete: 'I',
      })
      // Alpha: two sessions in W1 join chronologically; W3 excused; W6 incomplete (I).
      expect(alpha.cells[0]).toBe('P/A')
      expect(alpha.cells[1]).toBe('A')
      expect(alpha.cells[2]).toBe('E')
      expect(alpha.cells[5]).toBe('I')
      expect(alpha.cells[4]).toBe('–')
      // Alpha has final rows only in W1 (two sessions), W2, W3, and W6; the
      // overwritten beyond-W18 session lands nowhere. 18 − 4 renderable
      // session weeks = 14 dashes.
      expect(alpha.cells.filter((cell) => cell === '–')).toHaveLength(14)
      expect(beta.cells[0]).toBe('P')
      expect(beta.cells.slice(1).every((cell) => cell === '–')).toBe(true)
      // A student without any final record shows dashes even in session weeks.
      expect(gamma.cells.every((cell) => cell === '–')).toBe(true)
    })

    it('computes row totals and the rate using the standing denominator rule', () => {
      const grid = buildClassRecordGrid(classRecordSection.sessions, classRecords, roster, CLASS_RECORD_WEEKS)
      const [alpha, beta, gamma] = grid.rows

      expect(alpha.totals).toEqual({ present: 1, late: 0, absent: 2, excused: 1 })
      // counted = P1 + A2 + I1 = 4, attended = P1 → 25%; excused excluded, incomplete included.
      expect(alpha.rate).toBe('25%')
      expect(beta.totals).toEqual({ present: 1, late: 0, absent: 0, excused: 0 })
      expect(beta.rate).toBe('100%')
      expect(gamma.rate).toBe('–')
      expect(gamma.totals).toEqual({ present: 0, late: 0, absent: 0, excused: 0 })
    })

    it('snaps the ?from anchor override to the first Monday on/after it and drops earlier sessions', () => {
      const grid = buildClassRecordGrid(
        classRecordSection.sessions,
        classRecords,
        roster,
        CLASS_RECORD_WEEKS,
        '2026-08-14',
      )
      expect(grid.startIso).toBe('2026-08-17')
      // The Aug 10/11 sessions precede the override anchor and render nowhere.
      expect(grid.rows[0].cells[0]).toBe('A')
      expect(grid.rows[0].cells[1]).toBe('E')
      expect(grid.rows[0].rate).toBe('0%')
    })

    it('renders a valid PDF class record for the owning teacher with the official filename', async () => {
      const prisma = createClassRecordPrisma()
      const service = new DocsService(prisma as never)

      const document = await service.classRecord(teacher, 'sec-1', 'pdf')

      expect(document.filename).toBe('PUP-ClassRecord-COMP-20043-BSIT-1-A-2026-2027-First-Semester.pdf')
      expect(document.contentType).toBe('application/pdf')
      expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
      expect(document.body.length).toBeGreaterThan(1_000)
      // The PDF Info dictionary is uncompressed — the title must be present.
      expect(document.body.toString('latin1')).toContain('(OFFICIAL CLASS RECORD)')
      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith({
        where: { sectionId: 'sec-1' },
        select: { studentId: true, status: true, sessionId: true },
      })
      expect(prisma.section.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sec-1' } }))
      // Roster/sessions come pre-ordered by the query; the builder must not reorder.
      expect(prisma.section.findUnique.mock.calls[0][0].select.sessions.orderBy).toEqual([
        { date: 'asc' },
        { startTime: 'asc' },
      ])
      expect(prisma.section.findUnique.mock.calls[0][0].select.enrollments.orderBy).toEqual({
        student: { fullName: 'asc' },
      })
    })

    it('renders a valid DOCX class record', async () => {
      const service = new DocsService(createClassRecordPrisma() as never)

      const document = await service.classRecord(teacher, 'sec-1', 'docx')

      expect(document.filename).toBe('PUP-ClassRecord-COMP-20043-BSIT-1-A-2026-2027-First-Semester.docx')
      expect(document.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(document.body[0]).toBe(0x50)
      expect(document.body[1]).toBe(0x4b)
      expect(document.body.length).toBeGreaterThan(1_000)
    })

    it('returns not found for an unknown section', async () => {
      const service = new DocsService(createClassRecordPrisma(null) as never)

      await expect(service.classRecord(teacher, 'missing', 'pdf')).rejects.toBeInstanceOf(NotFoundException)
    })

    describe('scope matrix', () => {
      it('allows the owning teacher without scoping queries', async () => {
        const prisma = createClassRecordPrisma()
        const service = new DocsService(prisma as never)

        await expect(service.classRecord(teacher, 'sec-1', 'pdf')).resolves.toMatchObject({
          contentType: 'application/pdf',
        })
        expect(prisma.section.findFirst).not.toHaveBeenCalled()
      })

      it('forbids a colleague teacher without the academic-oversight designation', async () => {
        const service = new DocsService(createClassRecordPrisma() as never)

        await expect(service.classRecord(otherTeacher, 'sec-1', 'pdf')).rejects.toBeInstanceOf(ForbiddenException)
      })

      it.each([
        ['CCIS', true],
        ['CEP', false],
        [null, false],
      ])('opens the class record to a department head with department %s: %j', async (department, allowed) => {
        const prisma = createClassRecordPrisma()
        const head: RequestUser = { id: 'head-1', role: 'teacher', isDepartmentHead: true, department }
        const service = new DocsService(prisma as never)

        const result = service.classRecord(head, 'sec-1', 'pdf')
        if (allowed) {
          await expect(result).resolves.toMatchObject({ contentType: 'application/pdf' })
          expect(prisma.section.findFirst).not.toHaveBeenCalled()
        } else {
          await expect(result).rejects.toBeInstanceOf(ForbiddenException)
        }
      })

      it('keeps department admins behind adminSectionInScope and institution admins open', async () => {
        const denied = createClassRecordPrisma()
        const departmentAdminService = new DocsService(denied as never)

        await expect(departmentAdminService.classRecord(departmentAdmin, 'sec-1', 'pdf')).rejects.toBeInstanceOf(
          ForbiddenException,
        )
        expect(denied.section.findFirst).toHaveBeenCalledWith({
          where: { id: 'sec-1', teacher: { department: 'CCIS' } },
          select: { id: true },
        })

        const allowed = createClassRecordPrisma()
        await expect(
          new DocsService(allowed as never).classRecord(institutionAdmin, 'sec-1', 'pdf'),
        ).resolves.toMatchObject({
          contentType: 'application/pdf',
        })
        expect(allowed.section.findFirst).not.toHaveBeenCalled()
      })

      it('forbids students from reaching the service directly', async () => {
        const service = new DocsService(createClassRecordPrisma() as never)

        await expect(service.classRecord({ id: 'student-1', role: 'student' }, 'sec-1', 'pdf')).rejects.toBeInstanceOf(
          ForbiddenException,
        )
      })
    })
  })

  describe('DPO summary (F6)', () => {
    const itCoordinator: RequestUser = { id: 'teacher-it', role: 'teacher', isItCoordinator: true }
    const plainFaculty: RequestUser = { id: 'teacher-x', role: 'teacher' }
    const student: RequestUser = { id: 'student-1', role: 'student' }

    function createDpoPrisma(options: { retentionDays?: string; covered?: number; totalActive?: number } = {}) {
      return {
        institutionSetting: {
          findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
            where.key === 'geolocation_retention_days' && options.retentionDays
              ? { value: options.retentionDays }
              : { value: 'Polytechnic University of the Philippines' },
          ),
        },
        attendanceRecord: { count: jest.fn().mockResolvedValue(0) },
        scanAttempt: { count: jest.fn().mockResolvedValue(0) },
        user: {
          count: jest
            .fn()
            .mockResolvedValueOnce(options.covered ?? 0)
            .mockResolvedValueOnce(options.totalActive ?? 0),
        },
      }
    }

    const config = { get: jest.fn(() => '2026-09-05') }

    it('is limited to IT coordinators and institution administrators', async () => {
      const allowed = createDpoPrisma()
      await expect(
        new DocsService(allowed as never, config as never).dpoSummary(itCoordinator, 'pdf'),
      ).resolves.toMatchObject({ filename: 'dpo-summary.pdf', contentType: 'application/pdf' })
      await expect(
        new DocsService(allowed as never, config as never).dpoSummary(institutionAdmin, 'pdf'),
      ).resolves.toMatchObject({
        filename: 'dpo-summary.pdf',
      })

      const denied = createDpoPrisma()
      await expect(
        new DocsService(denied as never, config as never).dpoSummary(plainFaculty, 'pdf'),
      ).rejects.toBeInstanceOf(ForbiddenException)
      await expect(new DocsService(denied as never, config as never).dpoSummary(student, 'pdf')).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })

    it('computes the retention attestation and consent coverage live at render time', async () => {
      const prisma = createDpoPrisma({ retentionDays: '75', covered: 3, totalActive: 4 })
      const service = new DocsService(prisma as never, config as never)

      await service.dpoSummary(itCoordinator, 'pdf')

      const retentionWhere = prisma.attendanceRecord.count.mock.calls[0][0].where
      expect(retentionWhere.OR).toEqual([{ latitude: { not: null } }, { longitude: { not: null } }])
      const cutoff = retentionWhere.timestamp.lt as Date
      expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(74 * 24 * 60 * 60 * 1000)
      expect(prisma.scanAttempt.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ OR: expect.anything() }),
      })
      expect(prisma.user.count).toHaveBeenNthCalledWith(1, {
        where: { isActive: true, privacyConsentVersion: '2026-09-05' },
      })
      expect(prisma.user.count).toHaveBeenNthCalledWith(2, { where: { isActive: true } })
      expect(prisma.institutionSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'geolocation_retention_days' },
        select: { value: true },
      })
    })

    it('renders a valid PDF one-pager with the inventory table and sections', async () => {
      const service = new DocsService(createDpoPrisma({ covered: 7, totalActive: 8 }) as never, config as never)

      const document = await service.dpoSummary(itCoordinator, 'pdf')

      expect(document.filename).toBe('dpo-summary.pdf')
      expect(document.contentType).toBe('application/pdf')
      expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
      const raw = document.body.toString('latin1')
      expect(raw).toContain('DATA PROTECTION OFFICER')
      expect(raw).toContain('RA 10173')
      expect(raw).toContain('/Count 1')
    })

    it('renders a valid DOCX DPO summary', async () => {
      const service = new DocsService(createDpoPrisma() as never, config as never)

      const document = await service.dpoSummary(itCoordinator, 'docx')

      expect(document.filename).toBe('dpo-summary.docx')
      expect(document.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(document.body[0]).toBe(0x50)
      expect(document.body[1]).toBe(0x4b)
      expect(document.body.length).toBeGreaterThan(500)
    })

    it('defaults the retention attestation to 30 days when the setting row is absent', async () => {
      const prisma = createDpoPrisma()
      const service = new DocsService(prisma as never, config as never)

      await service.dpoSummary(itCoordinator, 'pdf')

      const cutoff = prisma.attendanceRecord.count.mock.calls[0][0].where.timestamp.lt as Date
      expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000)
      expect(Date.now() - cutoff.getTime()).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000)
    })
  })

  describe('at-risk referral notice (F5, WF-LD7)', () => {
    const headOfCcIs: RequestUser = { id: 'head-ccis', role: 'teacher', department: 'CCIS', isDepartmentHead: true }
    const plainFaculty: RequestUser = { id: 'teacher-2', role: 'teacher' }
    const student: RequestUser = { id: 'student-1', role: 'student' }

    const noticeReferral = {
      id: 'ref-1',
      studentId: 'stu-1',
      sectionId: 'sec-1',
      generatedById: 'teacher-1',
      status: 'generated',
      note: 'Two consecutive absences.',
      createdAt: new Date('2026-11-02T01:00:00.000Z'),
      updatedAt: new Date('2026-11-02T01:00:00.000Z'),
      student: { id: 'stu-1', studentId: '2023-0001', fullName: 'Juan Dela Cruz', program: 'BSIT' },
      section: {
        teacherId: 'teacher-1',
        section: 'BSIT 1-A',
        semester: '2026-2027 First Semester',
        subject: { name: 'Software Engineering', code: 'COMP 20043' },
        teacher: { fullName: 'Prof. Maria Santos', department: 'CCIS' },
      },
      generatedBy: { fullName: 'Prof. Maria Santos' },
    }

    function createNoticePrisma() {
      return {
        atRiskReferral: { findUnique: jest.fn().mockResolvedValue(noticeReferral) },
        section: {
          findUnique: jest.fn(),
          findFirst: jest.fn(async ({ where }: { where: { id: string; teacher: { department: string } } }) =>
            where.teacher.department === 'CCIS' ? { id: where.id } : null,
          ),
        },
        institutionSetting: {
          findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
            where.key === 'attendance_min_rate_percent'
              ? { value: '75' }
              : { value: 'Polytechnic University of the Philippines' },
          ),
        },
        attendanceRecord: {
          groupBy: jest.fn().mockResolvedValue([
            { status: 'present', _count: { _all: 15 } },
            { status: 'absent', _count: { _all: 5 } },
          ]),
          findMany: jest.fn().mockResolvedValue([
            {
              timestamp: new Date('2026-10-27T01:00:00.000Z'),
              notes: null,
              session: { date: '2026-10-27', startTime: '08:00' },
            },
            {
              timestamp: new Date('2026-10-20T01:00:00.000Z'),
              notes: null,
              session: { date: '2026-10-20', startTime: '08:00' },
            },
          ]),
        },
      }
    }

    it('probes the directive-mandated content pieces', () => {
      expect(AT_RISK_NOTICE_TITLE).toBe('NOTICE OF IMPENDING DROP')
      const citations = AT_RISK_NOTICE_CITATION_LINES.join(' ')
      expect(citations).toContain('CHED CMO No. 40')
      expect(citations).toContain('Article V, Section 21')
      expect(citations).toContain('PUP Student Handbook')
      expect(AT_RISK_NOTICE_ACTIONS).toEqual(['Guidance counseling', 'Chair consultation', 'Parental contact'])
      expect(AT_RISK_NOTICE_SIGNOFFS).toEqual(['Advisor', 'Guidance Counselor', 'Department Chairperson'])
      expect(noticeComputationLine(5, 20)).toBe(
        '5 unexcused absences of 20 sessions = 25% — at/below the 20% impending-drop threshold',
      )
      expect(noticeComputationLine(0, 20)).toBe(
        '0 unexcused absences of 20 sessions = 0% — at/below the 20% impending-drop threshold',
      )
    })

    it('builds the threshold-counting absence ledger sorted by session date', () => {
      const rows = buildNoticeLedgerRows([
        {
          timestamp: new Date('2026-10-27T01:00:00.000Z'),
          notes: null,
          session: { date: '2026-10-27', startTime: '10:00' },
        },
        {
          timestamp: new Date('2026-10-13T01:00:00.000Z'),
          notes: 'excuse rejected',
          session: { date: '2026-10-13', startTime: '08:00' },
        },
        { timestamp: new Date('2026-10-20T01:00:00.000Z'), notes: null, session: null },
      ])
      expect(rows).toEqual([
        { date: '2026-10-13', time: '08:00', status: 'absent' },
        { date: '2026-10-20', status: 'absent' },
        { date: '2026-10-27', time: '10:00', status: 'absent' },
      ])
    })

    it('renders the official PDF with the engine stats, ledger, and citation header', async () => {
      const prisma = createNoticePrisma()
      const service = new DocsService(prisma as never)

      const document = await service.atRiskNotice(teacherNoticeOwner(), 'ref-1', 'pdf')

      expect(document.filename).toBe('PUP-AtRiskNotice-2023-0001-BSIT-1-A.pdf')
      expect(document.contentType).toBe('application/pdf')
      expect(document.body.subarray(0, 4).toString()).toBe('%PDF')
      expect(document.body.length).toBeGreaterThan(1_000)
      const raw = document.body.toString('latin1')
      expect(raw).toContain('NOTICE OF IMPENDING DROP')
      // The absence ledger and classification reuse the deterministic engine.
      expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['status'], where: { sectionId: 'sec-1', studentId: 'stu-1' } }),
      )
      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sectionId: 'sec-1', studentId: 'stu-1', status: 'absent' },
        }),
      )
    })

    it('renders the DOCX twin', async () => {
      const service = new DocsService(createNoticePrisma() as never)

      const document = await service.atRiskNotice(teacherNoticeOwner(), 'ref-1', 'docx')

      expect(document.filename).toBe('PUP-AtRiskNotice-2023-0001-BSIT-1-A.docx')
      expect(document.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(document.body[0]).toBe(0x50)
      expect(document.body[1]).toBe(0x4b)
      expect(document.body.length).toBeGreaterThan(500)
    })

    function teacherNoticeOwner(): RequestUser {
      return { id: 'teacher-1', role: 'teacher' }
    }

    it('scopes like the referral read: owner/dept-head allowed, others rejected', async () => {
      const allowed = createNoticePrisma()
      const service = new DocsService(allowed as never)
      // The owning teacher and the department head of the section teacher pass.
      await expect(service.atRiskNotice(teacherNoticeOwner(), 'ref-1', 'pdf')).resolves.toBeTruthy()
      await expect(service.atRiskNotice(headOfCcIs, 'ref-1', 'pdf')).resolves.toBeTruthy()

      const denied = createNoticePrisma()
      const deniedService = new DocsService(denied as never)
      await expect(deniedService.atRiskNotice(plainFaculty, 'ref-1', 'pdf')).rejects.toBeInstanceOf(ForbiddenException)
      await expect(deniedService.atRiskNotice(student, 'ref-1', 'pdf')).rejects.toBeInstanceOf(ForbiddenException)

      // A department-scoped super admin outside the department is rejected.
      const scopedAdmin: RequestUser = { id: 'admin-2', role: 'super_admin', scope: 'department', department: 'COE' }
      await expect(deniedService.atRiskNotice(scopedAdmin, 'ref-1', 'pdf')).rejects.toBeInstanceOf(ForbiddenException)
      expect(denied.section.findFirst).toHaveBeenCalledWith({
        where: { id: 'sec-1', teacher: { department: 'COE' } },
        select: { id: true },
      })
    })

    it('throws NotFound for an unknown referral', async () => {
      const prisma = createNoticePrisma()
      prisma.atRiskReferral.findUnique.mockResolvedValue(null)
      const service = new DocsService(prisma as never)

      await expect(service.atRiskNotice(teacherNoticeOwner(), 'ref-missing', 'pdf')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })
})
