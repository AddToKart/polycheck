import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SessionAuthenticator } from '../../auth/session-authenticator.service'
import { toWebHeaders } from '../../auth/http-headers'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionAuthenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    request.user = await this.sessionAuthenticator.authenticate(toWebHeaders(request.headers))
    return true
  }
}
