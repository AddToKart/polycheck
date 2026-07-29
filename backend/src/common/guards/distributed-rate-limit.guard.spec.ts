import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { ThrottlerException } from '@nestjs/throttler'
import type { RedisService } from '../../infrastructure/redis.service'
import { DistributedRateLimitGuard } from './distributed-rate-limit.guard'

const context = (userId = 'user-1') =>
  ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
  }) as unknown as ExecutionContext

describe('DistributedRateLimitGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector
  const redis = { consumeRateLimit: jest.fn() } as unknown as RedisService
  const guard = new DistributedRateLimitGuard(reflector, redis)

  beforeEach(() => jest.clearAllMocks())

  it('skips public endpoints', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true)

    await expect(guard.canActivate(context())).resolves.toBe(true)
    expect(redis.consumeRateLimit).not.toHaveBeenCalled()
  })

  it('uses a distributed per-user limit', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false)
    jest.spyOn(redis, 'consumeRateLimit').mockResolvedValue(true)

    await expect(guard.canActivate(context('student-1'))).resolves.toBe(true)
    expect(redis.consumeRateLimit).toHaveBeenCalledWith('api:user:student-1', 120, 60)
  })

  it('rejects requests beyond the limit', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false)
    jest.spyOn(redis, 'consumeRateLimit').mockResolvedValue(false)

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ThrottlerException)
  })
})
