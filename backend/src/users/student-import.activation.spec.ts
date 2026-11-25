import { BadRequestException, ConflictException } from '@nestjs/common'
import { AccountActivationService, ACCOUNT_MAIL_QUEUED_EVENT } from '../account-activation/account-activation.service'
import { StudentImportService } from './student-import.service'
import type { StudentImportRequestDto } from './dto/import-students.dto'
import type { RequestUser } from '../auth/authenticated-principal'

const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const campusRegistrar: RequestUser = { id: 'reg-1', role: 'teacher', isUserRegistrar: true, managesAllCourses: true }

interface StoredUser {
  id: string
  studentId: string | null
  email: string | null
  activationPending?: boolean
  mustChangePassword?: boolean
  [key: string]: unknown
}

function createFake(seed: StoredUser[] = []) {
  const users = new Map(seed.map((user) => [user.id, user]))
  const mails: Array<Record<string, unknown>> = []
  const batches: Array<Record<string, unknown>> = []

  const db: any = {
    user: {
      findMany: jest.fn(async ({ where }: any) => {
        const all = [...users.values()]
        if (where?.email?.in) {
          return all
            .filter((u) => u.email && where.email.in.includes(u.email))
            .map(({ id, studentId, email }) => ({ id, studentId, email }))
        }
        if (where?.studentId?.in) return all.filter((u) => u.studentId && where.studentId.in.includes(u.studentId))
        return []
      }),
      create: jest.fn(async ({ data }: any) => {
        users.set(data.id, { ...data, email: data.email ?? null })
        return data
      }),
      update: jest.fn(),
    },
    authAccount: { createMany: jest.fn(async ({ data }: any) => ({ count: data.length })) },
    accountMail: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `mail-${mails.length + 1}`, ...data }
        mails.push(row)
        return { id: row.id }
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    importBatch: {
      create: jest.fn(async ({ data }: any) => {
        const batch = { id: `batch-${batches.length + 1}`, ...data }
        batches.push(batch)
        return { id: batch.id }
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    auditLog: { create: jest.fn(async ({ data }: any) => data) },
    $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(db)),
  }
  return { db, users, mails, batches }
}

function build(
  options: { enabled?: boolean; configured?: boolean; seed?: StoredUser[]; withActivation?: boolean } = {},
) {
  const fake = createFake(options.seed)
  const events = { emit: jest.fn() }
  const activation = new AccountActivationService(fake.db, undefined, undefined, events as never)
  const settings = { getBoolean: jest.fn().mockResolvedValue(options.enabled ?? true) }
  const mail = { status: jest.fn().mockReturnValue({ driver: 'resend', configured: options.configured ?? true }) }
  const service = new StudentImportService(
    fake.db,
    undefined,
    settings as never,
    options.withActivation === false ? undefined : activation,
    mail as never,
  )
  return { ...fake, service, events, settings, mail }
}

function request(
  rows: Array<Record<string, unknown>>,
  overrides: Partial<StudentImportRequestDto> = {},
): StudentImportRequestDto {
  return { mode: 'validate', conflictMode: 'skip_existing', rows, ...overrides } as StudentImportRequestDto
}

const row = (n: number, studentId: string, extra: Record<string, unknown> = {}) => ({
  rowNumber: n,
  fullName: `Student ${n}`,
  studentId,
  program: 'BSIT',
  yearLevel: 1,
  department: 'CCIS',
  ...extra,
})

async function execute(service: StudentImportService, rows: Array<Record<string, unknown>>, overrides = {}) {
  const validation = await service.importStudents(request(rows, overrides), institutionAdmin)
  return service.importStudents(
    request(rows, { ...overrides, mode: 'execute', rowChecksum: validation.rowChecksum }),
    institutionAdmin,
  )
}

describe('StudentImportService — activation_email delivery', () => {
  it('creates pending accounts and outbox rows for emailed rows, and temp passwords for the rest', async () => {
    const { service, users, mails, events, batches, db } = build()
    const rows = [
      row(2, '2024-00001-MN-0', { email: 'one@example.com' }),
      row(3, '2024-00002-MN-0'),
      row(4, '2024-00003-MN-0', { email: 'three@example.com' }),
    ]

    const result = await execute(service, rows, { deliveryMode: 'activation_email' })

    expect(result.activation).toEqual({ queued: 2, fallbackTemporary: 1 })
    // Only the no-email row gets a credential back; emailed rows never reveal one.
    expect(result.credentials?.map((credential) => credential.studentId)).toEqual(['2024-00002-MN-0'])

    const created = [...users.values()]
    const byId = (studentId: string) => created.find((user) => user.studentId === studentId)!
    expect(byId('2024-00001-MN-0')).toMatchObject({ activationPending: true, mustChangePassword: true })
    expect(byId('2024-00003-MN-0')).toMatchObject({ activationPending: true })
    expect(byId('2024-00002-MN-0')).toMatchObject({ activationPending: false, mustChangePassword: true })

    // The outbox rows are written inside the import transaction, tagged with the batch afterwards,
    // and announced to the worker only after commit.
    expect(mails.map((mail) => ({ kind: mail.kind, status: mail.status }))).toEqual([
      { kind: 'activation', status: 'queued' },
      { kind: 'activation', status: 'queued' },
    ])
    expect(batches).toHaveLength(1)
    expect(db.accountMail.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['mail-1', 'mail-2'] } },
      data: { batchId: 'batch-1' },
    })
    expect(events.emit).toHaveBeenCalledTimes(2)
    expect(events.emit).toHaveBeenCalledWith(ACCOUNT_MAIL_QUEUED_EVENT, { id: 'mail-1' })
  })

  it('stores a random password hash for pending accounts (never the revealed one)', async () => {
    const { service, users } = build()
    await execute(service, [row(2, '2024-00001-MN-0', { email: 'one@example.com' })], {
      deliveryMode: 'activation_email',
    })
    const account = [...users.values()][0]
    expect(String(account.password)).toMatch(/^\$2[aby]\$/)
  })

  it('records the delivery mode on the import batch summary without any row data', async () => {
    const { service, batches } = build()
    await execute(service, [row(2, '2024-00001-MN-0', { email: 'one@example.com' })], {
      deliveryMode: 'activation_email',
    })
    expect((batches[0].summary as Record<string, unknown>).deliveryMode).toBe('activation_email')
    expect(JSON.stringify(batches[0])).not.toContain('one@example.com')
  })

  it('leaves omitted and temporary_password requests exactly as before (no outbox, no flags, no activation block)', async () => {
    for (const overrides of [{}, { deliveryMode: 'temporary_password' as const }]) {
      const { service, users, mails } = build()
      const result = await execute(service, [row(2, '2024-00001-MN-0', { email: 'one@example.com' })], overrides)
      expect(result.activation).toBeUndefined()
      expect(result.credentials).toHaveLength(1)
      expect([...users.values()][0]).toMatchObject({ activationPending: false, mustChangePassword: true })
      expect(mails).toHaveLength(0)
    }
  })

  it('binds the delivery mode into the checksum so execute cannot switch modes after validate', async () => {
    const { service } = build()
    const rows = [row(2, '2024-00001-MN-0', { email: 'one@example.com' })]
    const temporary = await service.importStudents(request(rows), institutionAdmin)
    const activation = await service.importStudents(
      request(rows, { deliveryMode: 'activation_email' }),
      institutionAdmin,
    )
    expect(activation.rowChecksum).not.toBe(temporary.rowChecksum)
    expect(temporary.rowChecksum).toBe(
      (await service.importStudents(request(rows, { deliveryMode: 'temporary_password' }), institutionAdmin))
        .rowChecksum,
    )

    await expect(
      service.importStudents(
        request(rows, { mode: 'execute', deliveryMode: 'activation_email', rowChecksum: temporary.rowChecksum }),
        institutionAdmin,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it.each([
    ['the setting is off', { enabled: false }],
    ['no mail provider is configured', { configured: false }],
    ['the activation service is missing', { withActivation: false }],
  ])('refuses the mode up front (validate and execute) when %s', async (_label, options) => {
    const { service, db } = build(options)
    const rows = [row(2, '2024-00001-MN-0', { email: 'one@example.com' })]
    for (const mode of ['validate', 'execute'] as const) {
      const error = (await service
        .importStudents(
          request(rows, { mode, deliveryMode: 'activation_email', rowChecksum: '0'.repeat(16) }),
          institutionAdmin,
        )
        .catch((caught: unknown) => caught)) as BadRequestException
      expect(error).toBeInstanceOf(BadRequestException)
      expect(error.getResponse()).toMatchObject({ code: 'activation_email_unavailable' })
    }
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('never touches existing accounts: updates and skips behave as today and queue no mail', async () => {
    const { service, mails, users } = build({
      seed: [{ id: 'old-1', studentId: '2024-00001-MN-0', email: 'old@example.com', activationPending: false }],
    })
    const result = await execute(service, [row(2, '2024-00001-MN-0', { email: 'old@example.com' })], {
      deliveryMode: 'activation_email',
    })
    expect(result.summary).toMatchObject({ new: 0, skip: 1 })
    expect(result.activation).toEqual({ queued: 0, fallbackTemporary: 0 })
    expect(mails).toHaveLength(0)
    expect(users.get('old-1')?.activationPending).toBe(false)
  })

  it('keeps registrar scope: a course-pinned registrar still only imports their own courses', async () => {
    const original = process.env.COURSE_SCOPE_MODE
    process.env.COURSE_SCOPE_MODE = 'course'
    try {
      const { service } = build()
      const result = await service.importStudents(
        request([row(2, '2024-00001-MN-0', { email: 'one@example.com', program: 'BSHM', department: undefined })], {
          deliveryMode: 'activation_email',
        }),
        { id: 'reg-2', role: 'teacher', isUserRegistrar: true, managedCourses: ['BSIT'] },
      )
      expect(result.summary).toMatchObject({ new: 0, invalid: 1 })
      const campus = await service.importStudents(
        request([row(2, '2024-00001-MN-0', { email: 'one@example.com', program: 'BSHM', department: undefined })], {
          deliveryMode: 'activation_email',
        }),
        campusRegistrar,
      )
      expect(campus.summary).toMatchObject({ new: 1, invalid: 0 })
    } finally {
      if (original === undefined) delete process.env.COURSE_SCOPE_MODE
      else process.env.COURSE_SCOPE_MODE = original
    }
  })
})
