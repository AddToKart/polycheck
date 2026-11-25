import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Svix-style webhook signature verification (the scheme Resend uses).
 *
 * Signed content is `${svix-id}.${svix-timestamp}.${rawBody}` signed with
 * HMAC-SHA256 using the base64-decoded secret (the `whsec_` prefix is not part of
 * the key). The `svix-signature` header carries one or more space-separated
 * `v1,<base64>` values; any matching one is accepted. A timestamp tolerance
 * rejects replays of old captures.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300

export interface SvixHeaders {
  id: string | undefined
  timestamp: string | undefined
  signature: string | undefined
}

export function verifySvixSignature(options: {
  secret: string
  headers: SvixHeaders
  rawBody: Buffer | string
  now?: number
  toleranceSeconds?: number
}): boolean {
  const { id, timestamp, signature } = options.headers
  if (!id || !timestamp || !signature) return false

  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt)) return false
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000)
  if (Math.abs(nowSeconds - sentAt) > (options.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS)) return false

  const key = Buffer.from(options.secret.replace(/^whsec_/, ''), 'base64')
  if (key.length === 0) return false
  const body = typeof options.rawBody === 'string' ? options.rawBody : options.rawBody.toString('utf8')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()

  return signature.split(' ').some((candidate) => {
    const [version, value] = candidate.split(',')
    if (version !== 'v1' || !value) return false
    const received = Buffer.from(value, 'base64')
    return received.length === expected.length && timingSafeEqual(received, expected)
  })
}

export type MailEventOutcome =
  | { kind: 'delivered'; providerId: string }
  | { kind: 'bounced'; providerId: string; errorCode: string }
  | { kind: 'ignored' }

const BOUNCE_EVENTS = new Set(['email.bounced', 'email.failed', 'email.suppressed', 'email.complained'])

/** Map a Resend event to what it means for an outbox row. Unknown or malformed events are ignored. */
export function interpretResendEvent(payload: unknown): MailEventOutcome {
  if (!payload || typeof payload !== 'object') return { kind: 'ignored' }
  const event = payload as { type?: unknown; data?: { email_id?: unknown; bounce?: { type?: unknown } } }
  const providerId = event.data?.email_id
  if (typeof event.type !== 'string' || typeof providerId !== 'string' || providerId.length === 0) {
    return { kind: 'ignored' }
  }
  if (event.type === 'email.delivered') return { kind: 'delivered', providerId }
  if (BOUNCE_EVENTS.has(event.type)) {
    const bounceType = typeof event.data?.bounce?.type === 'string' ? event.data.bounce.type : undefined
    const reason =
      event.type === 'email.bounced' ? `bounce_${bounceType ?? 'unknown'}` : event.type.replace('email.', '')
    return {
      kind: 'bounced',
      providerId,
      errorCode: reason
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .slice(0, 40),
    }
  }
  return { kind: 'ignored' }
}
