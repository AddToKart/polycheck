import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { hash } from '@node-rs/bcrypt'
import { randomUUID } from 'node:crypto'
import { ACCOUNT_MAIL_QUEUED_EVENT } from '../account-activation/account-activation.service'
import {
  generateActivationToken,
  hashActivationToken,
  looksLikeActivationToken,
  normalizeStudentNumber,
} from '../account-activation/activation-token'
import { isStrongPassword, PASSWORD_HASH_COST } from '../auth/password-policy'
import { RedisService } from '../infrastructure/redis.service'
import { isMailDeliverable } from '../mail/mail-config'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../prisma/client'

export const PASSWORD_RESET_MAIL_KIND = 'password_reset'

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/** Link lifetime. Short on purpose: it grants a password change. */
export const PASSWORD_RESET_TTL_MINUTES = positiveInt(process.env.PASSWORD_RESET_TTL_MINUTES, 60)
// Per-account caps are silent (the response never reveals them). The per-IP cap is generous because phones on
// mobile data share carrier-grade NAT addresses.
const REQUEST_ACCOUNT_COOLDOWN_SECONDS = positiveInt(process.env.PASSWORD_RESET_COOLDOWN_SECONDS, 300)
const REQUEST_ACCOUNT_LIMIT = positiveInt(process.env.PASSWORD_RESET_ACCOUNT_LIMIT, 5)
const REQUEST_ACCOUNT_WINDOW_SECONDS = positiveInt(process.env.PASSWORD_RESET_ACCOUNT_WINDOW, 86_400)
const REQUEST_IP_LIMIT = positiveInt(process.env.PASSWORD_RESET_REQUEST_IP_LIMIT, 40)
const REQUEST_IP_WINDOW_SECONDS = positiveInt(process.env.PASSWORD_RESET_REQUEST_IP_WINDOW, 3_600)
const COMPLETE_IP_LIMIT = positiveInt(process.env.PASSWORD_RESET_COMPLETE_IP_LIMIT, 120)
const COMPLETE_TOKEN_LIMIT = positiveInt(process.env.PASSWORD_RESET_COMPLETE_TOKEN_LIMIT, 30)
const COMPLETE_WINDOW_SECONDS = positiveInt(process.env.PASSWORD_RESET_COMPLETE_WINDOW, 3_600)

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * `email` - a reset link was (or already recently was) sent to the bound address.
 * `unavailable` - no usable bound email for that student number (unknown number, nothing bound, inactive or
 * not yet activated account, or mail not configured). The unknown-number and the nothing-bound cases return
 * this same value, so the endpoint does not confirm whether a student number exists.
 */
export type PasswordResetRequestResult = { ok: true; delivery: 'email' | 'unavailable' }
export type PasswordResetValidateResult = { valid: boolean }
export type PasswordResetCompleteResult = { ok: true; alreadyReset?: true }

export class PasswordResetLinkInvalidError extends BadRequestException {
  constructor() {
    super({ code: 'password_reset_link_invalid', message: 'This reset link is no longer valid. Request a new one.' })
  }
}

export class PasswordResetRateLimitedError extends HttpException {
  constructor() {
    super(
      { code: 'password_reset_rate_limited', message: 'Too many attempts. Please wait a while and try again.' },
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }
}

type DbClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly events?: EventEmitter2,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private mailDeliverable(): boolean {
    return isMailDeliverable((key) => this.config?.get<string>(key) ?? process.env[key])
  }

  /**
   * Ask for a reset link by student number. The link only ever goes to the email the student bound on their
   * own profile, never to anything typed here.
   */
  async request(rawStudentId: string, ip?: string): Promise<PasswordResetRequestResult> {
    if (ip && this.redis) {
      const withinIp = await this.redis.consumeRateLimit(
        `password-reset:request:ip:${ip}`,
        REQUEST_IP_LIMIT,
        REQUEST_IP_WINDOW_SECONDS,
      )
      if (!withinIp) throw new PasswordResetRateLimitedError()
    }
    const studentId = normalizeStudentNumber(rawStudentId)
    const user = await this.prisma.user.findFirst({
      where: { studentId, role: 'student', isActive: true, activationPending: false },
      select: { id: true, contactEmail: true },
    })
    const bound = user?.contactEmail?.trim() ?? ''
    if (!user || !EMAIL_SHAPE.test(bound) || !this.mailDeliverable()) {
      return { ok: true, delivery: 'unavailable' }
    }

    // Caps only count requests that would send mail. Hitting one still answers "email": a link was
    // already sent a moment ago, and the response must not reveal the limiter.
    if (this.redis) {
      const cooled = await this.redis.consumeRateLimit(
        `password-reset:request:cooldown:${user.id}`,
        1,
        REQUEST_ACCOUNT_COOLDOWN_SECONDS,
      )
      const withinDaily = await this.redis.consumeRateLimit(
        `password-reset:request:daily:${user.id}`,
        REQUEST_ACCOUNT_LIMIT,
        REQUEST_ACCOUNT_WINDOW_SECONDS,
      )
      if (!cooled || !withinDaily) return { ok: true, delivery: 'email' }
    }

    await this.queueResetMail(user.id)
    await this.audit('account.password_reset_requested', user.id, { via: 'self_service' })
    return { ok: true, delivery: 'email' }
  }

  /** Outbox row for the mail worker (de-duplicated against an in-flight one). */
  async queueResetMail(userId: string, db: DbClient = this.prisma): Promise<{ id: string; created: boolean }> {
    const inFlight = await db.accountMail.findFirst({
      where: { userId, kind: PASSWORD_RESET_MAIL_KIND, status: { in: ['queued', 'sending'] } },
      select: { id: true },
    })
    if (inFlight) return { id: inFlight.id, created: false }
    const row = await db.accountMail.create({
      data: { userId, kind: PASSWORD_RESET_MAIL_KIND, status: 'queued' },
      select: { id: true },
    })
    this.events?.emit(ACCOUNT_MAIL_QUEUED_EVENT, { id: row.id })
    return { id: row.id, created: true }
  }

  /**
   * Mint a fresh single-use token for an eligible account, revoking every older live one. Called by the mail
   * worker at send time, so the raw value is never stored and the lifetime starts when the email leaves.
   */
  async issueToken(userId: string, db: DbClient = this.prisma): Promise<{ raw: string; expiresAt: Date } | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, activationPending: true },
    })
    if (!user || user.role !== 'student' || !user.isActive || user.activationPending) return null

    const { raw, hash: tokenHash } = generateActivationToken()
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000)
    await db.passwordResetToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await db.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } })
    return { raw, expiresAt }
  }

  /** Does not consume the token. Anything unusable is the same `{ valid: false }`. */
  async validate(rawToken: string, ip?: string): Promise<PasswordResetValidateResult> {
    await this.enforceCompleteLimits(rawToken, ip)
    if (!looksLikeActivationToken(rawToken)) return { valid: false }
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashActivationToken(rawToken) },
      select: { expiresAt: true, usedAt: true, revokedAt: true, user: { select: { isActive: true } } },
    })
    if (!row || row.usedAt || row.revokedAt || row.expiresAt.getTime() <= Date.now() || !row.user.isActive) {
      return { valid: false }
    }
    return { valid: true }
  }

  async complete(input: { token: string; password: string }, ip?: string): Promise<PasswordResetCompleteResult> {
    await this.enforceCompleteLimits(input.token, ip)
    if (!looksLikeActivationToken(input.token)) throw new PasswordResetLinkInvalidError()
    const tokenHash = hashActivationToken(input.token)
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        user: { select: { role: true, isActive: true, activationPending: true } },
      },
    })
    if (!row) throw new PasswordResetLinkInvalidError()

    // A retry after a lost response (flaky mobile data): already consumed, so report success without touching anything.
    if (row.usedAt && !row.revokedAt) return { ok: true, alreadyReset: true }
    if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) throw new PasswordResetLinkInvalidError()
    if (!row.user.isActive || row.user.role !== 'student' || row.user.activationPending) {
      throw new PasswordResetLinkInvalidError()
    }
    if (!isStrongPassword(input.password)) {
      throw new BadRequestException('Password does not meet the strength requirements')
    }

    // The expensive hash only runs after every cheap check passed.
    const passwordHash = await hash(input.password, { cost: PASSWORD_HASH_COST })
    const now = new Date()
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (claimed.count !== 1) return 'lost' as const
      const updated = await tx.user.updateMany({
        where: { id: row.userId, isActive: true, role: 'student', activationPending: false },
        data: { password: passwordHash, mustChangePassword: false, authVersion: { increment: 1 } },
      })
      if (updated.count !== 1) throw new PasswordResetLinkInvalidError()
      await tx.authAccount.upsert({
        where: { providerId_accountId: { providerId: 'credential', accountId: row.userId } },
        update: { password: passwordHash, updatedAt: now },
        create: {
          id: randomUUID(),
          accountId: row.userId,
          providerId: 'credential',
          userId: row.userId,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      })
      await tx.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      })
      // Every signed-in device ends: whoever held the old password must not keep a session.
      await tx.authSession.deleteMany({ where: { userId: row.userId } })
      return 'reset' as const
    })

    if (outcome === 'lost') {
      // A concurrent double-tap won the claim; report it the same as a replay.
      const current = await this.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { usedAt: true, revokedAt: true },
      })
      if (current?.usedAt && !current.revokedAt) return { ok: true, alreadyReset: true }
      throw new PasswordResetLinkInvalidError()
    }

    this.events?.emit('auth.session-replaced', { userId: row.userId, reason: 'password_reset' })
    await this.audit('account.password_reset_completed', row.userId, { via: 'email_link' })
    try {
      await this.notifications?.notify(row.userId, {
        type: 'password_reset',
        title: 'Your password was changed',
        body: 'Your password was reset from an email link. If this was not you, ask your instructor for help right away.',
        link: '/login',
      })
    } catch (error) {
      this.logger.warn(`Could not notify ${row.userId}: ${error instanceof Error ? error.message : String(error)}`)
    }
    return { ok: true }
  }

  private async enforceCompleteLimits(rawToken: string, ip?: string): Promise<void> {
    if (!this.redis) return
    if (ip) {
      const withinIp = await this.redis.consumeRateLimit(
        `password-reset:complete:ip:${ip}`,
        COMPLETE_IP_LIMIT,
        COMPLETE_WINDOW_SECONDS,
      )
      if (!withinIp) throw new PasswordResetRateLimitedError()
    }
    if (looksLikeActivationToken(rawToken)) {
      const withinToken = await this.redis.consumeRateLimit(
        `password-reset:complete:token:${hashActivationToken(rawToken).slice(0, 32)}`,
        COMPLETE_TOKEN_LIMIT,
        COMPLETE_WINDOW_SECONDS,
      )
      if (!withinToken) throw new PasswordResetRateLimitedError()
    }
  }

  /** Fail-open audit (the tamper-evident log must never block a reset). Never records the token. */
  private async audit(action: string, userId: string, metadata: Prisma.InputJsonValue): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId: userId, actorRole: 'student', action, entityType: 'user', entityId: userId, metadata },
      })
    } catch (error) {
      this.logger.error(
        `Could not write ${action} audit row for ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
