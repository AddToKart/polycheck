import { Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AccountActivationService } from '../account-activation/account-activation.service'
import { PrismaService } from '../prisma/prisma.service'
import { buildActivationEmail } from './activation-email'
import { MailService } from './mail.service'
import { MailSendError } from './mail.types'

export const MAIL_MAX_ATTEMPTS = 5

/**
 * What happened to one outbox row:
 * `sent` delivered to the provider; `retry` a transient failure (row is back to
 * `queued`); `failed` permanently failed; `deferred` not attempted (mail not
 * configured or the daily budget is spent — the row stays `queued`);
 * `skipped` nothing to do (already handled or claimed by another worker).
 */
export type MailOutcome = 'sent' | 'retry' | 'failed' | 'deferred' | 'skipped'

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Sends one `AccountMail` row. The raw activation token is created here, at
 * send time, so it is never persisted and the link lifetime starts when the
 * email actually leaves. `queuedAt` doubles as "last state change": a claim and
 * a retry both refresh it, which lets the sweeper recover rows stuck in
 * `sending` after a crash without misreading a row that merely waited long.
 */
@Injectable()
export class AccountMailProcessor {
  private readonly logger = new Logger(AccountMailProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly activation: AccountActivationService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  dailyCap(): number {
    const raw = Number(this.config?.get('MAIL_DAILY_CAP') ?? process.env.MAIL_DAILY_CAP)
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100
  }

  /** Mails accepted by the provider since 00:00 UTC (Resend's daily quota boundary). */
  async sentToday(now = new Date()): Promise<number> {
    return this.prisma.accountMail.count({
      where: { status: 'sent', sentAt: { gte: startOfUtcDay(now) } },
    })
  }

  async capReached(now = new Date()): Promise<boolean> {
    return (await this.sentToday(now)) >= this.dailyCap()
  }

  async process(id: string): Promise<MailOutcome> {
    if (!this.mail.status().configured) return 'deferred'
    if (await this.capReached()) {
      this.logger.warn('Daily mail budget reached; activation mail stays queued until tomorrow (UTC)')
      return 'deferred'
    }

    const now = new Date()
    const claimed = await this.prisma.accountMail.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'sending', attempts: { increment: 1 }, queuedAt: now, errorCode: null },
    })
    if (claimed.count !== 1) return 'skipped'

    const row = await this.prisma.accountMail.findUnique({
      where: { id },
      select: { id: true, userId: true, kind: true, attempts: true },
    })
    if (!row) return 'skipped'
    if (row.kind !== 'activation') return this.fail(id, 'unsupported_kind')

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, activationPending: true },
    })
    if (!user || user.role !== 'student' || !user.isActive || !user.activationPending) {
      return this.fail(id, 'not_pending')
    }
    const to = user.email?.trim()
    if (!to) return this.fail(id, 'no_email')

    const issued = await this.activation.issueToken(user.id)
    if (!issued) return this.fail(id, 'not_pending')

    const link = `${this.frontendBase()}/activate#token=${issued.raw}`
    const email = buildActivationEmail({ fullName: user.fullName, link, expiresAt: issued.expiresAt })
    try {
      const result = await this.mail.send({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        // One key per attempt: a retry after a lost response must not be replayed
        // against a stale payload (each attempt mints a different link).
        idempotencyKey: `account-mail-${row.id}-${row.attempts}`,
      })
      await this.prisma.accountMail.update({
        where: { id },
        data: { status: 'sent', sentAt: new Date(), providerId: result.providerId, errorCode: null },
      })
      return 'sent'
    } catch (error) {
      const code = error instanceof MailSendError ? error.code : 'send_error'
      const retryable = error instanceof MailSendError ? error.retryable : true
      if (retryable && row.attempts < MAIL_MAX_ATTEMPTS) {
        await this.prisma.accountMail.update({
          where: { id },
          data: { status: 'queued', queuedAt: new Date(), errorCode: code },
        })
        return 'retry'
      }
      return this.fail(id, retryable ? 'max_attempts' : code)
    }
  }

  /**
   * Crash recovery: rows stuck in `sending` longer than ten minutes go back to
   * `queued` (the claim refreshes `queuedAt`, so this never touches a row that
   * is being sent right now).
   */
  async releaseStaleSending(now = new Date()): Promise<number> {
    const result = await this.prisma.accountMail.updateMany({
      where: { status: 'sending', queuedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
      data: { status: 'queued', queuedAt: now },
    })
    return result.count
  }

  /** Queued rows nobody has picked up for two minutes (a lost event or a restart). */
  async findOverdueQueued(now = new Date(), limit = 200): Promise<string[]> {
    const rows = await this.prisma.accountMail.findMany({
      where: { status: 'queued', queuedAt: { lt: new Date(now.getTime() - 2 * 60_000) } },
      orderBy: { queuedAt: 'asc' },
      take: limit,
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }

  private async fail(id: string, errorCode: string): Promise<MailOutcome> {
    await this.prisma.accountMail.update({ where: { id }, data: { status: 'failed', errorCode } })
    return 'failed'
  }

  private frontendBase(): string {
    const configured = this.config?.get<string>('FRONTEND_URL') ?? process.env.FRONTEND_URL ?? 'http://localhost:3000'
    return configured.trim().replace(/\/+$/, '')
  }
}
