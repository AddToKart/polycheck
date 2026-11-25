import { Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DisabledMailDriver } from './drivers/disabled.driver'
import { LogMailDriver } from './drivers/log.driver'
import { ResendMailDriver } from './drivers/resend.driver'
import type { MailDriver, MailDriverName, MailMessage, MailSendResult } from './mail.types'

export interface MailStatus {
  driver: MailDriverName
  /** True when the driver can actually deliver (resend with key + sender, or log). */
  configured: boolean
}

/**
 * Provider-agnostic mail facade. The driver is chosen once from the
 * environment; a misconfigured `resend` falls back to `disabled` (and says so
 * in the log) rather than half-working.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly driver: MailDriver

  constructor(@Optional() config?: ConfigService) {
    const read = (key: string) => config?.get<string>(key) ?? process.env[key]
    const requested = (read('MAIL_DRIVER') ?? 'disabled').trim().toLowerCase()
    const apiKey = read('RESEND_API_KEY')?.trim()
    const from = read('MAIL_FROM')?.trim()
    const replyTo = read('MAIL_REPLY_TO')?.trim()

    if (requested === 'resend') {
      if (apiKey && from) {
        this.driver = new ResendMailDriver({ apiKey, from, replyTo: replyTo || undefined })
      } else {
        this.logger.warn('MAIL_DRIVER=resend needs RESEND_API_KEY and MAIL_FROM; mail is disabled')
        this.driver = new DisabledMailDriver()
      }
    } else if (requested === 'log') {
      this.driver = new LogMailDriver()
    } else {
      this.driver = new DisabledMailDriver()
    }
  }

  status(): MailStatus {
    return { driver: this.driver.name, configured: this.driver.name !== 'disabled' }
  }

  send(message: MailMessage): Promise<MailSendResult> {
    return this.driver.send(message)
  }

  /** Test seam / dev smoke: the log driver's captured messages. */
  capturedMessages(): MailMessage[] {
    return this.driver instanceof LogMailDriver ? this.driver.sent : []
  }
}
