import { ConflictException, type CallHandler, type ExecutionContext } from '@nestjs/common'
import { firstValueFrom, of, throwError } from 'rxjs'
import type { RedisService } from '../../infrastructure/redis.service'
import { IdempotencyInterceptor } from './idempotency.interceptor'

const request = {
  headers: { 'idempotency-key': 'request-1234' },
  method: 'POST',
  originalUrl: '/api/sessions',
  user: { id: 'teacher-1', role: 'teacher' },
}

describe('IdempotencyInterceptor', () => {
  let redis: {
    getJson: jest.Mock
    setIfAbsent: jest.Mock
    setJson: jest.Mock
    delete: jest.Mock
  }
  let interceptor: IdempotencyInterceptor
  let context: ExecutionContext

  beforeEach(() => {
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setIfAbsent: jest.fn().mockResolvedValue(true),
      setJson: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    interceptor = new IdempotencyInterceptor(redis as unknown as RedisService)
    context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
  })

  it('stores and returns the first successful mutation response', async () => {
    const next = { handle: jest.fn(() => of({ id: 'session-1' })) } as CallHandler
    const result = await firstValueFrom(await interceptor.intercept(context, next))

    expect(result).toEqual({ id: 'session-1' })
    expect(redis.setIfAbsent).toHaveBeenCalledTimes(1)
    expect(redis.setJson).toHaveBeenCalledWith(
      expect.stringContaining('idempotency:response:'),
      { body: { id: 'session-1' } },
      600,
    )
  })

  it('replays a completed response without executing the mutation again', async () => {
    redis.getJson.mockResolvedValueOnce({ body: { id: 'session-1' } })
    const next = { handle: jest.fn(() => of({ id: 'session-2' })) } as CallHandler
    const result = await firstValueFrom(await interceptor.intercept(context, next))

    expect(result).toEqual({ id: 'session-1' })
    expect(next.handle).not.toHaveBeenCalled()
  })

  it('rejects a duplicate request that is still in flight', async () => {
    redis.setIfAbsent.mockResolvedValueOnce(false)
    const next = { handle: jest.fn(() => of({ id: 'session-1' })) } as CallHandler

    await expect(interceptor.intercept(context, next)).rejects.toThrow(ConflictException)
    expect(next.handle).not.toHaveBeenCalled()
  })

  it('releases the lock when the mutation fails so it can be retried', async () => {
    const next = { handle: jest.fn(() => throwError(() => new Error('failed'))) } as CallHandler
    const stream = await interceptor.intercept(context, next)

    await expect(firstValueFrom(stream)).rejects.toThrow('failed')
    expect(redis.delete).toHaveBeenCalledWith(expect.stringContaining('idempotency:lock:'))
  })
})
