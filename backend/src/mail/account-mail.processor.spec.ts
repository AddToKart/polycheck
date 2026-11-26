import { AccountMailProcessor, MAIL_MAX_ATTEMPTS } from './account-mail.processor'
import { AccountMailQueueService } from './account-mail-queue.service'
import { MailSendError } from './mail.types'

interface Row {
  id: string
  userId: string
  kind: string
  attempts: number
}

function makeProcessor(
  options: {
    configured?: boolean
    sentToday?: number
    cap?: number
    row?: Row | null
    user?: Record<string, unknown> | null
    claimCount?: number
    issue?: { raw: string; expiresAt: Date } | null
    sendError?: unknown
  } = {},
) {
  const row = options.row === undefined ? { id: 'm-1', userId: 'u-1', kind: 'activation', attempts: 1 } : options.row
  const prisma: any = {
    accountMail: {
      count: jest.fn().mockResolvedValue(options.sentToday ?? 0),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(
        options.user === undefined
          ? {
              id: 'u-1',
              fullName: 'Dela Cruz, Maria Elena',
              email: 'maria@example.com',
              role: 'student',
              isActive: true,
              activationPending: true,
            }
          : options.user,
      ),
    },
  }
  const mail = {
    status: jest.fn().mockReturnValue({ driver: 'resend', configured: options.configured ?? true }),
    send: options.sendError
      ? jest.fn().mockRejectedValue(options.sendError)
      : jest.fn().mockResolvedValue({ providerId: 'prov-1' }),
  }
  const issued =
    options.issue === undefined
      ? { raw: 'RAWTOKEN'.padEnd(43, 'x'), expiresAt: new Date('2026-12-02T00:00:00Z') }
      : options.issue
  const activation = { issueToken: jest.fn().mockResolvedValue(issued) }
  const passwordReset = { issueToken: jest.fn().mockResolvedValue(issued) }
  const config = {
    get: jest.fn((key: string) =>
      key === 'MAIL_DAILY_CAP'
        ? String(options.cap ?? 100)
        : key === 'FRONTEND_URL'
          ? 'https://app.polycheck.live/'
          : undefined,
    ),
  }
  const processor = new AccountMailProcessor(
    prisma,
    mail as never,
    activation as never,
    passwordReset as never,
    config as never,
  )
  return { processor, prisma, mail, activation, passwordReset, issued }
}

describe('AccountMailProcessor.process', () => {
  it('claims the row, mints the token at send time, and marks the mail sent', async () => {
    const { processor, prisma, mail, activation, issued } = makeProcessor()

    await expect(processor.process('m-1')).resolves.toBe('sent')

    expect(prisma.accountMail.updateMany).toHaveBeenCalledWith({
      where: { id: 'm-1', status: 'queued' },
      data: { status: 'sending', attempts: { increment: 1 }, queuedAt: expect.any(Date), errorCode: null },
    })
    expect(activation.issueToken).toHaveBeenCalledWith('u-1')
    const sent = mail.send.mock.calls[0][0]
    expect(sent.to).toBe('maria@example.com')
    // The link lives in the fragment (never in server logs) and uses the configured frontend base.
    expect(sent.text).toContain(`https://app.polycheck.live/activate#token=${issued!.raw}`)
    expect(sent.idempotencyKey).toBe('account-mail-m-1-1')
    expect(prisma.accountMail.update).toHaveBeenLastCalledWith({
      where: { id: 'm-1' },
      data: { status: 'sent', sentAt: expect.any(Date), providerId: 'prov-1', errorCode: null },
    })
  })

  it('never persists the raw token in the outbox row', async () => {
    const { processor, prisma, issued } = makeProcessor()
    await processor.process('m-1')
    expect(JSON.stringify(prisma.accountMail.update.mock.calls)).not.toContain(issued!.raw)
    expect(JSON.stringify(prisma.accountMail.updateMany.mock.calls)).not.toContain(issued!.raw)
  })

  it('does nothing when mail is not configured (rows stay queued for later)', async () => {
    const { processor, prisma, mail } = makeProcessor({ configured: false })
    await expect(processor.process('m-1')).resolves.toBe('deferred')
    expect(prisma.accountMail.updateMany).not.toHaveBeenCalled()
    expect(mail.send).not.toHaveBeenCalled()
  })

  it('defers instead of sending once the daily budget is spent', async () => {
    const { processor, prisma, mail } = makeProcessor({ sentToday: 100, cap: 100 })
    await expect(processor.process('m-1')).resolves.toBe('deferred')
    expect(prisma.accountMail.updateMany).not.toHaveBeenCalled()
    expect(mail.send).not.toHaveBeenCalled()
  })

  it('counts the daily budget from 00:00 UTC (Resend’s quota boundary)', async () => {
    const { processor, prisma } = makeProcessor({ cap: 10 })
    const at = new Date('2026-11-25T23:30:00.000Z')
    await processor.sentToday(at)
    expect(prisma.accountMail.count).toHaveBeenCalledWith({
      where: { status: 'sent', sentAt: { gte: new Date('2026-11-25T00:00:00.000Z') } },
    })
  })

  it('skips a row another worker already claimed', async () => {
    const { processor, mail } = makeProcessor({ claimCount: 0 })
    await expect(processor.process('m-1')).resolves.toBe('skipped')
    expect(mail.send).not.toHaveBeenCalled()
  })

  it.each([
    ['the account is no longer pending', { activationPending: false }, 'not_pending'],
    ['the account was disabled', { isActive: false }, 'not_pending'],
    ['the recipient has no email', { email: null }, 'no_email'],
    ['the recipient email is blank', { email: '   ' }, 'no_email'],
  ])('fails permanently when %s', async (_label, patch, code) => {
    const { processor, prisma, mail } = makeProcessor({
      user: {
        id: 'u-1',
        fullName: 'Maria',
        email: 'maria@example.com',
        role: 'student',
        isActive: true,
        activationPending: true,
        ...patch,
      },
    })
    await expect(processor.process('m-1')).resolves.toBe('failed')
    expect(prisma.accountMail.update).toHaveBeenLastCalledWith({
      where: { id: 'm-1' },
      data: { status: 'failed', errorCode: code },
    })
    expect(mail.send).not.toHaveBeenCalled()
  })

  it('fails when the account vanished or no token could be issued', async () => {
    const gone = makeProcessor({ user: null })
    await expect(gone.processor.process('m-1')).resolves.toBe('failed')
    const noToken = makeProcessor({ issue: null })
    await expect(noToken.processor.process('m-1')).resolves.toBe('failed')
    expect(noToken.mail.send).not.toHaveBeenCalled()
  })

  it('puts a transient failure back in the queue with an error code only', async () => {
    const { processor, prisma } = makeProcessor({ sendError: new MailSendError('resend_429', true) })
    await expect(processor.process('m-1')).resolves.toBe('retry')
    expect(prisma.accountMail.update).toHaveBeenLastCalledWith({
      where: { id: 'm-1' },
      data: { status: 'queued', queuedAt: expect.any(Date), errorCode: 'resend_429' },
    })
  })

  it('fails permanently on a non-retryable provider error', async () => {
    const { processor, prisma } = makeProcessor({ sendError: new MailSendError('resend_422', false) })
    await expect(processor.process('m-1')).resolves.toBe('failed')
    expect(prisma.accountMail.update).toHaveBeenLastCalledWith({
      where: { id: 'm-1' },
      data: { status: 'failed', errorCode: 'resend_422' },
    })
  })

  it('gives up after the maximum number of attempts', async () => {
    const { processor, prisma } = makeProcessor({
      row: { id: 'm-1', userId: 'u-1', kind: 'activation', attempts: MAIL_MAX_ATTEMPTS },
      sendError: new MailSendError('resend_503', true),
    })
    await expect(processor.process('m-1')).resolves.toBe('failed')
    expect(prisma.accountMail.update).toHaveBeenLastCalledWith({
      where: { id: 'm-1' },
      data: { status: 'failed', errorCode: 'max_attempts' },
    })
  })

  it('treats an unknown thrown error as retryable', async () => {
    const { processor } = makeProcessor({ sendError: new Error('boom') })
    await expect(processor.process('m-1')).resolves.toBe('retry')
  })

  it('rejects unsupported mail kinds', async () => {
    const { processor, mail } = makeProcessor({ row: { id: 'm-1', userId: 'u-1', kind: 'weird', attempts: 1 } })
    await expect(processor.process('m-1')).resolves.toBe('failed')
    expect(mail.send).not.toHaveBeenCalled()
  })
})

describe('AccountMailProcessor password_reset mail', () => {
  const resetRow = { id: 'm-9', userId: 'u-1', kind: 'password_reset', attempts: 1 }
  const eligible = {
    id: 'u-1',
    fullName: 'Dela Cruz, Maria Elena',
    email: 'login@example.com',
    contactEmail: 'bound@example.com',
    role: 'student',
    isActive: true,
    activationPending: false,
  }

  it('mints a reset token and sends the reset link to the BOUND contact email, not the login email', async () => {
    const { processor, mail, passwordReset, activation } = makeProcessor({ row: resetRow, user: eligible })
    expect(await processor.process('m-9')).toBe('sent')
    expect(passwordReset.issueToken).toHaveBeenCalledWith('u-1')
    expect(activation.issueToken).not.toHaveBeenCalled()
    const sent = mail.send.mock.calls[0][0]
    expect(sent.to).toBe('bound@example.com')
    expect(sent.subject).toBe('Reset your Polycheck password')
    expect(sent.text).toContain('https://app.polycheck.live/reset-password#token=')
    expect(sent.idempotencyKey).toBe('account-mail-m-9-1')
  })

  it('fails with no_email when nothing is bound anymore', async () => {
    const { processor, mail, prisma } = makeProcessor({ row: resetRow, user: { ...eligible, contactEmail: null } })
    expect(await processor.process('m-9')).toBe('failed')
    expect(mail.send).not.toHaveBeenCalled()
    expect(prisma.accountMail.update).toHaveBeenCalledWith({
      where: { id: 'm-9' },
      data: { status: 'failed', errorCode: 'no_email' },
    })
  })

  it('fails when the account is inactive, not a student, or still awaiting activation', async () => {
    for (const patch of [{ isActive: false }, { role: 'teacher' }, { activationPending: true }]) {
      const { processor, mail } = makeProcessor({ row: resetRow, user: { ...eligible, ...patch } })
      expect(await processor.process('m-9')).toBe('failed')
      expect(mail.send).not.toHaveBeenCalled()
    }
  })

  it('fails when no token can be issued', async () => {
    const { processor, mail } = makeProcessor({ row: resetRow, user: eligible, issue: null })
    expect(await processor.process('m-9')).toBe('failed')
    expect(mail.send).not.toHaveBeenCalled()
  })
})

describe('AccountMailProcessor sweeps', () => {
  it('returns stuck sending rows to the queue only after ten minutes', async () => {
    const { processor, prisma } = makeProcessor()
    prisma.accountMail.updateMany.mockResolvedValue({ count: 3 })
    const now = new Date('2026-11-25T10:00:00.000Z')

    await expect(processor.releaseStaleSending(now)).resolves.toBe(3)

    expect(prisma.accountMail.updateMany).toHaveBeenCalledWith({
      where: { status: 'sending', queuedAt: { lt: new Date('2026-11-25T09:50:00.000Z') } },
      data: { status: 'queued', queuedAt: now },
    })
  })

  it('finds queued rows nobody picked up for two minutes, oldest first', async () => {
    const { processor, prisma } = makeProcessor()
    prisma.accountMail.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    const now = new Date('2026-11-25T10:00:00.000Z')

    await expect(processor.findOverdueQueued(now)).resolves.toEqual(['a', 'b'])

    expect(prisma.accountMail.findMany).toHaveBeenCalledWith({
      where: { status: 'queued', queuedAt: { lt: new Date('2026-11-25T09:58:00.000Z') } },
      orderBy: { queuedAt: 'asc' },
      take: 200,
      select: { id: true },
    })
  })
})

describe('AccountMailQueueService (no Redis: inline mode)', () => {
  function makeQueue(configured = true, capReached = false) {
    const processor = {
      process: jest.fn().mockResolvedValue('sent'),
      releaseStaleSending: jest.fn().mockResolvedValue(0),
      capReached: jest.fn().mockResolvedValue(capReached),
      findOverdueQueued: jest.fn().mockResolvedValue(['m-1', 'm-2']),
    }
    const mail = { status: jest.fn().mockReturnValue({ driver: 'resend', configured }) }
    const config = { get: jest.fn().mockReturnValue(undefined) }
    const queue = new AccountMailQueueService(processor as never, mail as never, config as never)
    return { queue, processor }
  }

  it('processes a queued event inline when there is no Redis', async () => {
    const { queue, processor } = makeQueue()
    await queue.onModuleInit()
    await queue.onQueued({ id: 'm-1' })
    expect(processor.process).toHaveBeenCalledWith('m-1')
  })

  it('ignores events entirely while mail is not configured', async () => {
    const { queue, processor } = makeQueue(false)
    await queue.onQueued({ id: 'm-1' })
    expect(processor.process).not.toHaveBeenCalled()
    await expect(queue.sweep()).resolves.toBe(0)
  })

  it('the sweeper recovers stuck rows and re-queues overdue ones', async () => {
    const { queue, processor } = makeQueue()
    await expect(queue.sweep()).resolves.toBe(2)
    expect(processor.releaseStaleSending).toHaveBeenCalled()
    expect(processor.process).toHaveBeenCalledTimes(2)
  })

  it('the sweeper idles once the daily budget is spent', async () => {
    const { queue, processor } = makeQueue(true, true)
    await expect(queue.sweep()).resolves.toBe(0)
    expect(processor.findOverdueQueued).not.toHaveBeenCalled()
  })

  it('a failing inline send never throws out of the event handler', async () => {
    const { queue, processor } = makeQueue()
    processor.process.mockRejectedValue(new Error('db down'))
    await expect(queue.onQueued({ id: 'm-1' })).resolves.toBeUndefined()
  })
})
