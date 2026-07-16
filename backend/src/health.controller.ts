import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Public } from './common/decorators/public.decorator'
import { PrismaService } from './prisma/prisma.service'
import { RedisService } from './infrastructure/redis.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  @Public()
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

    checks.redis = this.redis.isAvailable() ? 'ok' : 'degraded'

    const result = {
      status: allReady ? 'ok' : 'unavailable',
      timestamp: new Date().toISOString(),
      checks,
    }

    if (!allReady) throw new ServiceUnavailableException(result)
    return result
  }
}
