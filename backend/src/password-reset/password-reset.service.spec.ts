import { BadRequestException } from '@nestjs/common'
import { ACCOUNT_MAIL_QUEUED_EVENT } from '../account-activation/account-activation.service'
import { generateActivationToken, hashActivationToken } from '../account-activation/activation-token'
import { isMailDeliverable } from '../mail/mail-config'
import {
  PASSWORD_RESET_MAIL_KIND,
  PasswordResetLinkInvalidError,
  PasswordResetRateLimitedError,
  PasswordResetService,
} from './password-reset.service'

jest.mock('@node-rs/bcrypt', () => ({ hash: jest.fn(async () => '$2b$12$mockedhash') }))

const STUDENT_NUMBER = '2024-00001-MN-0'
const GOOD_PASSWORD = 'Sturdy-Pass#2026'

interface TokenRow {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  user: { role: string; isActive: boolean; activationPending: boolean }
}

function makeToken(overrides: Partial<TokenRow> = {}, userOverrides: Partial<TokenRow['user']> = {}): TokenRow {
  return {
    id: 'tok-1',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 3_600_000),
    usedAt: null,
    revokedAt: null,
    user: { role: 'student', isActive: true, activationPending: false, ...userOverrides },
    ...overrides,
  }
}

function makeService(
  options: {
    row?: TokenRow | null
    user?: { id: string; contactEmail: string | null } | null
    limits?: boolean[]
    mailEnv?: Record<string, string>
    claimCount?: number
  } = {},
) {
  const prisma: any = {
    passwordResetToken: {
      findUnique: jest.fn().mockResolvedValue(options.row === undefined ? makeToken() : options.row),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(options.user ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    authAccount: { upsert: jest.fn().mockResolvedValue({}) },
    authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    accountMail: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'mail-1' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  }
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma))
  const limits = [...(options.limits ?? [])]
  const redis = { consumeRateLimit: jest.fn(async () => (limits.length ? (limits.shift() as boolean) : true)) }
  const events = { emit: jest.fn() }
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) }
  const env = options.mailEnv ?? { MAIL_DRIVER: 'log' }
  const config = { get: jest.fn((key: string) => env[key]) }
  const service = new PasswordResetService(
    prisma,
    redis as never,
    events as never,
    notifications as never,
    config as never,
  )
  return { service, prisma, redis, events, notifications }
}

describe('isMailDeliverable', () => {
  const read = (env: Record<string, string>) => (key: string) => env[key]
  it('is false for disabled/unset and for resend without key or sender', () => {
    expect(isMailDeliverable(read({}))).toBe(false)
    expect(isMailDeliverable(read({ MAIL_DRIVER: 'disabled' }))).toBe(false)
    expect(isMailDeliverable(read({ MAIL_DRIVER: 'resend', RESEND_API_KEY: 're_x' }))).toBe(false)
    expect(isMailDeliverable(read({ MAIL_DRIVER: 'resend', MAIL_FROM: 'a@b.c' }))).toBe(false)
  })
  it('is true for log and for fully configured resend', () => {
    expect(isMailDeliverable(read({ MAIL_DRIVER: 'log' }))).toBe(true)
    expect(isMailDeliverable(read({ MAIL_DRIVER: ' Resend ', RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.c' }))).toBe(true)
  })
})

describe('PasswordResetService.request', () => {
  it('queues a reset mail for a student with a bound email and answers "email"', async () => {
    const { service, prisma, events } = makeService({ user: { id: 'u-1', contactEmail: 'bound@example.com' } })
    expect(await service.request(STUDENT_NUMBER, '1.2.3.4')).toEqual({ ok: true, delivery: 'email' })
    expect(prisma.accountMail.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', kind: PASSWORD_RESET_MAIL_KIND, status: 'queued' },
      select: { id: true },
    })
    expect(events.emit).toHaveBeenCalledWith(ACCOUNT_MAIL_QUEUED_EVENT, { id: 'mail-1' })
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('account.password_reset_requested')
  })

  it('looks the student up only among active, activated students, using the normalized number', async () => {
    const { service, prisma } = makeService()
    await service.request(' 2024-00001-mn-0 ')
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { studentId: '2024-00001-MN-0', role: 'student', isActive: true, activationPending: false },
      select: { id: true, contactEmail: true },
    })
  })

  it('answers "unavailable" without queueing for an unknown number, no bound email, or a malformed one', async () => {
    for (const user of [
      null,
      { id: 'u-1', contactEmail: null },
      { id: 'u-1', contactEmail: '   ' },
      { id: 'u-1', contactEmail: 'nope' },
    ]) {
      const { service, prisma } = makeService({ user })
      expect(await service.request(STUDENT_NUMBER)).toEqual({ ok: true, delivery: 'unavailable' })
      expect(prisma.accountMail.create).not.toHaveBeenCalled()
    }
  })

  it('answers the same "unavailable" for an unknown number as for a student with nothing bound', async () => {
    const unknown = await makeService({ user: null }).service.request(STUDENT_NUMBER)
    const unbound = await makeService({ user: { id: 'u-1', contactEmail: null } }).service.request(STUDENT_NUMBER)
    expect(unknown).toEqual(unbound)
  })

  it('answers "unavailable" while mail is not configured, even with a bound email', async () => {
    const { service, prisma } = makeService({
      user: { id: 'u-1', contactEmail: 'bound@example.com' },
      mailEnv: { MAIL_DRIVER: 'disabled' },
    })
    expect(await service.request(STUDENT_NUMBER)).toEqual({ ok: true, delivery: 'unavailable' })
    expect(prisma.accountMail.create).not.toHaveBeenCalled()
  })

  it('answers "email" but sends nothing when the per-account cooldown or daily cap is hit', async () => {
    for (const limits of [
      [true, false, true],
      [true, true, false],
    ]) {
      const { service, prisma } = makeService({ user: { id: 'u-1', contactEmail: 'bound@example.com' }, limits })
      expect(await service.request(STUDENT_NUMBER, '1.2.3.4')).toEqual({ ok: true, delivery: 'email' })
      expect(prisma.accountMail.create).not.toHaveBeenCalled()
    }
  })

  it('rejects with a typed 429 when the per-IP budget is spent', async () => {
    const { service, prisma } = makeService({ limits: [false] })
    await expect(service.request(STUDENT_NUMBER, '1.2.3.4')).rejects.toBeInstanceOf(PasswordResetRateLimitedError)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it('does not stack a second outbox row while one is in flight', async () => {
    const { service, prisma, events } = makeService({ user: { id: 'u-1', contactEmail: 'bound@example.com' } })
    prisma.accountMail.findFirst.mockResolvedValue({ id: 'mail-0' })
    expect(await service.queueResetMail('u-1')).toEqual({ id: 'mail-0', created: false })
    expect(prisma.accountMail.create).not.toHaveBeenCalled()
    expect(events.emit).not.toHaveBeenCalled()
  })
})

describe('PasswordResetService.issueToken', () => {
  it('revokes older live tokens and stores only the hash, valid for the configured minutes', async () => {
    const { service, prisma } = makeService()
    prisma.user.findUnique.mockResolvedValue({ role: 'student', isActive: true, activationPending: false })
    const issued = await service.issueToken('u-1')
    expect(issued).not.toBeNull()
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', usedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    const stored = prisma.passwordResetToken.create.mock.calls[0][0].data
    expect(stored.tokenHash).toBe(hashActivationToken(issued!.raw))
    expect(JSON.stringify(prisma.passwordResetToken.create.mock.calls)).not.toContain(issued!.raw)
    const minutes = (stored.expiresAt.getTime() - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(55)
    expect(minutes).toBeLessThanOrEqual(61)
  })

  it('refuses accounts that cannot be reset by email', async () => {
    for (const user of [
      null,
      { role: 'teacher', isActive: true, activationPending: false },
      { role: 'student', isActive: false, activationPending: false },
      { role: 'student', isActive: true, activationPending: true },
    ]) {
      const { service, prisma } = makeService()
      prisma.user.findUnique.mockResolvedValue(user)
      expect(await service.issueToken('u-1')).toBeNull()
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
    }
  })
})

describe('PasswordResetService.validate', () => {
  it('accepts a live token and consumes nothing', async () => {
    const { raw } = generateActivationToken()
    const { service, prisma } = makeService()
    expect(await service.validate(raw)).toEqual({ valid: true })
    expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled()
  })

  it('answers the same { valid: false } for junk, unknown, used, revoked, expired and disabled', async () => {
    const { raw } = generateActivationToken()
    const cases: Array<TokenRow | null> = [
      null,
      makeToken({ usedAt: new Date() }),
      makeToken({ revokedAt: new Date() }),
      makeToken({ expiresAt: new Date(Date.now() - 1000) }),
      makeToken({}, { isActive: false }),
    ]
    for (const row of cases) {
      expect(await makeService({ row }).service.validate(raw)).toEqual({ valid: false })
    }
    expect(await makeService().service.validate('short')).toEqual({ valid: false })
  })
})

describe('PasswordResetService.complete', () => {
  it('sets the password on the user and credential row, ends every session, and tells the student', async () => {
    const { raw } = generateActivationToken()
    const { service, prisma, events, notifications } = makeService()
    expect(await service.complete({ token: raw, password: GOOD_PASSWORD }, '1.2.3.4')).toEqual({ ok: true })

    expect(prisma.passwordResetToken.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'tok-1', usedAt: null, revokedAt: null },
      data: { usedAt: expect.any(Date) },
    })
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1', isActive: true, role: 'student', activationPending: false },
      data: { password: '$2b$12$mockedhash', mustChangePassword: false, authVersion: { increment: 1 } },
    })
    expect(prisma.authAccount.upsert.mock.calls[0][0].update.password).toBe('$2b$12$mockedhash')
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
    expect(events.emit).toHaveBeenCalledWith('auth.session-replaced', { userId: 'u-1', reason: 'password_reset' })
    expect(notifications.notify).toHaveBeenCalledWith('u-1', expect.objectContaining({ type: 'password_reset' }))
    const audit = prisma.auditLog.create.mock.calls[0][0].data
    expect(audit.action).toBe('account.password_reset_completed')
    expect(JSON.stringify(audit)).not.toContain(raw)
  })

  it('rejects an unknown, revoked, expired or ineligible link with the same typed error', async () => {
    const { raw } = generateActivationToken()
    const cases: Array<TokenRow | null> = [
      null,
      makeToken({ revokedAt: new Date() }),
      makeToken({ expiresAt: new Date(Date.now() - 1000) }),
      makeToken({}, { isActive: false }),
      makeToken({}, { role: 'teacher' }),
      makeToken({}, { activationPending: true }),
    ]
    for (const row of cases) {
      const { service, prisma } = makeService({ row })
      await expect(service.complete({ token: raw, password: GOOD_PASSWORD })).rejects.toBeInstanceOf(
        PasswordResetLinkInvalidError,
      )
      expect(prisma.user.updateMany).not.toHaveBeenCalled()
    }
    await expect(makeService().service.complete({ token: 'short', password: GOOD_PASSWORD })).rejects.toBeInstanceOf(
      PasswordResetLinkInvalidError,
    )
  })

  it('treats a replay of a consumed link as already done without touching the account', async () => {
    const { raw } = generateActivationToken()
    const { service, prisma } = makeService({ row: makeToken({ usedAt: new Date() }) })
    expect(await service.complete({ token: raw, password: GOOD_PASSWORD })).toEqual({ ok: true, alreadyReset: true })
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
    expect(prisma.authSession.deleteMany).not.toHaveBeenCalled()
  })

  it('refuses a weak password before doing any work, leaving the link usable', async () => {
    const { raw } = generateActivationToken()
    const { service, prisma } = makeService()
    await expect(service.complete({ token: raw, password: 'weak' })).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled()
  })

  it('reports a lost double-tap race as a replay when the winner consumed it, and as invalid otherwise', async () => {
    const { raw } = generateActivationToken()
    const won = makeService({ claimCount: 0 })
    won.prisma.passwordResetToken.findUnique
      .mockResolvedValueOnce(makeToken())
      .mockResolvedValueOnce({ usedAt: new Date(), revokedAt: null })
    expect(await won.service.complete({ token: raw, password: GOOD_PASSWORD })).toEqual({
      ok: true,
      alreadyReset: true,
    })
    expect(won.prisma.user.updateMany).not.toHaveBeenCalled()

    const lost = makeService({ claimCount: 0 })
    lost.prisma.passwordResetToken.findUnique
      .mockResolvedValueOnce(makeToken())
      .mockResolvedValueOnce({ usedAt: null, revokedAt: new Date() })
    await expect(lost.service.complete({ token: raw, password: GOOD_PASSWORD })).rejects.toBeInstanceOf(
      PasswordResetLinkInvalidError,
    )
  })

  it('rate limits by IP and by token before reading the database', async () => {
    const { raw } = generateActivationToken()
    for (const limits of [[false], [true, false]]) {
      const { service, prisma } = makeService({ limits })
      await expect(service.complete({ token: raw, password: GOOD_PASSWORD }, '1.2.3.4')).rejects.toBeInstanceOf(
        PasswordResetRateLimitedError,
      )
      expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled()
    }
  })
})
