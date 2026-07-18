import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import type { Observable } from 'rxjs'
import { catchError, from, map, mergeMap, of, throwError } from 'rxjs'
import { createHash } from 'crypto'
import type { Response } from 'express'
import type { RequestUser } from '../../auth/authenticated-principal'
import { ErrorCode } from '../constants/error-codes'
import { RedisService } from '../../infrastructure/redis.service'

const IDEMPOTENCY_TTL_SECONDS = 10 * 60
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const VALID_KEY = /^[A-Za-z0-9._:-]{8,128}$/

interface IdempotentRequest {
  headers: Record<string, string | string[] | undefined>
  method: string
  originalUrl: string
  body?: unknown
  user?: RequestUser
}

interface StoredResponse {
  body: unknown
  fingerprint: string
  statusCode: number
  contentType?: string
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<IdempotentRequest>()
    const response = context.switchToHttp().getResponse<Response>()
    if (!MUTATING_METHODS.has(request.method)) return next.handle()

    const keyHeader = request.headers['idempotency-key']
    const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader
    if (!key) return next.handle()
    if (!VALID_KEY.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key must be 8-128 letters, numbers, dots, colons, underscores, or hyphens',
      )
    }
    if (!request.user) return next.handle()

    const namespace = `${request.user.id}:${request.method}:${request.originalUrl}:${key}`
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(request.body ?? null))
      .digest('hex')
    const responseKey = `idempotency:response:${namespace}`
    const lockKey = `idempotency:lock:${namespace}`
    const stored = await this.redis.getJson<StoredResponse>(responseKey)
    if (stored) {
      if (stored.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used with a different request payload')
      }
      response.status(stored.statusCode)
      if (stored.contentType) response.type(stored.contentType)
      return of(stored.body)
    }

    const acquired = await this.redis.setIfAbsent(lockKey, JSON.stringify({ fingerprint }), IDEMPOTENCY_TTL_SECONDS)
    if (!acquired) {
      const completed = await this.redis.getJson<StoredResponse>(responseKey)
      if (completed) {
        if (completed.fingerprint !== fingerprint) {
          throw new ConflictException('Idempotency-Key was already used with a different request payload')
        }
        response.status(completed.statusCode)
        if (completed.contentType) response.type(completed.contentType)
        return of(completed.body)
      }
      const inFlight = await this.redis.getJson<{ fingerprint: string }>(lockKey)
      if (inFlight && inFlight.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key is processing a different request payload')
      }
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: ErrorCode.IDEMPOTENCY_REPLAY,
        message: 'A request with this Idempotency-Key is already being processed',
      })
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.redis
            .setJson(
              responseKey,
              {
                body,
                fingerprint,
                statusCode: response.statusCode,
                contentType: response.getHeader('content-type')?.toString(),
              },
              IDEMPOTENCY_TTL_SECONDS,
            )
            .then(() => this.redis.delete(lockKey)),
        ).pipe(map(() => body)),
      ),
      catchError((error: unknown) => from(this.redis.delete(lockKey)).pipe(mergeMap(() => throwError(() => error)))),
    )
  }
}
