import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DESIGNATION_LABELS, hasDesignation, type FacultyDesignation } from '@polycheck/shared'
import type { RequestUser } from '../../auth/authenticated-principal'
import { REQUIRED_DESIGNATIONS_KEY } from '../decorators/require-designation.decorator'

/**
 * Enforces administrative designations on widened suite routes.
 *
 * Runs immediately after `RolesGuard`: routes annotate both
 * `@Roles('super_admin', 'teacher')` and `@RequireDesignation(...)` so the
 * route is reachable by super admins and by teachers holding the designation
 * only. Any other authenticated actor gets a typed 403.
 */
@Injectable()
export class DesignationsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<FacultyDesignation[]>(REQUIRED_DESIGNATIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const { user } = context.switchToHttp().getRequest<{ user?: RequestUser }>()
    if (!user) throw new ForbiddenException('No user in request')
    if (user.role === 'super_admin') return true

    const missing = required.filter((designation) => !hasDesignation(user, designation))
    if (missing.length === 0) return true

    const labels = missing.map((designation) => DESIGNATION_LABELS[designation]).join(' / ')
    throw new ForbiddenException({
      message: `This action requires the ${labels} designation`,
      code: 'designation_required',
      designation: missing[0],
    })
  }
}
