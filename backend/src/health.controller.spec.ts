import { ServiceUnavailableException } from '@nestjs/common'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('reports ready only when required production dependencies are available', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const redis = { isAvailable: jest.fn().mockReturnValue(true) }
    const config = { get: jest.fn().mockReturnValue('production') }
    const controller = new HealthController(prisma as never, redis as never, config as never)

    await expect(controller.readiness()).resolves.toEqual(
      expect.objectContaining({ status: 'ok', checks: { database: 'ok', redis: 'ok' } }),
    )
  })

  it('fails production readiness when Redis is unavailable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const redis = { isAvailable: jest.fn().mockReturnValue(false) }
    const config = { get: jest.fn().mockReturnValue('production') }
    const controller = new HealthController(prisma as never, redis as never, config as never)

    await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException)
  })
})
