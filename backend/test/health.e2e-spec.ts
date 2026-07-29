import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { HealthController } from '../src/health.controller'
import { PrismaService } from '../src/prisma/prisma.service'
import { RedisService } from '../src/infrastructure/redis.service'
import { ConfigService } from '@nestjs/config'
import { MetricsService } from '../src/observability/metrics.service'

describe('Health endpoints (e2e)', () => {
  let app: INestApplication
  const prisma = { $queryRaw: jest.fn() }
  const redis = { ping: jest.fn() }
  const config = { get: jest.fn() }
  const metrics = {
    setDependencyReady: jest.fn(),
    setApplicationReady: jest.fn(),
    getBullMqReadiness: jest.fn(),
  }

  beforeEach(async () => {
    prisma.$queryRaw.mockResolvedValue([{ result: 1 }])
    redis.ping.mockResolvedValue(false)
    config.get.mockReturnValue('development')
    metrics.getBullMqReadiness.mockReturnValue({ configured: false, producer: false, events: false, worker: false })
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('serves the unversioned liveness route used by deployed clients', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(response.body.status).toBe('ok')
  })

  it('reports ready when PostgreSQL is reachable and tolerates optional Redis', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: expect.objectContaining({ database: 'ok', redis: 'unavailable' }),
      }),
    )
  })

  it('returns 503 when PostgreSQL is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'))
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503)
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        checks: expect.objectContaining({ database: 'unavailable', redis: 'unavailable' }),
      }),
    )
  })

  it('returns 503 in production when Redis is unavailable', async () => {
    config.get.mockReturnValue('production')
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503)
    expect(response.body.checks.redis).toBe('unavailable')
  })
})
