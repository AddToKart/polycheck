import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Public } from './common/decorators/public.decorator'
import { PrismaService } from './prisma/prisma.service'
import { RedisService } from './infrastructure/redis.service'
import { ConfigService } from '@nestjs/config'
import { SkipThrottle } from '@nestjs/throttler'
import { MetricsService } from './observability/metrics.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
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
    this.metrics.setDependencyReady('database', checks.database === 'ok')

    const redisReady = await this.redis.ping()
    checks.redis = redisReady ? 'ok' : 'unavailable'
    if (this.config.get<string>('NODE_ENV') === 'production' && !redisReady) allReady = false
    this.metrics.setDependencyReady('redis', redisReady)

    const bullMq = this.metrics.getBullMqReadiness()
    checks.bullmqProducer = bullMq.configured ? (bullMq.producer ? 'ok' : 'unavailable') : 'disabled'
    checks.bullmqEvents = bullMq.configured ? (bullMq.events ? 'ok' : 'unavailable') : 'disabled'
    checks.bullmqWorker = bullMq.configured ? (bullMq.worker ? 'ok' : 'unavailable') : 'disabled'
    if (bullMq.configured && (!bullMq.producer || !bullMq.events || !bullMq.worker)) allReady = false

    this.metrics.setApplicationReady(allReady)

    const result = {
      status: allReady ? 'ok' : 'unavailable',
      timestamp: new Date().toISOString(),
      checks,
    }

    if (!allReady) throw new ServiceUnavailableException(result)
    return result
  }
}
