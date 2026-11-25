import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request } from 'express'
import { Public } from '../common/decorators/public.decorator'
import { RedisService } from '../infrastructure/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import { interpretResendEvent, verifySvixSignature } from './resend-webhook'

type RawBodyRequest = Request & { rawBody?: Buffer }

/**
 * Delivery receipts from Resend. Inert (404) until `RESEND_WEBHOOK_SECRET` is set. Every request must carry a
 * valid Svix signature over the raw body inside the timestamp window; each event id is processed once.
 * Status moves only forward: sent → delivered, and sent/delivered → bounced (never back).
 */
@Controller('webhooks')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('resend')
  async receive(
    @Req() req: RawBodyRequest,
    @Headers('svix-id') id?: string,
    @Headers('svix-timestamp') timestamp?: string,
    @Headers('svix-signature') signature?: string,
  ) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET')?.trim()
    if (!secret) throw new NotFoundException()
    if (!req.rawBody) throw new BadRequestException('Missing request body')
    if (!verifySvixSignature({ secret, headers: { id, timestamp, signature }, rawBody: req.rawBody })) {
      throw new UnauthorizedException('Invalid signature')
    }

    // Resend retries; the unique event id makes processing idempotent.
    const firstDelivery = await this.redis.setIfAbsent(`webhook:resend:${id}`, '1', 86_400)
    if (!firstDelivery) return { ok: true, duplicate: true }

    let payload: unknown
    try {
      payload = JSON.parse(req.rawBody.toString('utf8'))
    } catch {
      throw new BadRequestException('Malformed body')
    }
    const outcome = interpretResendEvent(payload)
    if (outcome.kind === 'ignored') return { ok: true }

    try {
      if (outcome.kind === 'delivered') {
        await this.prisma.accountMail.updateMany({
          where: { providerId: outcome.providerId, status: 'sent' },
          data: { status: 'delivered', errorCode: null },
        })
      } else {
        await this.prisma.accountMail.updateMany({
          where: { providerId: outcome.providerId, status: { in: ['sent', 'delivered'] } },
          data: { status: 'bounced', errorCode: outcome.errorCode },
        })
      }
    } catch (error) {
      // Let Resend retry: forget the dedupe marker so the next attempt is processed.
      await this.redis.delete(`webhook:resend:${id}`).catch(() => undefined)
      this.logger.error(`Could not record a mail event: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
    return { ok: true }
  }
}
