import { MailSendError, type MailDriver, type MailMessage, type MailSendResult } from '../mail.types'

export interface ResendDriverOptions {
  apiKey: string
  from: string
  replyTo?: string
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Resend over plain HTTPS (no SDK dependency). The API key travels only in the
 * Authorization header; provider response bodies are never copied into errors
 * or logs — only a status-derived code.
 */
export class ResendMailDriver implements MailDriver {
  readonly name = 'resend' as const

  constructor(private readonly options: ResendDriverOptions) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const fetchImpl = this.options.fetchImpl ?? fetch
    let response: Response
    try {
      response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(this.options.replyTo ? { reply_to: this.options.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
      })
    } catch {
      throw new MailSendError('resend_network_error', true)
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { id?: unknown } | null
      return { providerId: typeof body?.id === 'string' ? body.id : null }
    }
    // 429 and 5xx are retryable; a 409 idempotency conflict or a 4xx validation error is not.
    const retryable = response.status === 429 || response.status >= 500
    throw new MailSendError(`resend_${response.status}`, retryable)
  }
}
