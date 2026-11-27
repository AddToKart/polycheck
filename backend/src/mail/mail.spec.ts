import { MailService } from './mail.service'
import { MailSendError } from './mail.types'
import { ResendMailDriver } from './drivers/resend.driver'
import { LogMailDriver } from './drivers/log.driver'
import { DisabledMailDriver } from './drivers/disabled.driver'
import { buildActivationEmail, firstNameOf } from './activation-email'
import { validateEnv } from '../common/config/env-validation'

const message = {
  to: 'maria@example.com',
  subject: 'Activate your PolyCheck account',
  html: '<p>hi</p>',
  text: 'hi',
  idempotencyKey: 'account-mail-m1-1',
}

function okResponse(body: unknown = { id: 'prov-123' }) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ message: 'SECRET provider detail re_live_key' }),
  } as unknown as Response
}

describe('ResendMailDriver', () => {
  const options = { apiKey: 're_test_key', from: 'PolyCheck <no-reply@polycheck.live>', replyTo: 'help@polycheck.live' }

  it('posts the documented request shape with the key and an idempotency header', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse())
    const driver = new ResendMailDriver({ ...options, fetchImpl })

    await expect(driver.send(message)).resolves.toEqual({ providerId: 'prov-123' })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'account-mail-m1-1',
    })
    expect(JSON.parse(init.body)).toEqual({
      from: options.from,
      to: ['maria@example.com'],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: 'help@polycheck.live',
    })
  })

  it('omits reply_to when none is configured and caps the idempotency key at 256 chars', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse({}))
    const driver = new ResendMailDriver({ apiKey: 'k', from: 'a@b.c', fetchImpl })
    await expect(driver.send({ ...message, idempotencyKey: 'x'.repeat(400) })).resolves.toEqual({ providerId: null })
    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body)).not.toHaveProperty('reply_to')
    expect(init.headers['Idempotency-Key']).toHaveLength(256)
  })

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [409, false],
    [422, false],
  ])('maps HTTP %i to retryable=%s without leaking the provider body', async (status, retryable) => {
    const driver = new ResendMailDriver({ ...options, fetchImpl: jest.fn().mockResolvedValue(errorResponse(status)) })
    const error = (await driver.send(message).catch((caught: unknown) => caught)) as MailSendError
    expect(error).toBeInstanceOf(MailSendError)
    expect(error.code).toBe(`resend_${status}`)
    expect(error.retryable).toBe(retryable)
    expect(error.message).not.toContain('SECRET')
    expect(error.message).not.toContain('re_live_key')
  })

  it('treats a network failure as retryable', async () => {
    const driver = new ResendMailDriver({ ...options, fetchImpl: jest.fn().mockRejectedValue(new Error('ECONNRESET')) })
    await expect(driver.send(message)).rejects.toMatchObject({ code: 'resend_network_error', retryable: true })
  })
})

describe('MailService driver selection', () => {
  const originalEnv = { ...process.env }
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  const withEnv = (env: Record<string, string | undefined>) => {
    for (const key of ['MAIL_DRIVER', 'RESEND_API_KEY', 'MAIL_FROM', 'MAIL_REPLY_TO']) delete process.env[key]
    Object.assign(process.env, env)
    return new MailService()
  }

  it('defaults to disabled and refuses every send', async () => {
    const service = withEnv({})
    expect(service.status()).toEqual({ driver: 'disabled', configured: false })
    await expect(service.send(message)).rejects.toMatchObject({ code: 'mail_disabled', retryable: false })
  })

  it('selects resend only with a key and a sender, otherwise falls back to disabled', () => {
    expect(withEnv({ MAIL_DRIVER: 'resend', RESEND_API_KEY: 'k', MAIL_FROM: 'a@b.c' }).status()).toEqual({
      driver: 'resend',
      configured: true,
    })
    expect(withEnv({ MAIL_DRIVER: 'resend', RESEND_API_KEY: 'k' }).status().driver).toBe('disabled')
    expect(withEnv({ MAIL_DRIVER: 'resend', MAIL_FROM: 'a@b.c' }).status().driver).toBe('disabled')
  })

  it('log driver captures messages for the dev smoke', async () => {
    const service = withEnv({ MAIL_DRIVER: 'log' })
    expect(service.status()).toEqual({ driver: 'log', configured: true })
    await service.send(message)
    expect(service.capturedMessages()).toEqual([message])
  })

  it('exposes drivers with stable names', () => {
    expect(new LogMailDriver().name).toBe('log')
    expect(new DisabledMailDriver().name).toBe('disabled')
  })
})

describe('activation email', () => {
  const link = 'https://app.polycheck.live/activate#token=abc_DEF-123'
  const expiresAt = new Date('2026-12-02T10:00:00.000Z')

  it('contains the link, the expiry and no sensitive account data', () => {
    const email = buildActivationEmail({ fullName: 'Dela Cruz, Maria Elena', link, expiresAt })
    expect(email.subject).toBe('Activate your PolyCheck account')
    expect(email.text).toContain(link)
    expect(email.html).toContain(link)
    expect(email.text).toContain('Hi Maria,')
    expect(email.text).toContain('December')
    expect(email.text).toMatch(/ignore it/i)
    for (const body of [email.text, email.html]) {
      expect(body).not.toMatch(/\d{4}-\d{5}-[A-Z]{2}-\d/) // no student number
      expect(body).not.toMatch(/password:/i)
    }
  })

  it('escapes the recipient name in html', () => {
    const email = buildActivationEmail({ fullName: '<script>alert(1)</script> Juan', link, expiresAt })
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it.each([
    ['Dela Cruz, Juan Miguel', 'Juan'],
    ['Juan Miguel Dela Cruz', 'Juan'],
    ['  ', 'there'],
    ['', 'there'],
  ])('derives the greeting name from "%s"', (fullName, expected) => {
    expect(firstNameOf(fullName)).toBe(expected)
  })
})

describe('mail env validation', () => {
  const base = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    BETTER_AUTH_SECRET: 'x'.repeat(40),
  }

  it('defaults to a disabled driver with a 100/day cap (the Resend free plan)', () => {
    const env = validateEnv(base)
    expect(env.MAIL_DRIVER).toBe('disabled')
    expect(env.MAIL_DAILY_CAP).toBe(100)
    expect(env.MAIL_RATE_PER_SECOND).toBe(2)
  })

  it('requires a key and a sender for resend', () => {
    expect(() => validateEnv({ ...base, MAIL_DRIVER: 'resend' })).toThrow(/RESEND_API_KEY/)
    expect(validateEnv({ ...base, MAIL_DRIVER: 'resend', RESEND_API_KEY: 'k', MAIL_FROM: 'a@b.c' }).MAIL_DRIVER).toBe(
      'resend',
    )
  })

  it('rejects the log driver in production and unknown drivers anywhere', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', MAIL_DRIVER: 'log' })).toThrow(/MAIL_DRIVER/)
    expect(() => validateEnv({ ...base, MAIL_DRIVER: 'smtp' })).toThrow()
    expect(validateEnv({ ...base, MAIL_DRIVER: 'log' }).MAIL_DRIVER).toBe('log')
  })
})
