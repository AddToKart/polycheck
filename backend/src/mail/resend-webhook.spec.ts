import { createHmac } from 'node:crypto'
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { interpretResendEvent, verifySvixSignature } from './resend-webhook'
import { ResendWebhookController } from './resend-webhook.controller'

// A Svix secret is `whsec_` + base64; the base64 part is the HMAC key.
const KEY = Buffer.from('super-secret-signing-key-for-tests')
const SECRET = `whsec_${KEY.toString('base64')}`
const NOW = 1_795_600_000_000

function sign(id: string, timestamp: string, body: string, key = KEY) {
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`
}

const stamp = (offsetSeconds = 0) => String(Math.floor(NOW / 1000) + offsetSeconds)

describe('verifySvixSignature', () => {
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
  const verify = (headers: { id?: string; timestamp?: string; signature?: string }, raw: string | Buffer = body) =>
    verifySvixSignature({
      secret: SECRET,
      headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature },
      rawBody: raw,
      now: NOW,
    })

  it('accepts a correctly signed, fresh request', () => {
    const timestamp = stamp()
    expect(verify({ id: 'msg_1', timestamp, signature: sign('msg_1', timestamp, body) })).toBe(true)
    expect(verify({ id: 'msg_1', timestamp, signature: sign('msg_1', timestamp, body) }, Buffer.from(body))).toBe(true)
  })

  it('accepts any matching signature in a rotated, space-separated list', () => {
    const timestamp = stamp()
    const rotated = `v1,${Buffer.from('stale').toString('base64')} ${sign('msg_1', timestamp, body)}`
    expect(verify({ id: 'msg_1', timestamp, signature: rotated })).toBe(true)
  })

  it('rejects a tampered body, a different id, a wrong key and a wrong version', () => {
    const timestamp = stamp()
    const good = sign('msg_1', timestamp, body)
    expect(verify({ id: 'msg_1', timestamp, signature: good }, body.replace('em_1', 'em_2'))).toBe(false)
    expect(verify({ id: 'msg_2', timestamp, signature: good })).toBe(false)
    expect(verify({ id: 'msg_1', timestamp, signature: sign('msg_1', timestamp, body, Buffer.from('other')) })).toBe(
      false,
    )
    expect(verify({ id: 'msg_1', timestamp, signature: good.replace('v1,', 'v2,') })).toBe(false)
  })

  it('rejects replays outside the five-minute window (either direction)', () => {
    for (const offset of [-301, 301, -86_400]) {
      const timestamp = stamp(offset)
      expect(verify({ id: 'msg_1', timestamp, signature: sign('msg_1', timestamp, body) })).toBe(false)
    }
    const edge = stamp(-299)
    expect(verify({ id: 'msg_1', timestamp: edge, signature: sign('msg_1', edge, body) })).toBe(true)
  })

  it('rejects missing or malformed headers and an unusable secret', () => {
    const timestamp = stamp()
    const signature = sign('msg_1', timestamp, body)
    expect(verify({ timestamp, signature })).toBe(false)
    expect(verify({ id: 'msg_1', signature })).toBe(false)
    expect(verify({ id: 'msg_1', timestamp })).toBe(false)
    expect(verify({ id: 'msg_1', timestamp: 'not-a-number', signature })).toBe(false)
    expect(verify({ id: 'msg_1', timestamp, signature: 'garbage' })).toBe(false)
    expect(
      verifySvixSignature({
        secret: 'whsec_',
        headers: { id: 'msg_1', timestamp, signature },
        rawBody: body,
        now: NOW,
      }),
    ).toBe(false)
  })
})

describe('interpretResendEvent', () => {
  it('maps delivery and the failure family', () => {
    expect(interpretResendEvent({ type: 'email.delivered', data: { email_id: 'em_1' } })).toEqual({
      kind: 'delivered',
      providerId: 'em_1',
    })
    expect(
      interpretResendEvent({ type: 'email.bounced', data: { email_id: 'em_1', bounce: { type: 'Permanent' } } }),
    ).toEqual({ kind: 'bounced', providerId: 'em_1', errorCode: 'bounce_permanent' })
    expect(interpretResendEvent({ type: 'email.bounced', data: { email_id: 'em_1' } })).toMatchObject({
      errorCode: 'bounce_unknown',
    })
    for (const [type, code] of [
      ['email.complained', 'complained'],
      ['email.failed', 'failed'],
      ['email.suppressed', 'suppressed'],
    ]) {
      expect(interpretResendEvent({ type, data: { email_id: 'em_1' } })).toEqual({
        kind: 'bounced',
        providerId: 'em_1',
        errorCode: code,
      })
    }
  })

  it('ignores everything else, including malformed payloads', () => {
    for (const payload of [
      { type: 'email.opened', data: { email_id: 'em_1' } },
      { type: 'email.sent', data: { email_id: 'em_1' } },
      { type: 'email.delivered', data: {} },
      { type: 'email.delivered', data: { email_id: '' } },
      { type: 5, data: { email_id: 'em_1' } },
      null,
      'text',
      undefined,
    ]) {
      expect(interpretResendEvent(payload)).toEqual({ kind: 'ignored' })
    }
  })

  it('keeps the error code short and safe', () => {
    const result = interpretResendEvent({
      type: 'email.bounced',
      data: { email_id: 'em_1', bounce: { type: 'Weird Type!!! with spaces and a very very long description' } },
    })
    expect(result).toMatchObject({ kind: 'bounced' })
    expect((result as { errorCode: string }).errorCode).toMatch(/^[a-z0-9_]{1,40}$/)
  })
})

describe('ResendWebhookController', () => {
  function build(options: { secret?: string; firstDelivery?: boolean; updateError?: Error } = {}) {
    const prisma = {
      accountMail: {
        updateMany: options.updateError
          ? jest.fn().mockRejectedValue(options.updateError)
          : jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const redis = {
      setIfAbsent: jest.fn().mockResolvedValue(options.firstDelivery ?? true),
      delete: jest.fn().mockResolvedValue(true),
    }
    const config = { get: jest.fn().mockReturnValue(options.secret === undefined ? SECRET : options.secret) }
    const controller = new ResendWebhookController(prisma as never, redis as never, config as never)
    return { controller, prisma, redis }
  }

  const request = (body: string) => ({ rawBody: Buffer.from(body) }) as never
  const signed = (id: string, body: string) => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    return { id, timestamp, signature: sign(id, timestamp, body) }
  }
  const deliver = (controller: ResendWebhookController, id: string, body: string) => {
    const headers = signed(id, body)
    return controller.receive(request(body), headers.id, headers.timestamp, headers.signature)
  }

  const delivered = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
  const bounced = JSON.stringify({ type: 'email.bounced', data: { email_id: 'em_1', bounce: { type: 'Permanent' } } })

  it('is invisible (404) until a secret is configured', async () => {
    const { controller } = build({ secret: '' })
    await expect(deliver(controller, 'msg_1', delivered)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects a bad signature before touching Redis or the database', async () => {
    const { controller, prisma, redis } = build()
    const headers = signed('msg_1', delivered)
    await expect(
      controller.receive(request(delivered), headers.id, headers.timestamp, 'v1,AAAA'),
    ).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(
      controller.receive({} as never, headers.id, headers.timestamp, headers.signature),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(redis.setIfAbsent).not.toHaveBeenCalled()
    expect(prisma.accountMail.updateMany).not.toHaveBeenCalled()
  })

  it('marks a sent mail delivered, only from the sent state', async () => {
    const { controller, prisma } = build()
    await expect(deliver(controller, 'msg_1', delivered)).resolves.toEqual({ ok: true })
    expect(prisma.accountMail.updateMany).toHaveBeenCalledWith({
      where: { providerId: 'em_1', status: 'sent' },
      data: { status: 'delivered', errorCode: null },
    })
  })

  it('marks a bounce from sent or delivered, never regressing it', async () => {
    const { controller, prisma } = build()
    await deliver(controller, 'msg_2', bounced)
    expect(prisma.accountMail.updateMany).toHaveBeenCalledWith({
      where: { providerId: 'em_1', status: { in: ['sent', 'delivered'] } },
      data: { status: 'bounced', errorCode: 'bounce_permanent' },
    })
  })

  it('processes each event id once (Resend retries)', async () => {
    const { controller, prisma } = build({ firstDelivery: false })
    await expect(deliver(controller, 'msg_1', delivered)).resolves.toEqual({ ok: true, duplicate: true })
    expect(prisma.accountMail.updateMany).not.toHaveBeenCalled()
  })

  it('accepts events it does not act on without touching the outbox', async () => {
    const { controller, prisma } = build()
    const opened = JSON.stringify({ type: 'email.opened', data: { email_id: 'em_1' } })
    await expect(deliver(controller, 'msg_3', opened)).resolves.toEqual({ ok: true })
    expect(prisma.accountMail.updateMany).not.toHaveBeenCalled()
  })

  it('forgets the dedupe marker and fails when the write fails, so Resend retries', async () => {
    const { controller, redis } = build({ updateError: new Error('db down') })
    await expect(deliver(controller, 'msg_4', delivered)).rejects.toThrow('db down')
    expect(redis.delete).toHaveBeenCalledWith('webhook:resend:msg_4')
  })
})
