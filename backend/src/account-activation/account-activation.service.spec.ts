import { BadRequestException } from '@nestjs/common'
import { hash } from '@node-rs/bcrypt'
import {
  ACCOUNT_MAIL_QUEUED_EVENT,
  AccountActivationService,
  ActivationLinkInvalidError,
  ActivationRateLimitedError,
} from './account-activation.service'
import { generateActivationToken, hashActivationToken, looksLikeActivationToken } from './activation-token'

jest.mock('@node-rs/bcrypt', () => ({ hash: jest.fn(async () => '$2b$12$mockedhash') }))

const STUDENT_NUMBER = '2024-00001-MN-0'
const GOOD_PASSWORD = 'Sturdy-Pass#2026'

interface TokenRow {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  failedAttempts: number
  user: { id: string; studentId: string | null; role: string; isActive: boolean; activationPending: boolean }
}

function makeToken(overrides: Partial<TokenRow> = {}, userOverrides: Partial<TokenRow['user']> = {}): TokenRow {
  return {
    id: 'tok-1',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 3_600_000),
    usedAt: null,
    revokedAt: null,
    failedAttempts: 0,
    user: {
      id: 'u-1',
      studentId: STUDENT_NUMBER,
      role: 'student',
      isActive: true,
      activationPending: true,
      ...userOverrides,
    },
    ...overrides,
  }
}

function makeService(options: { row?: TokenRow | null; limits?: boolean[]; settingsTtl?: number } = {}) {
  const prisma: any = {
    accountActivationToken: {
      findUnique: jest.fn().mockResolvedValue(options.row === undefined ? makeToken() : options.row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ failedAttempts: 1, usedAt: null, revokedAt: null }),
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    authAccount: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    accountMail: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'mail-1' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
  }
  const limits = [...(options.limits ?? [])]
  const redis = { consumeRateLimit: jest.fn(async () => (limits.length > 0 ? limits.shift()! : true)) }
  const settings = { getInteger: jest.fn().mockResolvedValue(options.settingsTtl ?? 168) }
  const events = { emit: jest.fn() }
  const service = new AccountActivationService(prisma, redis as never, settings as never, events as never)
  return { service, prisma, redis, settings, events }
}

describe('activation token utilities', () => {
  it('generates url-safe 32-byte tokens and stores only the sha256 hash', () => {
    const first = generateActivationToken()
    const second = generateActivationToken()
    expect(first.raw).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.raw).not.toBe(second.raw)
    expect(first.hash).toBe(hashActivationToken(first.raw))
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.hash).not.toContain(first.raw)
    expect(looksLikeActivationToken(first.raw)).toBe(true)
    expect(looksLikeActivationToken('short')).toBe(false)
    expect(looksLikeActivationToken('has spaces and ###')).toBe(false)
  })
})

describe('AccountActivationService.validate', () => {
  const raw = generateActivationToken().raw

  it('accepts a live token for a pending student without consuming it', async () => {
    const { service, prisma } = makeService()
    const result = await service.validate(raw, '1.2.3.4')
    expect(result).toEqual({ valid: true, expiresAt: expect.any(String) })
    expect(prisma.accountActivationToken.updateMany).not.toHaveBeenCalled()
    expect(prisma.accountActivationToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashActivationToken(raw) } }),
    )
  })

  it.each([
    ['unknown', null],
    ['used', makeToken({ usedAt: new Date() })],
    ['revoked', makeToken({ revokedAt: new Date() })],
    ['expired', makeToken({ expiresAt: new Date(Date.now() - 1_000) })],
    ['owner already active', makeToken({}, { activationPending: false })],
    ['owner disabled', makeToken({}, { isActive: false })],
  ])('returns the same generic result for a %s token', async (_label, row) => {
    const { service } = makeService({ row })
    await expect(service.validate(raw)).resolves.toEqual({ valid: false })
  })

  it('never queries the database for a malformed token', async () => {
    const { service, prisma } = makeService()
    await expect(service.validate('x')).resolves.toEqual({ valid: false })
    expect(prisma.accountActivationToken.findUnique).not.toHaveBeenCalled()
  })

  it('is limited per IP and per token', async () => {
    const { service } = makeService({ limits: [false] })
    await expect(service.validate(raw, '1.2.3.4')).rejects.toBeInstanceOf(ActivationRateLimitedError)
    const second = makeService({ limits: [true, false] })
    await expect(second.service.validate(raw, '1.2.3.4')).rejects.toBeInstanceOf(ActivationRateLimitedError)
  })
})

describe('AccountActivationService.complete', () => {
  const raw = generateActivationToken().raw
  const input = { token: raw, studentId: STUDENT_NUMBER, password: GOOD_PASSWORD }

  it('sets the student-chosen password everywhere, clears the flags and consumes the token', async () => {
    const { service, prisma } = makeService()

    await expect(service.complete(input, '1.2.3.4')).resolves.toEqual({ ok: true })

    expect(hash).toHaveBeenCalledWith(GOOD_PASSWORD, { cost: 12 })
    expect(prisma.accountActivationToken.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'tok-1', usedAt: null, revokedAt: null }),
        data: { usedAt: expect.any(Date) },
      }),
    )
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1', activationPending: true, isActive: true },
      data: {
        password: '$2b$12$mockedhash',
        mustChangePassword: false,
        activationPending: false,
        authVersion: { increment: 1 },
      },
    })
    expect(prisma.authAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', providerId: 'credential' },
      data: { password: '$2b$12$mockedhash', updatedAt: expect.any(Date) },
    })
    // Every other live token for the account dies with the activation.
    expect(prisma.accountActivationToken.updateMany).toHaveBeenLastCalledWith({
      where: { userId: 'u-1', usedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
  })

  it('audits the completion without the token or password', async () => {
    const { service, prisma } = makeService()
    await service.complete(input)
    const audit = prisma.auditLog.create.mock.calls[0][0].data
    expect(audit).toMatchObject({ action: 'account.activation_completed', actorId: 'u-1', entityType: 'user' })
    expect(JSON.stringify(audit)).not.toContain(raw)
    expect(JSON.stringify(audit)).not.toContain(GOOD_PASSWORD)
  })

  it('succeeds even when the audit table is unavailable (fail-open)', async () => {
    const { service, prisma } = makeService()
    prisma.auditLog.create.mockRejectedValue(new Error('audit down'))
    await expect(service.complete(input)).resolves.toEqual({ ok: true })
  })

  it('accepts a differently spaced or cased student number', async () => {
    const { service } = makeService()
    await expect(service.complete({ ...input, studentId: '2024-00001-mn-0' })).resolves.toEqual({ ok: true })
  })

  it('rejects a wrong student number, counts the attempt and never hashes', async () => {
    const { service, prisma } = makeService()
    ;(hash as jest.Mock).mockClear()

    await expect(service.complete({ ...input, studentId: '2024-99999-MN-0' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'activation_student_number_mismatch' }),
    })

    expect(prisma.accountActivationToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tok-1' }, data: { failedAttempts: { increment: 1 } } }),
    )
    expect(hash).not.toHaveBeenCalled()
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('revokes the token on the fifth wrong attempt', async () => {
    const { service, prisma } = makeService()
    prisma.accountActivationToken.update.mockResolvedValue({ failedAttempts: 5, usedAt: null, revokedAt: null })

    await expect(service.complete({ ...input, studentId: '2024-99999-MN-0' })).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(prisma.accountActivationToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'tok-1', usedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('rejects a weak password before hashing', async () => {
    const { service, prisma } = makeService()
    ;(hash as jest.Mock).mockClear()
    await expect(service.complete({ ...input, password: 'short' })).rejects.toBeInstanceOf(BadRequestException)
    expect(hash).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown', null],
    ['revoked', makeToken({ revokedAt: new Date() })],
    ['expired', makeToken({ expiresAt: new Date(Date.now() - 1_000) })],
    ['owner no longer pending', makeToken({}, { activationPending: false })],
    ['owner disabled', makeToken({}, { isActive: false })],
    ['owner not a student', makeToken({}, { role: 'teacher' })],
  ])('answers a %s token with the uniform invalid-link error', async (_label, row) => {
    const { service, prisma } = makeService({ row })
    await expect(service.complete(input)).rejects.toBeInstanceOf(ActivationLinkInvalidError)
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('treats a replay of a used token as already activated and changes nothing', async () => {
    const { service, prisma } = makeService({ row: makeToken({ usedAt: new Date() }) })
    await expect(service.complete(input)).resolves.toEqual({ ok: true, alreadyActivated: true })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('reports a lost concurrent claim (double tap) as already activated', async () => {
    const { service, prisma } = makeService()
    prisma.accountActivationToken.updateMany.mockResolvedValueOnce({ count: 0 })
    prisma.accountActivationToken.findUnique
      .mockResolvedValueOnce(makeToken())
      .mockResolvedValueOnce({ usedAt: new Date(), revokedAt: null })

    await expect(service.complete(input)).resolves.toEqual({ ok: true, alreadyActivated: true })
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('is invalid when the lost claim was actually a revocation', async () => {
    const { service, prisma } = makeService()
    prisma.accountActivationToken.updateMany.mockResolvedValueOnce({ count: 0 })
    prisma.accountActivationToken.findUnique
      .mockResolvedValueOnce(makeToken())
      .mockResolvedValueOnce({ usedAt: null, revokedAt: new Date() })
    await expect(service.complete(input)).rejects.toBeInstanceOf(ActivationLinkInvalidError)
  })

  it('rejects malformed tokens without a lookup', async () => {
    const { service, prisma } = makeService()
    await expect(service.complete({ ...input, token: 'nope' })).rejects.toBeInstanceOf(ActivationLinkInvalidError)
    expect(prisma.accountActivationToken.findUnique).not.toHaveBeenCalled()
  })

  it('is rate limited per IP and per token before any lookup', async () => {
    const { service, prisma } = makeService({ limits: [false] })
    await expect(service.complete(input, '1.2.3.4')).rejects.toBeInstanceOf(ActivationRateLimitedError)
    expect(prisma.accountActivationToken.findUnique).not.toHaveBeenCalled()
  })
})

describe('AccountActivationService.requestLink', () => {
  const request = { studentId: STUDENT_NUMBER, email: 'Maria@Example.com' }
  const pendingUser = { id: 'u-1', email: 'maria@example.com' }

  it('queues mail for a pending account whose stored email matches (case-insensitive)', async () => {
    const { service, prisma, events } = makeService()
    prisma.user.findFirst.mockResolvedValue(pendingUser)

    await expect(service.requestLink(request, '1.2.3.4')).resolves.toEqual({ ok: true })

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: STUDENT_NUMBER, role: 'student', activationPending: true, isActive: true },
      }),
    )
    expect(prisma.accountMail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u-1', kind: 'activation', status: 'queued' }),
      }),
    )
    expect(events.emit).toHaveBeenCalledWith(ACCOUNT_MAIL_QUEUED_EVENT, { id: 'mail-1' })
  })

  it('answers identically and sends nothing for a wrong email, a missing or a non-pending account', async () => {
    for (const found of [{ id: 'u-1', email: 'other@example.com' }, { id: 'u-1', email: null }, null]) {
      const { service, prisma } = makeService()
      prisma.user.findFirst.mockResolvedValue(found)
      await expect(service.requestLink(request, '1.2.3.4')).resolves.toEqual({ ok: true })
      expect(prisma.accountMail.create).not.toHaveBeenCalled()
    }
  })

  it('normalizes the submitted student number', async () => {
    const { service, prisma } = makeService()
    await service.requestLink({ ...request, studentId: ' 2024-00001-mn-0 ' })
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ studentId: STUDENT_NUMBER }) }),
    )
  })

  it('silently drops requests inside the per-account cooldown or daily cap', async () => {
    for (const limits of [
      [true, false, true],
      [true, true, false],
    ]) {
      const { service, prisma } = makeService({ limits })
      prisma.user.findFirst.mockResolvedValue(pendingUser)
      await expect(service.requestLink(request, '1.2.3.4')).resolves.toEqual({ ok: true })
      expect(prisma.accountMail.create).not.toHaveBeenCalled()
    }
  })

  it('does not let a mistyped email burn the per-account cooldown', async () => {
    const { service, prisma, redis } = makeService()
    prisma.user.findFirst.mockResolvedValue({ id: 'u-1', email: 'other@example.com' })
    await service.requestLink(request, '1.2.3.4')
    // Only the per-IP counter was consumed; the account cooldown/daily caps were not touched.
    expect(redis.consumeRateLimit).toHaveBeenCalledTimes(1)
    expect(redis.consumeRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('activation:request:ip:'),
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('keys the per-account caps by the matched account', async () => {
    const { service, prisma, redis } = makeService()
    prisma.user.findFirst.mockResolvedValue(pendingUser)
    await service.requestLink(request, '1.2.3.4')
    const keys = (redis.consumeRateLimit.mock.calls as unknown as string[][]).map((call) => call[0])
    expect(keys).toEqual([
      'activation:request:ip:1.2.3.4',
      'activation:request:cooldown:u-1',
      'activation:request:daily:u-1',
    ])
  })

  it('rejects an abusive IP with a rate-limit error that reveals nothing about accounts', async () => {
    const { service, prisma } = makeService({ limits: [false] })
    await expect(service.requestLink(request, '1.2.3.4')).rejects.toBeInstanceOf(ActivationRateLimitedError)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })
})

describe('AccountActivationService token issuance and outbox', () => {
  it('mints a token for a pending student, revoking older live ones, with the configured lifetime', async () => {
    const { service, prisma } = makeService({ settingsTtl: 72 })
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'student', isActive: true, activationPending: true })

    const issued = await service.issueToken('u-1')

    expect(issued?.raw).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const ttlMs = issued!.expiresAt.getTime() - Date.now()
    expect(ttlMs).toBeGreaterThan(71 * 3_600_000)
    expect(ttlMs).toBeLessThanOrEqual(72 * 3_600_000)
    expect(prisma.accountActivationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', usedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    const stored = prisma.accountActivationToken.create.mock.calls[0][0].data
    expect(stored.tokenHash).toBe(hashActivationToken(issued!.raw))
    expect(JSON.stringify(stored)).not.toContain(issued!.raw)
  })

  it('issues nothing for accounts that are not pending students', async () => {
    for (const user of [
      null,
      { id: 'u-1', role: 'teacher', isActive: true, activationPending: true },
      { id: 'u-1', role: 'student', isActive: false, activationPending: true },
      { id: 'u-1', role: 'student', isActive: true, activationPending: false },
    ]) {
      const { service, prisma } = makeService()
      prisma.user.findUnique.mockResolvedValue(user)
      await expect(service.issueToken('u-1')).resolves.toBeNull()
      expect(prisma.accountActivationToken.create).not.toHaveBeenCalled()
    }
  })

  it('does not stack outbox rows while one is already in flight', async () => {
    const { service, prisma, events } = makeService()
    prisma.accountMail.findFirst.mockResolvedValue({ id: 'mail-existing' })
    await expect(service.queueActivationMail('u-1')).resolves.toEqual({ id: 'mail-existing', created: false })
    expect(prisma.accountMail.create).not.toHaveBeenCalled()
    expect(events.emit).not.toHaveBeenCalled()
  })

  it('does not announce rows created inside someone else’s transaction', async () => {
    const { service, prisma, events } = makeService()
    const tx = {
      accountMail: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'm-tx' }),
      },
    }
    await service.queueActivationMail('u-1', { db: tx as never, batchId: 'batch-1' })
    expect(tx.accountMail.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ batchId: 'batch-1' }) }),
    )
    expect(prisma.accountMail.create).not.toHaveBeenCalled()
    expect(events.emit).not.toHaveBeenCalled()
  })

  it('revokes every live token for an account', async () => {
    const { service, prisma } = makeService()
    prisma.accountActivationToken.updateMany.mockResolvedValue({ count: 2 })
    await expect(service.revokeAllForUser('u-1')).resolves.toBe(2)
  })
})
