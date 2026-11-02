import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { DocsService, MASTER_LIST_COLUMNS } from './docs.service'

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
})
