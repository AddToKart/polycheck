import { ConflictException, ForbiddenException } from '@nestjs/common'
import { EnrollmentImportService } from './enrollment-import.service'
import type { EnrollImportRequestDto } from './dto/import-enrollments.dto'
import type { RequestUser } from '../auth/authenticated-principal'

const teacher: RequestUser = { id: 'teacher-1', role: 'teacher', department: 'CCIS' }

interface FakeStudent {
  id: string
  studentId: string | null
  fullName: string
  program: string | null
  yearLevel: number | null
  role: string
  isActive: boolean
  department: string | null
  mustChangePassword?: boolean
  password?: string
}

function createFakePrisma(options: { teacherDepartment?: string | null; students?: FakeStudent[] } = {}) {
  const section: any = {
    id: 'section-1',
    teacherId: 'teacher-1',
    studentCount: 0,
    teacher: { department: options.teacherDepartment === undefined ? 'CCIS' : options.teacherDepartment },
  }
  const students = new Map<string, FakeStudent>((options.students ?? []).map((student) => [student.id, student]))
  const enrollments: Array<{ studentId: string; sectionId: string }> = []
  const authAccounts: Array<Record<string, unknown>> = []
  const provisionAudits: Array<Record<string, unknown>> = []
  const audits: Array<Record<string, unknown>> = []
  const batches: Array<Record<string, unknown>> = []

  const db: any = {
    section: {
      findUnique: jest.fn(async () => section),
      update: jest.fn(async ({ data }: any) => {
        section.studentCount = data.studentCount
        return section
      }),
    },
    user: {
      findMany: jest.fn(async ({ where }: any) =>
        [...students.values()].filter(
          (student) => student.studentId && where?.studentId?.in?.includes(student.studentId),
        ),
      ),
      create: jest.fn(async ({ data }: any) => {
        const student: FakeStudent = { ...data, isActive: data.isActive ?? true }
        students.set(student.id, student)
        return student
      }),
    },
    enrollment: {
      findMany: jest.fn(async ({ where }: any) =>
        enrollments.filter((enrollment) => enrollment.sectionId === where.sectionId),
      ),
      createMany: jest.fn(async ({ data }: any) => {
        let count = 0
        for (const entry of data) {
          if (enrollments.some((item) => item.studentId === entry.studentId && item.sectionId === entry.sectionId)) {
            continue
          }
          enrollments.push(entry)
          count += 1
        }
        return { count }
      }),
      count: jest.fn(
        async ({ where }: any) => enrollments.filter((enrollment) => enrollment.sectionId === where.sectionId).length,
      ),
    },
    authAccount: {
      createMany: jest.fn(async ({ data }: any) => {
        authAccounts.push(...data)
        return { count: data.length }
      }),
    },
    auditLog: {
      createMany: jest.fn(async ({ data }: any) => {
        provisionAudits.push(...data)
        return { count: data.length }
      }),
      create: jest.fn(async ({ data }: any) => {
        audits.push(data)
        return data
      }),
    },
    importBatch: {
      create: jest.fn(async ({ data }: any) => {
        const batch = { id: `batch-${batches.length + 1}`, ...data }
        batches.push(batch)
        return { id: batch.id }
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    $executeRaw: jest.fn(async () => 0),
    $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(db)),
  }

  return { db, section, students, enrollments, authAccounts, provisionAudits, audits, batches }
}

function enrollRequest(
  rows: EnrollImportRequestDto['rows'],
  overrides: Partial<EnrollImportRequestDto> = {},
): EnrollImportRequestDto {
  return { mode: 'validate', rows, ...overrides }
}

function enrollRow(rowNumber: number, studentId: string, overrides: Record<string, unknown> = {}) {
  return { rowNumber, studentId, ...overrides } as EnrollImportRequestDto['rows'][number]
}

const activeStudent: FakeStudent = {
  id: 'user-1',
  studentId: '2024-00001-MN-0',
  fullName: 'Active Student',
  program: 'BSIT',
  yearLevel: 1,
  role: 'student',
  isActive: true,
  department: 'CCIS',
}

const enrolledStudent: FakeStudent = {
  ...activeStudent,
  id: 'user-2',
  studentId: '2024-00002-MN-0',
  fullName: 'Already Enrolled',
}

const inactiveStudent: FakeStudent = {
  ...activeStudent,
  id: 'user-3',
  studentId: '2024-00003-MN-0',
  fullName: 'Inactive Student',
  isActive: false,
}

describe('EnrollmentImportService', () => {
  it('validates enrollable, skipped, inactive, and missing rows without writing', async () => {
    const { db, enrollments } = createFakePrisma({
      students: [activeStudent, enrolledStudent, inactiveStudent],
    })
    enrollments.push({ studentId: enrolledStudent.id, sectionId: 'section-1' })
    const settings = { getBoolean: jest.fn().mockResolvedValue(false) }
    const service = new EnrollmentImportService(db as never, settings as never)

    const result = await service.importEnrollments(
      'section-1',
      enrollRequest([
        enrollRow(2, '2024-00001-MN-0'),
        enrollRow(3, '2024-00002-MN-0'),
        enrollRow(4, '2024-00003-MN-0'),
        enrollRow(5, '2024-00004-MN-0'),
      ]),
      teacher,
    )

    expect(result.summary).toEqual({ total: 4, valid: 2, enrollable: 1, skip: 1, invalid: 2 })
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['ALREADY_ENROLLED', 'STUDENT_INACTIVE', 'STUDENT_NOT_FOUND']),
    )
    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.enrollment.createMany).not.toHaveBeenCalled()
  })

  it('warns on program/year mismatches without blocking enrollment', async () => {
    const { db } = createFakePrisma({ students: [activeStudent] })
    const service = new EnrollmentImportService(
      db as never,
      { getBoolean: jest.fn().mockResolvedValue(false) } as never,
    )

    const result = await service.importEnrollments(
      'section-1',
      enrollRequest([
        enrollRow(2, '2024-00001-MN-0', { expectedProgram: 'BS Computer Science', expectedYearLevel: 3 }),
      ]),
      teacher,
    )

    expect(result.summary).toMatchObject({ enrollable: 1, invalid: 0 })
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].code).toBe('PROGRAM_YEAR_MISMATCH')
    expect(result.issues[0].message).toContain('continue')
  })

  it('rejects imports into sections owned by another teacher', async () => {
    const { db } = createFakePrisma()
    const service = new EnrollmentImportService(
      db as never,
      { getBoolean: jest.fn().mockResolvedValue(false) } as never,
    )

    await expect(
      service.importEnrollments('section-1', enrollRequest([enrollRow(2, '2024-00001-MN-0')]), {
        id: 'teacher-2',
        role: 'teacher',
      }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('executes under a section advisory lock, reconciles studentCount, and never writes section roles', async () => {
    const { db, section } = createFakePrisma({ students: [activeStudent] })
    const service = new EnrollmentImportService(
      db as never,
      { getBoolean: jest.fn().mockResolvedValue(false) } as never,
    )
    const rows = [enrollRow(2, '2024-00001-MN-0')]
    const validation = await service.importEnrollments('section-1', enrollRequest(rows), teacher)

    const result = await service.importEnrollments(
      'section-1',
      enrollRequest(rows, { mode: 'execute', rowChecksum: validation.rowChecksum }),
      teacher,
    )

    expect(result.mode).toBe('execute')
    expect(result.summary).toMatchObject({ enrollable: 1, invalid: 0 })
    expect(db.$executeRaw).toHaveBeenCalledTimes(1)
    expect(db.enrollment.createMany).toHaveBeenCalledWith({
      data: [{ studentId: 'user-1', sectionId: 'section-1' }],
      skipDuplicates: true,
    })
    expect(db.section.update).toHaveBeenCalledWith({
      where: { id: 'section-1' },
      data: { studentCount: 1 },
    })
    expect(section.studentCount).toBe(1)
    expect(db).not.toHaveProperty('sectionRole')
  })

  it('is idempotent and keeps studentCount correct when a chunk is re-run', async () => {
    const { db, section } = createFakePrisma({ students: [activeStudent] })
    const service = new EnrollmentImportService(
      db as never,
      { getBoolean: jest.fn().mockResolvedValue(false) } as never,
    )
    const rows = [enrollRow(2, '2024-00001-MN-0')]
    const validation = await service.importEnrollments('section-1', enrollRequest(rows), teacher)
    const execute = enrollRequest(rows, { mode: 'execute', rowChecksum: validation.rowChecksum })

    await service.importEnrollments('section-1', execute, teacher)
    const rerun = await service.importEnrollments('section-1', execute, teacher)

    expect(rerun.summary).toMatchObject({ enrollable: 0, skip: 1 })
    expect(db.enrollment.createMany).toHaveBeenCalledTimes(1)
    expect(section.studentCount).toBe(1)
    expect(db.section.update).toHaveBeenLastCalledWith({
      where: { id: 'section-1' },
      data: { studentCount: 1 },
    })
  })

  it('aborts before writing when the execute checksum does not match', async () => {
    const { db } = createFakePrisma({ students: [activeStudent] })
    const service = new EnrollmentImportService(
      db as never,
      { getBoolean: jest.fn().mockResolvedValue(false) } as never,
    )

    await expect(
      service.importEnrollments(
        'section-1',
        enrollRequest([enrollRow(2, '2024-00001-MN-0')], { mode: 'execute', rowChecksum: 'a'.repeat(16) }),
        teacher,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('keeps v1 strict when teacher provisioning is disabled', async () => {
    const { db } = createFakePrisma()
    const service = new EnrollmentImportService(
      db as never,
      { getBoolean: jest.fn().mockResolvedValue(false) } as never,
    )

    const result = await service.importEnrollments(
      'section-1',
      enrollRequest([enrollRow(2, '2024-00005-MN-0', { studentName: 'Missing Student' })]),
      teacher,
    )

    expect(result.summary).toMatchObject({ enrollable: 0, invalid: 1 })
    expect(result.issues[0].code).toBe('STUDENT_NOT_FOUND')
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('provisions minimal inactive accounts only when the institution setting is enabled', async () => {
    const { db, students, authAccounts, provisionAudits, audits } = createFakePrisma()
    const service = new EnrollmentImportService(db as never, { getBoolean: jest.fn().mockResolvedValue(true) } as never)
    const rows = [
      enrollRow(2, '2024-00005-MN-0', {
        studentName: 'Provisioned Student',
        expectedProgram: 'BSIT',
        expectedYearLevel: 2,
      }),
    ]
    const validation = await service.importEnrollments('section-1', enrollRequest(rows), teacher)

    expect(validation.summary).toEqual({
      total: 1,
      valid: 1,
      enrollable: 0,
      skip: 0,
      invalid: 0,
      provisioning: 1,
    })
    expect(db.user.create).not.toHaveBeenCalled()

    const result = await service.importEnrollments(
      'section-1',
      enrollRequest(rows, { mode: 'execute', rowChecksum: validation.rowChecksum }),
      teacher,
    )

    expect(result.summary).toMatchObject({ enrollable: 0, provisioning: 1, invalid: 0 })
    expect(result).not.toHaveProperty('credentials')
    expect(db.user.create).toHaveBeenCalledTimes(1)
    const created = db.user.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      studentId: '2024-00005-MN-0',
      fullName: 'Provisioned Student',
      role: 'student',
      program: 'BSIT',
      yearLevel: 2,
      department: 'CCIS',
      isActive: false,
      mustChangePassword: true,
    })
    expect(authAccounts).toHaveLength(1)
    expect(students.get(created.id)?.password).toBeTruthy()
    expect(provisionAudits).toEqual([
      expect.objectContaining({
        action: 'bulk_provision',
        entityType: 'user',
        entityId: created.id,
        metadata: { studentId: '2024-00005-MN-0', sectionId: 'section-1' },
      }),
    ])
    expect(audits[0]).toMatchObject({ action: 'bulk_enrollment_import', entityType: 'section' })
  })

  it('does not provision when the section teacher has no department', async () => {
    const { db } = createFakePrisma({ teacherDepartment: null })
    const service = new EnrollmentImportService(db as never, { getBoolean: jest.fn().mockResolvedValue(true) } as never)

    const result = await service.importEnrollments(
      'section-1',
      enrollRequest([enrollRow(2, '2024-00005-MN-0', { studentName: 'Missing Student' })]),
      teacher,
    )

    expect(result.summary).toMatchObject({ enrollable: 0, invalid: 1 })
    expect(result.issues[0].message).toContain('no department configured')
    expect(db.user.create).not.toHaveBeenCalled()
  })
})
