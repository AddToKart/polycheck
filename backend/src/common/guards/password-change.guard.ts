import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { ErrorCode } from '../constants/error-codes'
import type { AuthenticatedRequest } from '../types/authenticated-request'

/**
 * Central enforcement for forced first-login password rotation. Registered
 * after SessionAuthGuard and before role/rate-limit guards so every protected
 * route returns the same machine-readable 403 marker until the user changes
 * their temporary password.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (allowed) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user?.mustChangePassword) return true

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: ErrorCode.PASSWORD_CHANGE_REQUIRED,
      message: 'Change your temporary password before continuing.',
    })
  }
}
