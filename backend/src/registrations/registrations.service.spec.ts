import { compare } from '@node-rs/bcrypt'
import type { RequestUser } from '../auth/authenticated-principal'
import { PER_ADDRESS_PER_HOUR, PER_PERSON_PER_HOUR, RegistrationsService } from './registrations.service'

const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const student = {
  role: 'student' as const,
  fullName: '  Test   Student ',
  email: 'Test.Student@Example.edu.ph',
  password: 'Sup3r-Secret-Pass!',
  studentId: '2026-00001-mn-0',
  program: 'BSIT',
  yearLevel: 2,
  consent: true,
}
const teacher = {
  role: 'teacher' as const,
  fullName: 'Test Teacher',
  email: 'teacher@example.edu.ph',
  password: 'Sup3r-Secret-Pass!',
  consent: true,
}

const request = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  role: 'student',
  fullName: 'Test Student',
  email: 'test.student@example.edu.ph',
  studentId: '2026-00001-MN-0',
  program: 'BSIT',
  yearLevel: 2,
  passwordHash: 'stored-hash',
  status: 'pending',
  createdAt: new Date('2026-11-27T01:00:00Z'),
  reviewedAt: null,
  ...overrides,
})

describe('RegistrationsService', () => {
  let prisma: any
  let tx: any
  let redis: any
  let settings: any
  let service: RegistrationsService

  beforeEach(() => {
    tx = {
      registrationRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'new' }) },
    }
    prisma = {
      registrationRequest: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
    }
    redis = { consumeRateLimit: jest.fn().mockResolvedValue(true) }
    settings = { getBoolean: jest.fn().mockResolvedValue(true) }
    service = new RegistrationsService(prisma, redis, settings, { getOrThrow: () => 'v1' } as never)
  })

  const stored = () => prisma.registrationRequest.create.mock.calls[0][0].data

  describe('signing up', () => {
    it('is closed unless a super admin opens it', async () => {
      settings.getBoolean.mockResolvedValue(false)

      await expect(service.submit(student, '1.2.3.4')).rejects.toThrow('closed')
      expect(settings.getBoolean).toHaveBeenCalledWith('registration_enabled', false)
      expect(prisma.registrationRequest.create).not.toHaveBeenCalled()
    })

    it('stores a request, never an account, with the password hashed', async () => {
      await expect(service.submit(student, '1.2.3.4')).resolves.toEqual({ received: true })

      expect(stored()).toEqual(
        expect.objectContaining({
          role: 'student',
          fullName: 'Test Student',
          email: 'test.student@example.edu.ph',
          studentId: '2026-00001-MN-0',
          program: 'BSIT',
          yearLevel: 2,
        }),
      )
      expect(stored().passwordHash).not.toContain(student.password)
      await expect(compare(student.password, stored().passwordHash)).resolves.toBe(true)
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('does not look for existing accounts, so the reply cannot reveal them', async () => {
      await service.submit(student, '1.2.3.4')
      expect(prisma.user.findMany).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('keeps no student fields for a teacher', async () => {
      await service.submit({ ...teacher, studentId: '2026-00001-MN-0', program: 'BSIT', yearLevel: 1 }, '1.2.3.4')
      expect(stored()).toEqual(expect.objectContaining({ role: 'teacher', studentId: null, program: null }))
    })

    it.each([
      ['a weak password', { password: 'password1234' }, 'at least 12 characters'],
      ['no consent', { consent: false }, 'Privacy Policy'],
      ['a bad student number', { studentId: '12345' }, 'student number'],
      ['an unknown program', { program: 'BSXYZ' }, 'program'],
      ['no year level', { yearLevel: undefined }, 'year level'],
    ])('refuses %s', async (_case, change, message) => {
      await expect(service.submit({ ...student, ...change }, '1.2.3.4')).rejects.toThrow(message)
      expect(prisma.registrationRequest.create).not.toHaveBeenCalled()
    })

    it('silently drops a bot that fills the hidden field', async () => {
      await expect(service.submit({ ...student, website: 'http://spam' }, '1.2.3.4')).resolves.toEqual({
        received: true,
      })
      expect(prisma.registrationRequest.create).not.toHaveBeenCalled()
    })

    it('lets a whole class share one address but limits each person', async () => {
      expect(PER_ADDRESS_PER_HOUR).toBeGreaterThanOrEqual(300)
      expect(PER_PERSON_PER_HOUR).toBeLessThanOrEqual(10)

      await service.submit(student, '1.2.3.4')

      const keys: string[] = redis.consumeRateLimit.mock.calls.map((call: unknown[]) => call[0])
      expect(keys[0]).toBe('register:ip:1.2.3.4')
      // No personal data in the limiter's keys.
      expect(keys.join()).not.toContain('2026-00001')
      expect(keys.join()).not.toContain('@')
    })

    it('stops when the limit is reached', async () => {
      redis.consumeRateLimit.mockResolvedValue(false)
      await expect(service.submit(student, '1.2.3.4')).rejects.toThrow('Too many')
    })

    it('stops when too many requests are waiting', async () => {
      prisma.registrationRequest.count.mockResolvedValue(1000)
      await expect(service.submit(student, '1.2.3.4')).rejects.toThrow('full')
    })

    it('keeps only a few waiting requests for one person', async () => {
      prisma.registrationRequest.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3)
      await expect(service.submit(student, '1.2.3.4')).resolves.toEqual({ received: true })
      expect(prisma.registrationRequest.create).not.toHaveBeenCalled()
    })
  })

  describe('reviewing', () => {
    it.each<[string, RequestUser]>([
      ['a department administrator', { id: 'a', role: 'super_admin', scope: 'department' }],
      ['a professor', { id: 't', role: 'teacher' }],
    ])('is refused to %s', async (_case, actor) => {
      await expect(service.list(actor, 'pending')).rejects.toThrow('institution administrators')
      await expect(service.approve(actor, ['req-1'])).rejects.toThrow('institution administrators')
      await expect(service.reject(actor, ['req-1'])).rejects.toThrow('institution administrators')
    })

    it('flags taken and repeated requests, and never returns the password hash', async () => {
      prisma.registrationRequest.findMany.mockResolvedValue([
        request(),
        request({ id: 'req-2', email: 'other@example.edu.ph' }),
        request({ id: 'req-3', studentId: '2026-00009-MN-0', email: 'taken@example.edu.ph' }),
      ])
      prisma.user.findMany.mockResolvedValue([{ email: 'taken@example.edu.ph', studentId: null }])

      const result = await service.list(admin, 'pending')

      expect(result.items.map((item) => item.issues)).toEqual([
        ['duplicate_request'],
        ['duplicate_request'],
        ['account_exists'],
      ])
      expect(JSON.stringify(result)).not.toContain('stored-hash')
    })

    it('creates the account with the chosen password and clears the stored hash', async () => {
      prisma.registrationRequest.findMany.mockResolvedValue([request()])

      await expect(service.approve(admin, ['req-1'])).resolves.toEqual({ approved: 1, failed: [] })

      expect(tx.registrationRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', status: 'pending' },
        data: expect.objectContaining({ status: 'approved', passwordHash: null, reviewedBy: 'admin-1' }),
      })
      const data = tx.user.create.mock.calls[0][0].data
      expect(data).toEqual(
        expect.objectContaining({ role: 'student', password: 'stored-hash', department: 'BSIT', yearLevel: 2 }),
      )
      expect(data.authAccounts.create).toEqual(
        expect.objectContaining({ providerId: 'credential', password: 'stored-hash' }),
      )
      expect(data.mustChangePassword).toBeUndefined()
    })

    it('reports a taken student number and still approves the others', async () => {
      prisma.registrationRequest.findMany.mockResolvedValue([request(), request({ id: 'req-2' })])
      tx.user.findFirst.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null)

      const result = await service.approve(admin, ['req-1', 'req-2'])

      expect(result.approved).toBe(1)
      expect(result.failed).toEqual([
        expect.objectContaining({ id: 'req-1', reason: expect.stringContaining('already exists') }),
      ])
      expect(tx.user.create).toHaveBeenCalledTimes(1)
    })

    it('does not create a second account when someone else decided first', async () => {
      prisma.registrationRequest.findMany.mockResolvedValue([request()])
      tx.registrationRequest.updateMany.mockResolvedValue({ count: 0 })

      await expect(service.approve(admin, ['req-1'])).resolves.toEqual(expect.objectContaining({ approved: 0 }))
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('approves teachers one at a time', async () => {
      prisma.registrationRequest.findMany.mockResolvedValue([
        request(),
        request({ id: 'req-2', role: 'teacher', studentId: null }),
      ])

      await expect(service.approve(admin, ['req-1', 'req-2'])).rejects.toThrow('one at a time')
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('deletes a rejected request', async () => {
      await expect(service.reject(admin, ['req-1'])).resolves.toEqual({ rejected: 1 })
      expect(prisma.registrationRequest.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['req-1'] }, status: 'pending' },
      })
    })
  })
})
