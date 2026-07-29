import { ServiceUnavailableException } from '@nestjs/common'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('reports ready only when required production dependencies are available', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const redis = { ping: jest.fn().mockResolvedValue(true) }
    const config = { get: jest.fn().mockReturnValue('production') }
    const metrics = readyMetrics()
    const controller = new HealthController(prisma as never, redis as never, config as never, metrics as never)

    await expect(controller.readiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: {
          database: 'ok',
          redis: 'ok',
          bullmqProducer: 'ok',
          bullmqEvents: 'ok',
          bullmqWorker: 'ok',
        },
      }),
    )
  })

  it('fails production readiness when Redis is unavailable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const redis = { ping: jest.fn().mockResolvedValue(false) }
    const config = { get: jest.fn().mockReturnValue('production') }
    const controller = new HealthController(prisma as never, redis as never, config as never, readyMetrics() as never)

    await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException)
  })

  it('fails readiness when a configured BullMQ component is unavailable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const redis = { ping: jest.fn().mockResolvedValue(true) }
    const config = { get: jest.fn().mockReturnValue('development') }
    const metrics = readyMetrics()
    metrics.getBullMqReadiness.mockReturnValue({ configured: true, producer: true, events: true, worker: false })
    const controller = new HealthController(prisma as never, redis as never, config as never, metrics as never)

    await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException)
    expect(metrics.setApplicationReady).toHaveBeenCalledWith(false)
  })
})

function readyMetrics() {
  return {
    setDependencyReady: jest.fn(),
    setApplicationReady: jest.fn(),
    getBullMqReadiness: jest.fn().mockReturnValue({
      configured: true,
      producer: true,
      events: true,
      worker: true,
    }),
  }
}
