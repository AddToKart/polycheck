import { UnauthorizedException } from '@nestjs/common'
import { MetricsController } from './metrics.controller'

describe('MetricsController', () => {
  const token = 'm'.repeat(32)
  const metrics = { contentType: 'text/plain', metrics: jest.fn().mockResolvedValue('# metrics') }
  const response = { setHeader: jest.fn() }

  beforeEach(() => jest.clearAllMocks())

  it('requires the production bearer token', async () => {
    const config = { get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : token)) }
    const controller = new MetricsController(metrics as never, config as never)

    await expect(controller.metrics(undefined, response as never)).rejects.toThrow(UnauthorizedException)
    await expect(controller.metrics('Bearer wrong-token', response as never)).rejects.toThrow(UnauthorizedException)
    await expect(controller.metrics(`Bearer ${token}`, response as never)).resolves.toBe('# metrics')
  })

  it('allows unauthenticated development scrapes', async () => {
    const config = { get: jest.fn().mockReturnValue('development') }
    const controller = new MetricsController(metrics as never, config as never)

    await expect(controller.metrics(undefined, response as never)).resolves.toBe('# metrics')
  })
})
