export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
  /** Provider-side de-duplication (Resend keeps keys for 24 h). */
  idempotencyKey: string
}

export interface MailSendResult {
  /** Provider message id, when the provider returned one. */
  providerId: string | null
}

export type MailDriverName = 'resend' | 'log' | 'disabled'

/**
 * A send failure the worker can reason about. `code` is a short machine value
 * (never a provider response body); `retryable` follows the provider guidance
 * (retry only on rate limits and 5xx / network errors).
 */
export class MailSendError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(`Mail send failed: ${code}`)
    this.name = 'MailSendError'
  }
}

export interface MailDriver {
  readonly name: MailDriverName
  send(message: MailMessage): Promise<MailSendResult>
}
