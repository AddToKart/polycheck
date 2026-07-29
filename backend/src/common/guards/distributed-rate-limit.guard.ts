import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ThrottlerException } from '@nestjs/throttler'
import { RedisService } from '../../infrastructure/redis.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import type { AuthenticatedRequest } from '../types/authenticated-request'

const REQUEST_LIMIT = 120
const WINDOW_SECONDS = 60

@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const withinLimit = await this.redis.consumeRateLimit(`api:user:${request.user.id}`, REQUEST_LIMIT, WINDOW_SECONDS)
    if (!withinLimit) throw new ThrottlerException()
    return true
  }
}
