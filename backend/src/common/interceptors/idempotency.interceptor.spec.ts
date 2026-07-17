import { ConflictException, type CallHandler, type ExecutionContext } from '@nestjs/common'
import { firstValueFrom, of, throwError } from 'rxjs'
import type { RedisService } from '../../infrastructure/redis.service'
import { IdempotencyInterceptor } from './idempotency.interceptor'
import { createHash } from 'crypto'

const request = {
  headers: { 'idempotency-key': 'request-1234' },
  method: 'POST',
  originalUrl: '/api/sessions',
  body: { sectionId: 'sec-1' },
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
  let response: { statusCode: number; status: jest.Mock; type: jest.Mock; getHeader: jest.Mock }

  beforeEach(() => {
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setIfAbsent: jest.fn().mockResolvedValue(true),
      setJson: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    interceptor = new IdempotencyInterceptor(redis as unknown as RedisService)
    response = {
      statusCode: 201,
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      getHeader: jest.fn().mockReturnValue('application/json'),
    }
    context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext
  })

  it('stores and returns the first successful mutation response', async () => {
    const next = { handle: jest.fn(() => of({ id: 'session-1' })) } as CallHandler
    const result = await firstValueFrom(await interceptor.intercept(context, next))

    expect(result).toEqual({ id: 'session-1' })
    expect(redis.setIfAbsent).toHaveBeenCalledTimes(1)
    expect(redis.setJson).toHaveBeenCalledWith(
      expect.stringContaining('idempotency:response:'),
      expect.objectContaining({ body: { id: 'session-1' }, statusCode: 201, contentType: 'application/json' }),
      600,
    )
  })

  it('replays a completed response without executing the mutation again', async () => {
    const fingerprint = createHash('sha256').update(JSON.stringify(request.body)).digest('hex')
    redis.getJson.mockResolvedValueOnce({
      body: { id: 'session-1' },
      fingerprint,
      statusCode: 201,
      contentType: 'application/json',
    })
    const next = { handle: jest.fn(() => of({ id: 'session-2' })) } as CallHandler
    const result = await firstValueFrom(await interceptor.intercept(context, next))

    expect(result).toEqual({ id: 'session-1' })
    expect(next.handle).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(201)
  })

  it('rejects reuse of a completed key with a different request body', async () => {
    redis.getJson.mockResolvedValueOnce({
      body: { id: 'session-1' },
      fingerprint: 'different-fingerprint',
      statusCode: 201,
    })
    const next = { handle: jest.fn(() => of({ id: 'session-2' })) } as CallHandler

    await expect(interceptor.intercept(context, next)).rejects.toThrow(ConflictException)
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
