import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DEFAULT_MAINTENANCE_MESSAGE, type MaintenanceStatus } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator'
import { SystemMaintenanceService } from './system-maintenance.service'

/**
 * Global maintenance shield.
 *
 * Registered between `PasswordChangeGuard` and `DistributedRateLimitGuard`:
 * after authentication (so the actor is known), before rate limiting (so
 * blocked users never consume login/sync budget), before role/designation
 * guards (so no suite is reachable while the institution is closed).
 *
 * `@Public()` routes (health probes, logins, the public status endpoint,
 * privacy notice) skip this guard; login endpoints enforce the same rule
 * inside `AuthService` after credential validation.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly maintenance: SystemMaintenanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>()
    if (this.maintenance.bypasses(request.user)) return true

    let status: MaintenanceStatus
    try {
      status = await this.maintenance.current()
    } catch (error) {
      // Defensive: `current()` already fails open, but a guard must never turn
      // an internal memo/cache bug into an outage of its own.
      this.logger.error(
        `Maintenance state check failed; allowing request: ${error instanceof Error ? error.message : String(error)}`,
      )
      return true
    }
    if (!status.enabled) return true

    throw new ServiceUnavailableException({
      code: 'system_maintenance',
      message: status.message ?? DEFAULT_MAINTENANCE_MESSAGE,
      ...(status.estimatedEnd ? { estimatedEnd: status.estimatedEnd } : {}),
    })
  }
}
