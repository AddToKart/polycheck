import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { REQUIRES_PRIVACY_CONSENT_KEY } from '../decorators/privacy-consent.decorator'
import type { AuthenticatedRequest } from '../types/authenticated-request'

@Injectable()
export class PrivacyConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_PRIVACY_CONSENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required) return true

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user
    if (user.role !== 'student') return true
    const currentVersion = this.config.getOrThrow<string>('PRIVACY_NOTICE_VERSION')
    if (user.privacyConsentVersion === currentVersion && user.privacyConsentedAt) return true

    throw new ForbiddenException('Privacy consent is required before submitting location evidence')
  }
}
