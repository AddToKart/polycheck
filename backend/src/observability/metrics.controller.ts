import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SkipThrottle } from '@nestjs/throttler'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Response } from 'express'
import { Public } from '../common/decorators/public.decorator'
import { MetricsService } from './metrics.service'

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  async metrics(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', this.metricsService.contentType)
    if (this.config.get<string>('NODE_ENV') === 'production' && !this.validToken(authorization)) {
      response.setHeader('WWW-Authenticate', 'Bearer')
      throw new UnauthorizedException()
    }
    return this.metricsService.metrics()
  }

  private validToken(authorization: string | undefined) {
    const match = authorization?.match(/^Bearer ([^\s]+)$/i)
    const supplied = match?.[1] ?? ''
    const expected = this.config.get<string>('METRICS_TOKEN') ?? ''
    const suppliedDigest = createHash('sha256').update(supplied).digest()
    const expectedDigest = createHash('sha256').update(expected).digest()
    return expected.length >= 32 && timingSafeEqual(suppliedDigest, expectedDigest)
  }
}
