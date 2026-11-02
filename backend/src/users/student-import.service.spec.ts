import { ConflictException, ForbiddenException } from '@nestjs/common'
import { compare } from 'bcryptjs'
import { computeRowChecksum } from '@polycheck/shared'
import { StudentImportService } from './student-import.service'
import type { StudentImportRequestDto } from './dto/import-students.dto'
import type { RequestUser } from '../auth/authenticated-principal'

const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const departmentAdmin: RequestUser = {
  id: 'admin-2',
  role: 'super_admin',
  scope: 'department',
  department: 'CCIS',
}

interface FakeUser {
  id: string
  studentId: string | null
  fullName: string
  email: string | null
  program: string | null
  yearLevel: number | null
  department: string | null
  role: string
  isActive: boolean
  mustChangePassword?: boolean
  password?: string
  authEmail?: string
}

function createFakePrisma(seed: FakeUser[] = []) {
  const users = new Map(seed.map((user) => [user.id, user]))
  const batches: Array<Record<string, unknown>> = []
  const audits: Array<Record<string, unknown>> = []
  const authAccounts: Array<Record<string, unknown>> = []

  const db: any = {
    user: {
      findMany: jest.fn(async ({ where }: any) => {
        const all = [...users.values()]
        if (where?.email?.in) {
          return all
            .filter((user) => user.email && where.email.in.includes(user.email))
            .map(({ id, studentId, email }) => ({ id, studentId, email }))
        }
        if (where?.studentId?.in) {
          return all.filter((user) => user.studentId && where.studentId.in.includes(user.studentId))
        }
        return []
      }),
      create: jest.fn(async ({ data }: any) => {
        const user: FakeUser = {
          ...data,
          email: data.email ?? null,
          program: data.program ?? null,
          yearLevel: data.yearLevel ?? null,
          department: data.department ?? null,
          isActive: data.isActive ?? true,
        }
        users.set(user.id, user)
        return user
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = users.get(where.id)
        if (!user) throw new Error('missing user')
        Object.assign(user, data)
        return user
      }),
    },
    authAccount: {
      createMany: jest.fn(async ({ data }: any) => {
        authAccounts.push(...data)
        return { count: data.length }
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
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        audits.push(data)
        return data
      }),
    },
    $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(db)),
  }

  return { db, users, batches, audits, authAccounts }
}

function importRequest(
  rows: StudentImportRequestDto['rows'],
  overrides: Partial<StudentImportRequestDto> = {},
): StudentImportRequestDto {
  return {
    mode: 'validate',
    conflictMode: 'skip_existing',
    rows,
    ...overrides,
  }
}

function studentRow(rowNumber: number, studentId: string, overrides: Record<string, unknown> = {}) {
  return {
    rowNumber,
    fullName: `Student ${rowNumber}`,
    studentId,
    program: 'BSIT',
    yearLevel: 1,
    department: 'CCIS',
    ...overrides,
  } as StudentImportRequestDto['rows'][number]
}

describe('StudentImportService', () => {
  it('validates a clean master list without writing anything', async () => {
    const { db } = createFakePrisma()
    const service = new StudentImportService(db as never)

    const result = await service.importStudents(
      importRequest([studentRow(2, '2024-00001-MN-0'), studentRow(3, '2024-00002-MN-0')]),
      institutionAdmin,
    )

    expect(result.mode).toBe('validate')
    expect(result.summary).toEqual({ total: 2, valid: 2, new: 2, update: 0, skip: 0, invalid: 0 })
    expect(result.rowChecksum).toMatch(/^[a-f0-9]{16}$/)
    expect(result.rowChecksum).toBe(
      computeRowChecksum([
        {
          rowNumber: 2,
          fullName: 'Student 2',
          studentId: '2024-00001-MN-0',
          program: 'BSIT',
          yearLevel: 1,
          department: 'CCIS',
        },
        {
          rowNumber: 3,
          fullName: 'Student 3',
          studentId: '2024-00002-MN-0',
          program: 'BSIT',
          yearLevel: 1,
          department: 'CCIS',
        },
      ]),
    )
    expect(result.issues).toEqual([])
    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.importBatch.create).not.toHaveBeenCalled()
  })

  it('aborts execute before writing when the checksum does not match the rows', async () => {
    const { db } = createFakePrisma()
    const service = new StudentImportService(db as never)
    const request = importRequest([studentRow(2, '2024-00001-MN-0')], { mode: 'execute', rowChecksum: '0'.repeat(16) })

    await expect(service.importStudents(request, institutionAdmin)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'import_checksum_mismatch' }),
    })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('creates users and credential accounts atomically and returns credentials once', async () => {
    const { db, batches, audits, authAccounts } = createFakePrisma()
    const service = new StudentImportService(db as never)
    const rows = [studentRow(2, '2024-00001-MN-0'), studentRow(3, '2024-00002-MN-0')]
    const validation = await service.importStudents(importRequest(rows), institutionAdmin)
    const request = importRequest(rows, { mode: 'execute', rowChecksum: validation.rowChecksum })

    const result = await service.importStudents(request, institutionAdmin)

    expect(result.summary).toEqual({ total: 2, valid: 2, new: 2, update: 0, skip: 0, invalid: 0 })
    expect(result.credentials).toHaveLength(2)
    expect(authAccounts).toHaveLength(2)
    expect(db.user.create).toHaveBeenCalledTimes(2)
    const created = db.user.create.mock.calls[0][0].data
    expect(created.role).toBe('student')
    expect(created.mustChangePassword).toBe(true)
    expect(created.authEmail).toMatch(/^u-[0-9a-f-]+@auth\.polycheck\.invalid$/)
    expect(created.password).not.toBe(result.credentials![0].tempPassword)
    await expect(compare(result.credentials![0].tempPassword, created.password)).resolves.toBe(true)
    expect(result.credentials![0].tempPassword).toMatch(/[a-z]/)
    expect(result.credentials![0].tempPassword).toMatch(/[A-Z]/)
    expect(result.credentials![0].tempPassword).toMatch(/[0-9]/)
    expect(result.credentials![0].tempPassword).toMatch(/[^A-Za-z0-9]/)

    expect(batches).toHaveLength(1)
    expect(batches[0]).toMatchObject({
      kind: 'student_registration',
      actorId: 'admin-1',
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      failed: 0,
      rowChecksum: validation.rowChecksum,
    })
    expect(batches[0].summary).toEqual(expect.objectContaining({ new: 2, issueCodes: [] }))
    expect(audits[0]).toMatchObject({ action: 'bulk_import', entityType: 'import_batch' })

    const rerun = await service.importStudents(request, institutionAdmin)
    expect(rerun.summary).toMatchObject({ new: 0, skip: 2 })
    expect(rerun.credentials).toBeUndefined()
    expect(db.user.create).toHaveBeenCalledTimes(2)
  })

  it('previews and applies only allowed field updates', async () => {
    const { db, users } = createFakePrisma([
      {
        id: 'existing-1',
        studentId: '2024-00001-MN-0',
        fullName: 'Old Name',
        email: 'old@iskolar.pup.edu.ph',
        program: 'BSIT',
        yearLevel: 1,
        department: 'CCIS',
        role: 'student',
        isActive: true,
        password: 'keep-this',
      },
    ])
    const service = new StudentImportService(db as never)
    const rows = [
      studentRow(2, '2024-00001-MN-0', {
        fullName: 'New Name',
        program: 'BS Computer Science',
        yearLevel: 2,
        department: 'CCIS',
      }),
    ]
    const request = importRequest(rows, { conflictMode: 'update_existing' })

    const validation = await service.importStudents(request, institutionAdmin)
    expect(validation.summary).toMatchObject({ new: 0, update: 1, skip: 0, invalid: 0 })
    const preview = validation.issues.find((issue) => issue.code === 'FIELD_UPDATE_PREVIEW')
    expect(preview?.message).toBe('Updates: fullName, program, yearLevel')

    const executed = await service.importStudents(
      { ...request, mode: 'execute', rowChecksum: validation.rowChecksum },
      institutionAdmin,
    )
    expect(executed.summary).toMatchObject({ update: 1 })
    const updateData = db.user.update.mock.calls[0][0].data
    expect(updateData).toEqual({ fullName: 'New Name', program: 'BS Computer Science', yearLevel: 2 })
    expect(updateData).not.toHaveProperty('password')
    expect(updateData).not.toHaveProperty('role')
    expect(updateData).not.toHaveProperty('isActive')
    expect(updateData).not.toHaveProperty('studentId')
    expect(users.get('existing-1')?.password).toBe('keep-this')
  })

  it('flags email collisions with a different account and duplicates in the file', async () => {
    const { db } = createFakePrisma([
      {
        id: 'other-1',
        studentId: '2024-00999-MN-0',
        fullName: 'Other Student',
        email: 'shared@iskolar.pup.edu.ph',
        program: 'BSIT',
        yearLevel: 1,
        department: 'CCIS',
        role: 'student',
        isActive: true,
      },
    ])
    const service = new StudentImportService(db as never)

    const result = await service.importStudents(
      importRequest([
        studentRow(2, '2024-00001-MN-0', { email: 'shared@iskolar.pup.edu.ph' }),
        studentRow(3, '2024-00002-MN-0'),
        studentRow(4, '2024-00002-MN-0'),
      ]),
      institutionAdmin,
    )

    expect(result.summary).toMatchObject({ new: 1, invalid: 2 })
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['ACCOUNT_ALREADY_EXISTS', 'DUPLICATE_IN_FILE']),
    )
  })

  it('defaults a department admin row to their department and blocks mismatches', async () => {
    const { db } = createFakePrisma([
      {
        id: 'other-dept',
        studentId: '2024-00009-MN-0',
        fullName: 'Other Department',
        email: null,
        program: 'BSIT',
        yearLevel: 1,
        department: 'CAF',
        role: 'student',
        isActive: true,
      },
    ])
    const service = new StudentImportService(db as never)

    const result = await service.importStudents(
      importRequest([
        studentRow(2, '2024-00001-MN-0', { department: undefined }),
        studentRow(3, '2024-00002-MN-0', { department: 'CAF' }),
        studentRow(4, '2024-00009-MN-0', { department: 'CCIS' }),
      ]),
      departmentAdmin,
    )

    expect(result.summary).toMatchObject({ new: 1, invalid: 2 })
    expect(result.issues.filter((issue) => issue.code === 'DEPARTMENT_MISMATCH')).toHaveLength(2)

    const validation = await service.importStudents(
      importRequest([studentRow(2, '2024-00001-MN-0', { department: undefined })]),
      departmentAdmin,
    )
    await service.importStudents(
      {
        ...importRequest([studentRow(2, '2024-00001-MN-0', { department: undefined })]),
        mode: 'execute',
        rowChecksum: validation.rowChecksum,
      },
      departmentAdmin,
    )
    expect(db.user.create.mock.calls[0][0].data.department).toBe('CCIS')
  })

  it('rejects administrators without a department scope', async () => {
    const { db } = createFakePrisma()
    const service = new StudentImportService(db as never)

    await expect(
      service.importStudents(importRequest([studentRow(2, '2024-00001-MN-0')]), {
        id: 'admin-3',
        role: 'super_admin',
        scope: 'department',
        department: null,
      }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('does not persist anything when the chunk transaction fails', async () => {
    const { db } = createFakePrisma()
    db.$transaction.mockRejectedValue(new Error('chunk failed'))
    const service = new StudentImportService(db as never)
    const rows = [studentRow(2, '2024-00001-MN-0')]
    const validation = await service.importStudents(importRequest(rows), institutionAdmin)

    await expect(
      service.importStudents(
        importRequest(rows, { mode: 'execute', rowChecksum: validation.rowChecksum }),
        institutionAdmin,
      ),
    ).rejects.toThrow('chunk failed')

    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.importBatch.create).not.toHaveBeenCalled()
  })

  it('writes import batches and prunes batches older than 90 days', async () => {
    const { db } = createFakePrisma()
    const service = new StudentImportService(db as never)
    const rows = [studentRow(2, '2024-00001-MN-0')]
    const validation = await service.importStudents(importRequest(rows), institutionAdmin)

    await service.importStudents(
      importRequest(rows, { mode: 'execute', rowChecksum: validation.rowChecksum }),
      institutionAdmin,
    )

    expect(db.importBatch.create).toHaveBeenCalledTimes(1)
    expect(db.importBatch.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    })
    const cutoff = db.importBatch.deleteMany.mock.calls[0][0].where.createdAt.lt as Date
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(89 * 86_400_000)
    expect(Date.now() - cutoff.getTime()).toBeLessThan(91 * 86_400_000)
  })

  it('surfaces checksum conflict as a typed exception', async () => {
    const { db } = createFakePrisma()
    const service = new StudentImportService(db as never)

    expect(() =>
      service.assertChecksum(
        importRequest([studentRow(2, '2024-00001-MN-0')], { mode: 'execute', rowChecksum: 'f'.repeat(16) }),
        institutionAdmin,
      ),
    ).toThrow(ConflictException)
  })
})
