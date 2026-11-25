import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { hash } from '@node-rs/bcrypt'
import { timingSafeEqual } from 'node:crypto'
import { isStrongPassword, PASSWORD_HASH_COST } from '../auth/password-policy'
import { RedisService } from '../infrastructure/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../prisma/client'
import { SettingsService } from '../settings/settings.service'
import {
  ACTIVATION_MAX_FAILED_ATTEMPTS,
  DEFAULT_ACTIVATION_TTL_HOURS,
  generateActivationToken,
  hashActivationToken,
  looksLikeActivationToken,
  normalizeStudentNumber,
} from './activation-token'

export const ACCOUNT_MAIL_QUEUED_EVENT = 'account-mail.queued'

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

// Per-account resend caps (silent: the response never reveals them) and a generous
// per-IP cap, because phones on mobile data share carrier-grade NAT addresses.
const REQUEST_ACCOUNT_COOLDOWN_SECONDS = positiveInt(process.env.ACTIVATION_REQUEST_COOLDOWN_SECONDS, 180)
const REQUEST_ACCOUNT_LIMIT = positiveInt(process.env.ACTIVATION_REQUEST_ACCOUNT_LIMIT, 5)
const REQUEST_ACCOUNT_WINDOW_SECONDS = positiveInt(process.env.ACTIVATION_REQUEST_ACCOUNT_WINDOW, 86_400)
const REQUEST_IP_LIMIT = positiveInt(process.env.ACTIVATION_REQUEST_IP_LIMIT, 60)
const REQUEST_IP_WINDOW_SECONDS = positiveInt(process.env.ACTIVATION_REQUEST_IP_WINDOW, 3_600)
const COMPLETE_IP_LIMIT = positiveInt(process.env.ACTIVATION_COMPLETE_IP_LIMIT, 120)
const COMPLETE_TOKEN_LIMIT = positiveInt(process.env.ACTIVATION_COMPLETE_TOKEN_LIMIT, 30)
const COMPLETE_WINDOW_SECONDS = positiveInt(process.env.ACTIVATION_COMPLETE_WINDOW, 3_600)

export type ActivationValidateResult = { valid: true; expiresAt: string } | { valid: false }

export type ActivationCompleteResult = { ok: true; alreadyActivated?: true }

export class ActivationLinkInvalidError extends BadRequestException {
  constructor() {
    super({ code: 'activation_link_invalid', message: 'This activation link is no longer valid.' })
  }
}

export class ActivationRateLimitedError extends BadRequestException {
  constructor() {
    super({ code: 'activation_rate_limited', message: 'Too many attempts. Please wait a while and try again.' })
  }
}

type DbClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class AccountActivationService {
  private readonly logger = new Logger(AccountActivationService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  /** Link lifetime in hours (setting `activation_link_ttl_hours`, clamped 24-336). */
  async ttlHours(): Promise<number> {
    if (!this.settings) return DEFAULT_ACTIVATION_TTL_HOURS
    return this.settings.getInteger('activation_link_ttl_hours', DEFAULT_ACTIVATION_TTL_HOURS)
  }

  /**
   * Mint a fresh single-use token for a pending account, revoking every older
   * live one (one live token per account). Called by the mail worker at send
   * time, so the raw value is never stored and the lifetime starts when the
   * email actually goes out. Returns null when the account is not pending.
   */
  async issueToken(userId: string, db: DbClient = this.prisma): Promise<{ raw: string; expiresAt: Date } | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, activationPending: true },
    })
    if (!user || user.role !== 'student' || !user.isActive || !user.activationPending) return null

    const { raw, hash: tokenHash } = generateActivationToken()
    const expiresAt = new Date(Date.now() + (await this.ttlHours()) * 3_600_000)
    await db.accountActivationToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await db.accountActivationToken.create({ data: { userId, tokenHash, expiresAt } })
    return { raw, expiresAt }
  }

  /** Revoke every live token (password reset, admin action, completed activation). */
  async revokeAllForUser(userId: string, db: DbClient = this.prisma): Promise<number> {
    const result = await db.accountActivationToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return result.count
  }

  /**
   * Insert an outbox row for an activation email. The mail worker sends it; a
   * sweeper recovers rows whose event was lost. De-duplicates against an
   * in-flight row so repeated clicks cannot pile up mail for one account.
   */
  async queueActivationMail(
    userId: string,
    options: { batchId?: string | null; db?: DbClient; announce?: boolean } = {},
  ): Promise<{ id: string; created: boolean }> {
    const db = options.db ?? this.prisma
    const inFlight = await db.accountMail.findFirst({
      where: { userId, kind: 'activation', status: { in: ['queued', 'sending'] } },
      select: { id: true },
    })
    if (inFlight) return { id: inFlight.id, created: false }
    const row = await db.accountMail.create({
      data: { userId, kind: 'activation', status: 'queued', batchId: options.batchId ?? null },
      select: { id: true },
    })
    // Fire-and-forget: the sweeper re-queues anything this notification misses.
    // Rows created inside a caller's transaction are announced by the caller after commit.
    if (options.announce ?? !options.db) this.events?.emit(ACCOUNT_MAIL_QUEUED_EVENT, { id: row.id })
    return { id: row.id, created: true }
  }

  /** Tell the mail worker about rows created inside a caller's (now committed) transaction. */
  announceQueued(ids: readonly string[]): void {
    for (const id of ids) this.events?.emit(ACCOUNT_MAIL_QUEUED_EVENT, { id })
  }

  /** Does not consume the token. Anything unusable returns the same `{ valid: false }`. */
  async validate(rawToken: string, ip?: string): Promise<ActivationValidateResult> {
    await this.enforceCompleteLimits(rawToken, ip)
    if (!looksLikeActivationToken(rawToken)) return { valid: false }
    const row = await this.prisma.accountActivationToken.findUnique({
      where: { tokenHash: hashActivationToken(rawToken) },
      select: {
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        user: { select: { activationPending: true, isActive: true } },
      },
    })
    if (!row || row.usedAt || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return { valid: false }
    if (!row.user.activationPending || !row.user.isActive) return { valid: false }
    return { valid: true, expiresAt: row.expiresAt.toISOString() }
  }

  async complete(
    input: { token: string; studentId: string; password: string },
    ip?: string,
  ): Promise<ActivationCompleteResult> {
    await this.enforceCompleteLimits(input.token, ip)
    if (!looksLikeActivationToken(input.token)) throw new ActivationLinkInvalidError()
    const tokenHash = hashActivationToken(input.token)
    const row = await this.prisma.accountActivationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        failedAttempts: true,
        user: { select: { id: true, studentId: true, role: true, isActive: true, activationPending: true } },
      },
    })
    if (!row) throw new ActivationLinkInvalidError()

    // A retry after a lost response (flaky mobile data): the token was already
    // consumed, so say so without touching anything.
    if (row.usedAt && !row.revokedAt) return { ok: true, alreadyActivated: true }
    if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) throw new ActivationLinkInvalidError()
    if (!row.user.isActive || row.user.role !== 'student' || !row.user.activationPending) {
      throw new ActivationLinkInvalidError()
    }

    // Second factor: master-list emails can be wrong or shared, so the link
    // alone must not be enough.
    if (!this.studentNumbersMatch(input.studentId, row.user.studentId)) {
      await this.recordFailedAttempt(row.id)
      throw new BadRequestException({
        code: 'activation_student_number_mismatch',
        message: 'That student number does not match this activation link.',
      })
    }
    if (!isStrongPassword(input.password)) {
      throw new BadRequestException('Password does not meet the strength requirements')
    }

    // The expensive hash only runs after every cheap check passed.
    const passwordHash = await hash(input.password, { cost: PASSWORD_HASH_COST })
    const now = new Date()
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.accountActivationToken.updateMany({
        where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (claimed.count !== 1) return 'lost' as const
      const updated = await tx.user.updateMany({
        where: { id: row.userId, activationPending: true, isActive: true },
        data: {
          password: passwordHash,
          mustChangePassword: false,
          activationPending: false,
          authVersion: { increment: 1 },
        },
      })
      if (updated.count !== 1) throw new ActivationLinkInvalidError()
      await tx.authAccount.updateMany({
        where: { userId: row.userId, providerId: 'credential' },
        data: { password: passwordHash, updatedAt: now },
      })
      await tx.accountActivationToken.updateMany({
        where: { userId: row.userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      })
      await tx.authSession.deleteMany({ where: { userId: row.userId } })
      return 'activated' as const
    })

    if (outcome === 'lost') {
      // A concurrent double-tap won the claim; report it the same as a replay.
      const current = await this.prisma.accountActivationToken.findUnique({
        where: { tokenHash },
        select: { usedAt: true, revokedAt: true },
      })
      if (current?.usedAt && !current.revokedAt) return { ok: true, alreadyActivated: true }
      throw new ActivationLinkInvalidError()
    }

    await this.audit('account.activation_completed', row.userId, { via: 'email_link' })
    return { ok: true }
  }

  /**
   * Self-service resend for an expired/lost link. Always resolves the same way;
   * only a pending account whose stored email matches gets mail, and it goes to
   * the *stored* address, never the typed one.
   */
  async requestLink(input: { studentId: string; email: string }, ip?: string): Promise<{ ok: true }> {
    if (ip && this.redis) {
      const withinIpLimit = await this.redis.consumeRateLimit(
        `activation:request:ip:${ip}`,
        REQUEST_IP_LIMIT,
        REQUEST_IP_WINDOW_SECONDS,
      )
      if (!withinIpLimit) throw new ActivationRateLimitedError()
    }
    const studentId = normalizeStudentNumber(input.studentId)
    const email = input.email.trim().toLowerCase()

    const user = await this.prisma.user.findFirst({
      where: { studentId, role: 'student', activationPending: true, isActive: true },
      select: { id: true, email: true },
    })
    if (!user?.email || user.email.trim().toLowerCase() !== email) return { ok: true }

    // Per-account caps only count requests that would actually send mail, so a mistyped email
    // cannot burn a student's cooldown. Hitting a cap is indistinguishable from a normal accept.
    if (this.redis) {
      const cooled = await this.redis.consumeRateLimit(
        `activation:request:cooldown:${user.id}`,
        1,
        REQUEST_ACCOUNT_COOLDOWN_SECONDS,
      )
      const withinDaily = await this.redis.consumeRateLimit(
        `activation:request:daily:${user.id}`,
        REQUEST_ACCOUNT_LIMIT,
        REQUEST_ACCOUNT_WINDOW_SECONDS,
      )
      if (!cooled || !withinDaily) return { ok: true }
    }

    await this.queueActivationMail(user.id)
    await this.audit('account.activation_link_requested', user.id, { via: 'self_service' })
    return { ok: true }
  }

  private studentNumbersMatch(submitted: string, stored: string | null): boolean {
    if (!stored) return false
    const left = Buffer.from(normalizeStudentNumber(submitted))
    const right = Buffer.from(normalizeStudentNumber(stored))
    return left.length === right.length && timingSafeEqual(left, right)
  }

  private async recordFailedAttempt(tokenId: string): Promise<void> {
    try {
      const updated = await this.prisma.accountActivationToken.update({
        where: { id: tokenId },
        data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true, usedAt: true, revokedAt: true },
      })
      if (updated.failedAttempts >= ACTIVATION_MAX_FAILED_ATTEMPTS && !updated.usedAt && !updated.revokedAt) {
        await this.prisma.accountActivationToken.updateMany({
          where: { id: tokenId, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      }
    } catch (error) {
      this.logger.warn(
        `Could not record an activation attempt: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async enforceCompleteLimits(rawToken: string, ip?: string): Promise<void> {
    if (!this.redis) return
    if (ip) {
      const withinIp = await this.redis.consumeRateLimit(
        `activation:complete:ip:${ip}`,
        COMPLETE_IP_LIMIT,
        COMPLETE_WINDOW_SECONDS,
      )
      if (!withinIp) throw new ActivationRateLimitedError()
    }
    if (looksLikeActivationToken(rawToken)) {
      const withinToken = await this.redis.consumeRateLimit(
        `activation:complete:token:${hashActivationToken(rawToken).slice(0, 32)}`,
        COMPLETE_TOKEN_LIMIT,
        COMPLETE_WINDOW_SECONDS,
      )
      if (!withinToken) throw new ActivationRateLimitedError()
    }
  }

  /** Fail-open audit (the tamper-evident log must never block activation). Never records the token. */
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
