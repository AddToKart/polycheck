import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { EvidenceDocsService, PROOF_REPORT_PHOTO_LIMIT, philippineDateTime } from './evidence-docs.service'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher' }
const officer: RequestUser = { id: 'stu-1', role: 'student' }

// The smallest valid JPEG, so the PDF library can really embed it.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
)

function photo(id: string, sessionId: string, date: string, section = '4-2') {
  return {
    id,
    photoUrl: `/uploads/${id}.jpg`,
    uploadedAt: new Date(`${date}T01:02:03Z`),
    uploadedByStudentName: 'Sample Officer',
    description: null,
    session: { id: sessionId, date, startTime: '09:00', endTime: '10:30', room: 'Lab 1' },
    section: {
      id: `sec-${section}`,
      section,
      course: 'BSIT',
      semester: '1st Semester',
      teacher: { fullName: 'Sample Professor' },
      subject: { name: 'System Administration', code: 'INTE 403' },
    },
  }
}

function setup(photos: ReturnType<typeof photo>[] = [], allowed = [{ id: 'sec-4-2' }]) {
  const prisma = {
    section: { findMany: jest.fn().mockResolvedValue(allowed), count: jest.fn().mockResolvedValue(1) },
    proofOfClass: {
      count: jest.fn().mockResolvedValue(photos.length),
      findMany: jest.fn().mockResolvedValue(photos),
    },
    institutionSetting: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn().mockResolvedValue({ fullName: 'Sample Professor' }) },
    subject: { findUnique: jest.fn(), findFirst: jest.fn() },
    attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
  }
  const storage = { read: jest.fn().mockResolvedValue({ buffer: JPEG, contentType: 'image/jpeg' }) }
  return { service: new EvidenceDocsService(prisma as never, storage as never), prisma, storage }
}

describe('EvidenceDocsService', () => {
  it('stamps times in Philippine time', () => {
    expect(philippineDateTime(new Date('2026-11-27T16:02:13Z'))).toBe('Nov 28, 2026, 12:02:13 AM')
  })

  describe('class photo PDF', () => {
    it('builds a PDF named after the subject, section and dates, reading every photo', async () => {
      const photos = Array.from({ length: 9 }, (_, index) =>
        photo(`p${index}`, index < 5 ? 's1' : 's2', index < 5 ? '2026-11-02' : '2026-11-09'),
      )
      const { service, storage } = setup(photos)

      const document = await service.proofPhotos(teacher, { sectionId: 'sec-4-2' })

      expect(document.filename).toBe('class-photos-INTE-403-4-2-2026-11-02_2026-11-09.pdf')
      expect(document.contentType).toBe('application/pdf')
      expect(document.body.subarray(0, 5).toString()).toBe('%PDF-')
      expect(storage.read).toHaveBeenCalledTimes(9)
    })

    it('still produces the report when one stored file is missing', async () => {
      const { service, storage } = setup([photo('p1', 's1', '2026-11-02')])
      storage.read.mockRejectedValue(new NotFoundException())
      const document = await service.proofPhotos(teacher, { sessionId: 's1' })
      expect(document.body.length).toBeGreaterThan(500)
    })

    it('limits a teacher to their own sections', async () => {
      const { service, prisma } = setup([photo('p1', 's1', '2026-11-02')])
      await service.proofPhotos(teacher, { sectionId: 'sec-4-2', from: '2026-11-01', to: '2026-11-30' })
      expect(prisma.section.findMany.mock.calls[0][0].where).toEqual({
        AND: [{ id: 'sec-4-2' }, { teacherId: 'teacher-1' }],
      })
      expect(prisma.proofOfClass.count.mock.calls[0][0].where.AND).toContainEqual({
        session: { date: { gte: '2026-11-01', lte: '2026-11-30' } },
      })
    })

    it('lets a student in only as the QAC officer of that section', async () => {
      const { service, prisma } = setup([], [])
      await expect(service.proofPhotos(officer, { sectionId: 'sec-4-2' })).rejects.toThrow(ForbiddenException)
      expect(prisma.section.findMany.mock.calls[0][0].where.AND[1]).toEqual({
        sectionRoles: { some: { studentId: 'stu-1', role: 'qac' } },
        enrollments: { some: { studentId: 'stu-1' } },
        subject: { archivedAt: null },
      })
    })

    it('does not let a student compile a whole subject', async () => {
      const { service } = setup()
      await expect(service.proofPhotos(officer, { subjectId: 'subj-1' })).rejects.toThrow(ForbiddenException)
    })

    it.each([[{}], [{ sessionId: 'a', sectionId: 'b' }], [{ sectionId: 'a', from: '2026-11-30', to: '2026-11-01' }]])(
      'refuses an unclear request %j',
      async (scope) => {
        const { service } = setup()
        await expect(service.proofPhotos(teacher, scope)).rejects.toThrow(BadRequestException)
      },
    )

    it('says so when there are no photos, and asks to narrow a very large export', async () => {
      const { service, prisma } = setup()
      await expect(service.proofPhotos(teacher, { sectionId: 's' })).rejects.toThrow(NotFoundException)
      prisma.proofOfClass.count.mockResolvedValue(PROOF_REPORT_PHOTO_LIMIT + 1)
      await expect(service.proofPhotos(teacher, { sectionId: 's' })).rejects.toThrow(/shorter date range/)
    })
  })

  describe('subject attendance spreadsheet', () => {
    const record = (id: string, name: string, notes: string | null = null) => ({
      id,
      studentName: name,
      status: 'present',
      timestamp: new Date('2026-11-02T01:05:00Z'),
      manuallySet: false,
      excuseStatus: null,
      disputeReason: null,
      notes,
      student: { studentId: '2024-00001-MN-0' },
      session: { date: '2026-11-02', startTime: '09:00', endTime: '10:30', room: 'Lab 1', mode: 'in_person' },
      section: { section: '4-2', course: 'BSIT', semester: '1st', teacher: { fullName: 'Sample Professor' } },
    })

    it("exports the teacher's own sections, sorted, with formula-like text kept as text", async () => {
      const { service, prisma } = setup()
      prisma.subject.findUnique.mockResolvedValue({ id: 'subj-1', name: 'Sys Ad', code: 'INTE 403', createdById: 'x' })
      prisma.attendanceRecord.findMany.mockResolvedValue([
        record('r2', 'Zed Sample'),
        record('r1', 'Amy Sample', '=HYPERLINK("bad")'),
      ])

      const document = await service.subjectAttendance(teacher, 'subj-1')

      expect(document.filename).toBe('attendance-INTE-403-all-records.csv')
      const lines = document.body.toString('utf8').replace('\uFEFF', '').trim().split('\r\n')
      expect(lines).toHaveLength(3)
      expect(lines[1]).toContain('Amy Sample')
      expect(lines[1]).toContain('"\'=HYPERLINK(""bad"")"')
      expect(lines[2]).toContain('Zed Sample')
      expect(prisma.attendanceRecord.findMany.mock.calls[0][0].where).toEqual({
        section: { subjectId: 'subj-1', teacherId: 'teacher-1' },
      })
    })

    it('hides a subject the teacher neither created nor teaches', async () => {
      const { service, prisma } = setup()
      prisma.subject.findUnique.mockResolvedValue({ id: 'subj-1', name: 'n', code: 'c', createdById: 'someone' })
      prisma.section.count.mockResolvedValue(0)
      await expect(service.subjectAttendance(teacher, 'subj-1')).rejects.toThrow(NotFoundException)
    })

    it('refuses students', async () => {
      const { service, prisma } = setup()
      prisma.subject.findUnique.mockResolvedValue({ id: 'subj-1', name: 'n', code: 'c', createdById: 'x' })
      await expect(service.subjectAttendance(officer, 'subj-1')).rejects.toThrow(ForbiddenException)
    })
  })
})
