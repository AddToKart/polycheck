import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AI_TERMS_REQUIRED_CODE,
  AI_TERMS_REQUIRED_MESSAGE,
  AI_TERMS_VERSION,
  type AiCapabilities,
  type AiDailyUsage,
  type AiLimitRole,
} from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { RedisService } from '../infrastructure/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { AiAuditService } from './ai-audit.service'
import { campusDayWindow, resolveDailyLimit } from './ai-limits'
import { AiProviderService } from './ai-provider.service'

export const AI_DAILY_LIMIT_CODE = 'ai_daily_limit'
const COUNTER_TTL_SECONDS = 24 * 60 * 60

/** Who may send a message: accepted terms, and messages left today. */
@Injectable()
export class AiAccessService {
  constructor(
    private readonly provider: AiProviderService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
    private readonly audit: AiAuditService,
    private readonly config: ConfigService,
  ) {}

  /** What the assistant screen needs: availability, consent and today's allowance. */
  async capabilities(user: RequestUser): Promise<AiCapabilities> {
    const base = await this.provider.describe(user)
    if (!base.enabled) return base
    const [accepted, usage] = await Promise.all([this.hasAcceptedTerms(user.id), this.usage(user)])
    return { ...base, terms: { version: AI_TERMS_VERSION, accepted }, usage }
  }

  async acceptTerms(user: RequestUser, version: string): Promise<AiCapabilities> {
    if (version !== AI_TERMS_VERSION) {
      throw new ConflictException('The AI terms have changed. Reload the assistant and read the new version.')
    }
    if (!(await this.hasAcceptedTerms(user.id))) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { aiTermsVersion: version, aiTermsAcceptedAt: new Date() },
      })
      await this.audit.recordTermsAccepted(user, version)
    }
    return this.capabilities(user)
  }

  async assertTermsAccepted(userId: string): Promise<void> {
    if (await this.hasAcceptedTerms(userId)) return
    throw new ForbiddenException({ message: AI_TERMS_REQUIRED_MESSAGE, code: AI_TERMS_REQUIRED_CODE })
  }

  async usage(user: RequestUser): Promise<AiDailyUsage> {
    const { day, resetsAt } = campusDayWindow()
    const [limit, counted] = await Promise.all([
      this.limitFor(user),
      this.redis.readRateLimit(this.counterKey(user.id, day)),
    ])
    const used = Math.min(counted, limit)
    return { limit, used, remaining: limit - used, resetsAt }
  }

  /**
   * Takes one message from today's allowance. The returned function gives it
   * back, for a message that never got a reply. A refused message is not counted,
   * so raising the limit later takes effect at once.
   */
  async reserveMessage(user: RequestUser): Promise<() => Promise<void>> {
    const limit = await this.limitFor(user)
    const key = this.counterKey(user.id, campusDayWindow().day)
    const allowed = await this.redis.consumeRateLimit(key, limit, COUNTER_TTL_SECONDS)
    if (!allowed) {
      await this.redis.releaseRateLimit(key)
      throw new HttpException(
        {
          message: `Daily assistant limit reached (${limit} ${limit === 1 ? 'message' : 'messages'}). It starts again at midnight.`,
          code: AI_DAILY_LIMIT_CODE,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    let returned = false
    return async () => {
      if (returned) return
      returned = true
      await this.redis.releaseRateLimit(key)
    }
  }

  private async hasAcceptedTerms(userId: string): Promise<boolean> {
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { aiTermsVersion: true } })
    return account?.aiTermsVersion === AI_TERMS_VERSION
  }

  private limitFor(user: RequestUser) {
    return resolveDailyLimit(this.settings, this.config, user.role as AiLimitRole)
  }

  private counterKey(userId: string, day: string) {
    return `ai:chat:${userId}:${day}`
  }
}
