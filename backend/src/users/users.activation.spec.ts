import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service'
import type { RequestUser } from '../auth/authenticated-principal'

const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const campusRegistrar: RequestUser = { id: 'reg-1', role: 'teacher', isUserRegistrar: true, managesAllCourses: true }
const bsitRegistrar: RequestUser = { id: 'reg-2', role: 'teacher', isUserRegistrar: true, managedCourses: ['BSIT'] }

const pendingStudent = {
  id: 's-1',
  role: 'student',
  department: 'BSIT',
  program: 'BSIT',
  email: 'maria@example.com',
  isActive: true,
  activationPending: true,
}

function build(
  options: { target?: unknown; pending?: unknown[]; enabled?: boolean; configured?: boolean; created?: boolean } = {},
) {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(options.target === undefined ? pendingStudent : options.target),
      findMany: jest.fn().mockResolvedValue(options.pending ?? []),
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  }
  const activation = {
    queueActivationMail: jest.fn().mockResolvedValue({ id: 'mail-1', created: options.created ?? true }),
  }
  const settings = { getBoolean: jest.fn().mockResolvedValue(options.enabled ?? true) }
  const mail = { status: jest.fn().mockReturnValue({ driver: 'resend', configured: options.configured ?? true }) }
  const service = new UsersService(
    prisma,
    undefined,
    undefined,
    undefined,
    settings as never,
    undefined,
    activation as never,
    mail as never,
  )
  return { service, prisma, activation, settings, mail }
}

describe('UsersService.resendActivation', () => {
  it('queues a fresh activation email for a pending student and audits it', async () => {
    const { service, activation, prisma } = build()
    await expect(service.resendActivation('s-1', institutionAdmin)).resolves.toEqual({
      queued: true,
      alreadyQueued: false,
    })
    expect(activation.queueActivationMail).toHaveBeenCalledWith('s-1')
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'admin.user.activation_resent',
      entityId: 's-1',
    })
  })

  it('reports an already queued email instead of stacking another', async () => {
    const { service } = build({ created: false })
    await expect(service.resendActivation('s-1', institutionAdmin)).resolves.toEqual({
      queued: true,
      alreadyQueued: true,
    })
  })

  it.each([
    ['the account is not pending', { ...pendingStudent, activationPending: false }, 'not_pending'],
    ['the account is disabled', { ...pendingStudent, isActive: false }, 'account_disabled'],
    ['the account has no email', { ...pendingStudent, email: null }, 'no_email'],
    ['the email is blank', { ...pendingStudent, email: '  ' }, 'no_email'],
  ])('refuses when %s', async (_label, target, code) => {
    const { service, activation } = build({ target })
    const error = (await service
      .resendActivation('s-1', institutionAdmin)
      .catch((caught: unknown) => caught)) as BadRequestException
    expect(error).toBeInstanceOf(BadRequestException)
    expect(error.getResponse()).toMatchObject({ code })
    expect(activation.queueActivationMail).not.toHaveBeenCalled()
  })

  it('only applies to students and to existing accounts', async () => {
    await expect(
      build({ target: { ...pendingStudent, role: 'teacher' } }).service.resendActivation('s-1', institutionAdmin),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(build({ target: null }).service.resendActivation('missing', institutionAdmin)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('keeps the account-admin scope: a course-pinned registrar cannot resend for another course', async () => {
    const original = process.env.COURSE_SCOPE_MODE
    process.env.COURSE_SCOPE_MODE = 'course'
    try {
      const other = build({ target: { ...pendingStudent, program: 'BSHM', department: 'BSHM' } })
      await expect(other.service.resendActivation('s-1', bsitRegistrar)).rejects.toBeInstanceOf(ForbiddenException)
      expect(other.activation.queueActivationMail).not.toHaveBeenCalled()

      const own = build()
      await expect(own.service.resendActivation('s-1', bsitRegistrar)).resolves.toMatchObject({ queued: true })
      const campus = build({ target: { ...pendingStudent, program: 'BSHM' } })
      await expect(campus.service.resendActivation('s-1', campusRegistrar)).resolves.toMatchObject({ queued: true })
    } finally {
      if (original === undefined) delete process.env.COURSE_SCOPE_MODE
      else process.env.COURSE_SCOPE_MODE = original
    }
  })

  it('is refused for anyone who is not an account administrator', async () => {
    await expect(build().service.resendActivation('s-1', { id: 't-1', role: 'teacher' })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it.each([
    ['the setting is off', { enabled: false }],
    ['mail is not configured', { configured: false }],
  ])('is unavailable when %s', async (_label, options) => {
    const { service, activation } = build(options)
    const error = (await service
      .resendActivation('s-1', institutionAdmin)
      .catch((caught: unknown) => caught)) as BadRequestException
    expect(error.getResponse()).toMatchObject({ code: 'activation_email_unavailable' })
    expect(activation.queueActivationMail).not.toHaveBeenCalled()
  })
})

describe('UsersService.resendPendingActivation', () => {
  it('queues every pending student with an email and counts the rest', async () => {
    const { service, activation, prisma } = build({
      pending: [
        { id: 's-1', email: 'a@example.com' },
        { id: 's-2', email: null },
        { id: 's-3', email: 'c@example.com' },
        { id: 's-4', email: ' ' },
      ],
    })
    activation.queueActivationMail
      .mockResolvedValueOnce({ id: 'm1', created: true })
      .mockResolvedValueOnce({ id: 'm3', created: false })

    await expect(service.resendPendingActivation(institutionAdmin)).resolves.toEqual({
      pending: 4,
      queued: 1,
      alreadyQueued: 1,
      noEmail: 2,
    })
    expect(activation.queueActivationMail).toHaveBeenCalledTimes(2)
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'admin.user.activation_resent_bulk',
      metadata: { pending: 4, queued: 1, alreadyQueued: 1, noEmail: 2 },
    })
  })

  it('queries only pending active students inside the caller scope, with a hard cap', async () => {
    const { service, prisma } = build()
    await service.resendPendingActivation(institutionAdmin)
    const args = prisma.user.findMany.mock.calls[0][0]
    expect(args.take).toBe(2000)
    expect(JSON.stringify(args.where)).toContain('"activationPending":true')
    expect(JSON.stringify(args.where)).toContain('"role":"student"')
  })

  it('pins a registrar to their scope', async () => {
    const original = process.env.COURSE_SCOPE_MODE
    process.env.COURSE_SCOPE_MODE = 'course'
    try {
      const { service, prisma } = build()
      await service.resendPendingActivation(bsitRegistrar)
      expect(JSON.stringify(prisma.user.findMany.mock.calls[0][0].where)).toContain('"program"')
    } finally {
      if (original === undefined) delete process.env.COURSE_SCOPE_MODE
      else process.env.COURSE_SCOPE_MODE = original
    }
  })

  it('is unavailable while the feature is off and refused for non-administrators', async () => {
    await expect(build({ enabled: false }).service.resendPendingActivation(institutionAdmin)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(build().service.resendPendingActivation({ id: 't-1', role: 'teacher' })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })
})

describe('UsersService.findAll activation surface', () => {
  const filters = (extra = {}) => ({ role: 'student' as const, ...extra })

  it('filters to pending students on request', async () => {
    const { service, prisma } = build()
    prisma.user.findMany.mockResolvedValue([])
    await service.findAll(institutionAdmin, filters({ activation: 'pending' }))
    expect(JSON.stringify(prisma.user.findMany.mock.calls[0][0].where)).toContain('"activationPending":true')
  })

  it('does not add the pending predicate by default', async () => {
    const { service, prisma } = build()
    prisma.user.findMany.mockResolvedValue([])
    await service.findAll(institutionAdmin, filters())
    expect(JSON.stringify(prisma.user.findMany.mock.calls[0][0].where)).not.toContain('activationPending')
  })

  it('exposes the latest mail state only for pending accounts, as plain strings', async () => {
    const { service, prisma } = build()
    const sentAt = new Date('2026-11-25T10:00:00.000Z')
    prisma.user.findMany.mockResolvedValue([
      { id: 's-1', activationPending: true, accountMails: [{ status: 'sent', sentAt, errorCode: null }] },
      {
        id: 's-2',
        activationPending: true,
        accountMails: [{ status: 'failed', sentAt: null, errorCode: 'resend_422' }],
      },
      { id: 's-3', activationPending: false, accountMails: [{ status: 'sent', sentAt, errorCode: null }] },
      { id: 's-4', activationPending: true, accountMails: [] },
    ])
    const page = await service.findAll(institutionAdmin, filters())
    const byId = Object.fromEntries(page.data.map((account: any) => [account.id, account]))
    expect(byId['s-1'].activationMail).toEqual({ status: 'sent', sentAt: sentAt.toISOString() })
    expect(byId['s-2'].activationMail).toEqual({ status: 'failed', errorCode: 'resend_422' })
    expect(byId['s-3']).not.toHaveProperty('activationMail')
    expect(byId['s-4']).not.toHaveProperty('activationMail')
    // The raw relation never leaks into the payload.
    for (const account of page.data) expect(account).not.toHaveProperty('accountMails')
  })
})
