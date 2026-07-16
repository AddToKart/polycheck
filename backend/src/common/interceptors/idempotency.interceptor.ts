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
import type { RequestUser } from '../../auth/strategies/jwt.strategy'
import { ErrorCode } from '../constants/error-codes'
import { RedisService } from '../../infrastructure/redis.service'

const IDEMPOTENCY_TTL_SECONDS = 10 * 60
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const VALID_KEY = /^[A-Za-z0-9._:-]{8,128}$/

interface IdempotentRequest {
  headers: Record<string, string | string[] | undefined>
  method: string
  originalUrl: string
  user?: RequestUser
}

interface StoredResponse {
  body: unknown
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<IdempotentRequest>()
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
    const responseKey = `idempotency:response:${namespace}`
    const lockKey = `idempotency:lock:${namespace}`
    const stored = await this.redis.getJson<StoredResponse>(responseKey)
    if (stored) return of(stored.body)

    const acquired = await this.redis.setIfAbsent(lockKey, '1', IDEMPOTENCY_TTL_SECONDS)
    if (!acquired) {
      const completed = await this.redis.getJson<StoredResponse>(responseKey)
      if (completed) return of(completed.body)
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: ErrorCode.IDEMPOTENCY_REPLAY,
        message: 'A request with this Idempotency-Key is already being processed',
      })
    }

    return next.handle().pipe(
      mergeMap((body) =>
        from(this.redis.setJson(responseKey, { body }, IDEMPOTENCY_TTL_SECONDS)).pipe(map(() => body)),
      ),
      catchError((error: unknown) => from(this.redis.delete(lockKey)).pipe(mergeMap(() => throwError(() => error)))),
    )
  }
}
