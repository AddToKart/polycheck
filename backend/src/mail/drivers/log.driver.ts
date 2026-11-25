import { Logger } from '@nestjs/common'
import type { MailDriver, MailMessage, MailSendResult } from '../mail.types'

/**
 * Development/E2E driver: writes the message to the server log instead of
 * sending it, so an activation link can be captured without a provider. Env
 * validation refuses this driver when NODE_ENV=production.
 */
export class LogMailDriver implements MailDriver {
  readonly name = 'log' as const
  private readonly logger = new Logger('MailLog')
  /** Last messages, newest last (tests and the dev smoke read this). */
  readonly sent: MailMessage[] = []

  async send(message: MailMessage): Promise<MailSendResult> {
    this.sent.push(message)
    if (this.sent.length > 50) this.sent.shift()
    this.logger.log(`[mail:log] to=${message.to} subject="${message.subject}"\n${message.text}`)
    return { providerId: `log-${message.idempotencyKey}` }
  }
}
