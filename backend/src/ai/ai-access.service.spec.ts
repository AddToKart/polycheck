import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common'
import { AI_TERMS_REQUIRED_CODE, AI_TERMS_VERSION } from '@polycheck/shared'
import { RedisService } from '../infrastructure/redis.service'
import { AiAccessService } from './ai-access.service'
import { campusDayWindow, resolveDailyLimit } from './ai-limits'

const student = { id: 'student-1', role: 'student' as const }
const teacher = { id: 'teacher-1', role: 'teacher' as const }
const admin = { id: 'admin-1', role: 'super_admin' as const }

function make(
  options: { accepted?: string | null; saved?: Record<string, number>; env?: Record<string, unknown> } = {},
) {
  const account = { aiTermsVersion: options.accepted ?? null }
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({ ...account })),
      update: jest.fn(async ({ data }: { data: { aiTermsVersion: string } }) => {
        account.aiTermsVersion = data.aiTermsVersion
      }),
    },
  }
  const saved = options.saved ?? {}
  const settings = { getInteger: jest.fn(async (key: string, fallback: number) => saved[key] ?? fallback) }
  // The real counter code, on its in-process fallback (no Redis server in unit tests).
  const redis = new RedisService({ get: () => undefined } as never)
  const provider = { describe: jest.fn().mockResolvedValue({ enabled: true, model: 'm', provider: 'ai.example' }) }
  const audit = { recordTermsAccepted: jest.fn().mockResolvedValue(undefined) }
  const config = { get: jest.fn((key: string) => options.env?.[key]) }
  const service = new AiAccessService(
    provider as never,
    prisma as never,
    settings as never,
    redis,
    audit as never,
    config as never,
  )
  return { service, prisma, settings, saved, provider, audit, config }
}

describe('AI terms', () => {
  it('refuses a message until the current version is accepted', async () => {
    for (const accepted of [null, '0.9']) {
      const { service } = make({ accepted })
      const refusal = await service.assertTermsAccepted(student.id).catch((error: unknown) => error)
      expect(refusal).toBeInstanceOf(ForbiddenException)
      expect((refusal as ForbiddenException).getResponse()).toMatchObject({ code: AI_TERMS_REQUIRED_CODE })
    }
    await expect(make({ accepted: AI_TERMS_VERSION }).service.assertTermsAccepted(student.id)).resolves.toBeUndefined()
  })

  it('records an acceptance once, with an audit entry', async () => {
    const { service, prisma, audit } = make()
    await expect(service.capabilities(student)).resolves.toMatchObject({
      terms: { version: AI_TERMS_VERSION, accepted: false },
      provider: 'ai.example',
    })

    await expect(service.acceptTerms(student, AI_TERMS_VERSION)).resolves.toMatchObject({
      terms: { accepted: true },
    })
    await service.acceptTerms(student, AI_TERMS_VERSION)

    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: student.id },
      data: { aiTermsVersion: AI_TERMS_VERSION, aiTermsAcceptedAt: expect.any(Date) },
    })
    expect(audit.recordTermsAccepted).toHaveBeenCalledTimes(1)
  })

  it('refuses a version that is not the current one', async () => {
    const { service, prisma } = make()
    await expect(service.acceptTerms(student, '0.9')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('adds nothing when the assistant is unavailable', async () => {
    const { service, provider, prisma } = make()
    provider.describe.mockResolvedValue({ enabled: false, reason: 'off' })
    await expect(service.capabilities(student)).resolves.toEqual({ enabled: false, reason: 'off' })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})

describe('AI daily limits', () => {
  it('starts with 10 for students, 20 for teachers and the server value for administrators', async () => {
    const { service } = make({ env: { AI_MAX_MESSAGES_PER_DAY: 55 } })
    await expect(service.usage(student)).resolves.toMatchObject({ limit: 10, used: 0, remaining: 10 })
    await expect(service.usage(teacher)).resolves.toMatchObject({ limit: 20 })
    await expect(service.usage(admin)).resolves.toMatchObject({ limit: 55 })
    await expect(make().service.usage(admin)).resolves.toMatchObject({ limit: 100 })
  })

  it("uses the super admin's saved numbers and keeps them within 0 to 1000", async () => {
    const settings = { getInteger: jest.fn().mockResolvedValue(5000) }
    const config = { get: () => undefined }
    await expect(resolveDailyLimit(settings, config, 'student')).resolves.toBe(1000)
    settings.getInteger.mockResolvedValue(-3)
    await expect(resolveDailyLimit(settings, config, 'teacher')).resolves.toBe(0)
    expect(settings.getInteger).toHaveBeenCalledWith('ai_daily_limit_teacher', 20)
  })

  it('stops at the limit without counting refused tries, so raising it works at once', async () => {
    const { service, saved } = make({ saved: { ai_daily_limit_student: 2 } })
    await service.reserveMessage(student)
    await service.reserveMessage(student)
    for (let attempt = 0; attempt < 3; attempt++) {
      const refusal = await service.reserveMessage(student).catch((error: unknown) => error)
      expect(refusal).toBeInstanceOf(HttpException)
      expect((refusal as HttpException).getStatus()).toBe(429)
      expect((refusal as HttpException).getResponse()).toMatchObject({ code: 'ai_daily_limit' })
    }
    await expect(service.usage(student)).resolves.toMatchObject({ used: 2, remaining: 0 })

    saved.ai_daily_limit_student = 3
    await expect(service.usage(student)).resolves.toMatchObject({ used: 2, remaining: 1 })
    await expect(service.reserveMessage(student)).resolves.toEqual(expect.any(Function))
  })

  it('gives a message back only once', async () => {
    const { service } = make()
    await service.reserveMessage(student)
    const refund = await service.reserveMessage(student)
    await refund()
    await refund()
    await expect(service.usage(student)).resolves.toMatchObject({ used: 1, remaining: 9 })
  })

  it('counts each person separately', async () => {
    const { service } = make()
    await service.reserveMessage(student)
    await expect(service.usage({ id: 'student-2', role: 'student' })).resolves.toMatchObject({ used: 0 })
  })

  it('starts a new day at midnight campus time', () => {
    expect(campusDayWindow(new Date('2026-11-27T15:59:59Z'))).toEqual({
      day: '2026-11-27',
      resetsAt: '2026-11-27T16:00:00.000Z',
    })
    expect(campusDayWindow(new Date('2026-11-27T16:00:00Z'))).toEqual({
      day: '2026-11-28',
      resetsAt: '2026-11-28T16:00:00.000Z',
    })
  })
})
