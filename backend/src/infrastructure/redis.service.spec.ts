import type { ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'

describe('RedisService', () => {
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService

  it('enforces rate limits with the in-process fallback when Redis is not configured', async () => {
    const service = new RedisService(config)

    await expect(service.consumeRateLimit('login:user', 2, 60)).resolves.toBe(true)
    await expect(service.consumeRateLimit('login:user', 2, 60)).resolves.toBe(true)
    await expect(service.consumeRateLimit('login:user', 2, 60)).resolves.toBe(false)
  })

  it('uses the numeric first transaction reply returned by node-redis', async () => {
    const service = new RedisService(config)
    const transaction = {
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([2, true]),
    }
    transaction.incr.mockReturnValue(transaction)
    transaction.expire.mockReturnValue(transaction)
    const client = { isReady: true, multi: jest.fn(() => transaction) }
    ;(service as unknown as { client: typeof client }).client = client

    await expect(service.consumeRateLimit('scan:user', 2, 60)).resolves.toBe(true)
    expect(transaction.exec).toHaveBeenCalledTimes(1)
  })

  it('actively pings Redis for readiness', async () => {
    const service = new RedisService(config)
    const client = { isReady: true, ping: jest.fn().mockResolvedValue('PONG') }
    ;(service as unknown as { client: typeof client }).client = client

    await expect(service.ping()).resolves.toBe(true)
    expect(client.ping).toHaveBeenCalledTimes(1)
  })

  it('provides expiring local storage for idempotency when Redis is unavailable', async () => {
    const service = new RedisService(config)

    await expect(service.setIfAbsent('request', '1', 60)).resolves.toBe(true)
    await expect(service.setIfAbsent('request', '1', 60)).resolves.toBe(false)
    await expect(service.setJson('response', { ok: true }, 60)).resolves.toBe(true)
    await expect(service.getJson('response')).resolves.toEqual({ ok: true })
    await service.delete('request')
    await expect(service.setIfAbsent('request', '1', 60)).resolves.toBe(true)
  })

  it('reports a successful delete when Redis is intentionally not configured', async () => {
    const service = new RedisService(config)

    await service.setJson('active-session:1', { isActive: true }, 60)

    await expect(service.delete('active-session:1')).resolves.toBe(true)
    await expect(service.getJson('active-session:1')).resolves.toBeNull()
  })

  it('reports a failed delete when configured Redis is disconnected', async () => {
    const configured = {
      get: jest.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined)),
    } as unknown as ConfigService
    const service = new RedisService(configured)

    await expect(service.delete('active-session:1')).resolves.toBe(false)
  })

  it('reports a failed delete when node-redis rejects the command', async () => {
    const configured = {
      get: jest.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined)),
    } as unknown as ConfigService
    const service = new RedisService(configured)
    const client = { isReady: true, del: jest.fn().mockRejectedValue(new Error('connection lost')) }
    ;(service as unknown as { client: typeof client }).client = client

    await expect(service.delete('active-session:1')).resolves.toBe(false)
    expect(client.del).toHaveBeenCalledWith('polycheck:active-session:1')
  })

  it('reports a failed distributed write while retaining the local fallback', async () => {
    const configured = {
      get: jest.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined)),
    } as unknown as ConfigService
    const service = new RedisService(configured)
    const client = { isReady: true, set: jest.fn().mockRejectedValue(new Error('connection lost')) }
    ;(service as unknown as { client: typeof client }).client = client

    await expect(service.setJson('active-session:1', { isActive: false }, 60)).resolves.toBe(false)
    await expect(service.getJson('active-session:1')).resolves.toEqual({ isActive: false })
  })

  it('releases a local lock only when the ownership token matches', async () => {
    const service = new RedisService(config)
    const ownershipToken = await service.acquireLock('maintenance', 60)

    expect(ownershipToken).not.toBeNull()
    await expect(service.acquireLock('maintenance', 60)).resolves.toBeNull()
    await expect(service.releaseLock('maintenance', 'not-the-owner')).resolves.toBe(false)
    await expect(service.acquireLock('maintenance', 60)).resolves.toBeNull()
    await expect(service.releaseLock('maintenance', ownershipToken!)).resolves.toBe(true)
    await expect(service.acquireLock('maintenance', 60)).resolves.not.toBeNull()
  })

  it('uses compare-and-delete Lua when releasing a Redis lock', async () => {
    const service = new RedisService(config)
    const client = { isReady: true, eval: jest.fn().mockResolvedValue(0) }
    ;(service as unknown as { client: typeof client }).client = client

    await expect(service.releaseLock('maintenance', 'owner-token')).resolves.toBe(false)
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"), {
      keys: ['polycheck:lock:maintenance'],
      arguments: ['owner-token'],
    })
  })
})
