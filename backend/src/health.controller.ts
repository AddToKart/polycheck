import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Public } from './common/decorators/public.decorator'
import { PrismaService } from './prisma/prisma.service'
import { RedisService } from './infrastructure/redis.service'
import { ConfigService } from '@nestjs/config'
import { SkipThrottle } from '@nestjs/throttler'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  @Public()
  @SkipThrottle()
  @Get('ready')
  async readiness() {
    const checks: Record<string, string> = {}
    let allReady = true

    try {
      await this.prisma.$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch {
      checks.database = 'unavailable'
      allReady = false
    }

    const redisReady = this.redis.isAvailable()
    checks.redis = redisReady ? 'ok' : 'unavailable'
    if (this.config.get<string>('NODE_ENV') === 'production' && !redisReady) allReady = false

    const result = {
      status: allReady ? 'ok' : 'unavailable',
      timestamp: new Date().toISOString(),
      checks,
    }

    if (!allReady) throw new ServiceUnavailableException(result)
    return result
  }
}
