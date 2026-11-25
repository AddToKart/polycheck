import { MailSendError, type MailDriver, type MailSendResult } from '../mail.types'

/** Default when no provider is configured: refuses every send, non-retryably. */
export class DisabledMailDriver implements MailDriver {
  readonly name = 'disabled' as const

  async send(): Promise<MailSendResult> {
    throw new MailSendError('mail_disabled', false)
  }
}
