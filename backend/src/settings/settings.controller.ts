import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Put, Request } from '@nestjs/common'
import { IsString, MaxLength } from 'class-validator'
import { isMaintenanceSettingKey } from '@polycheck/shared'
import { Roles } from '../common/decorators/roles.decorator'
import { RequireDesignation } from '../common/decorators/require-designation.decorator'
import { SettingsService } from './settings.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

class SetSettingDto {
  @IsString() @MaxLength(2_000) value!: string
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Roles('teacher', 'super_admin')
  list() {
    return this.settings.list()
  }

  /**
   * Super admins keep full institution-scoped writes. IT coordinators may only
   * write the three maintenance keys — academic and AI settings remain outside
   * their separation-of-duties boundary.
   */
  @Put(':key')
  @Roles('teacher', 'super_admin')
  @RequireDesignation('it_operations')
  set(@Request() req: AuthenticatedRequest, @Param('key') key: string, @Body() dto: SetSettingDto) {
    if (!/^[a-z0-9._-]{1,100}$/i.test(key)) throw new BadRequestException('Invalid setting key')
    const isInstitutionSuperAdmin = req.user.role === 'super_admin' && req.user.scope === 'institution'
    const maintenanceWrite = isMaintenanceSettingKey(key)
    const allowed = maintenanceWrite ? req.user.role === 'teacher' || isInstitutionSuperAdmin : isInstitutionSuperAdmin
    if (!allowed) {
      throw new ForbiddenException('Only institution administrators can change institution settings')
    }
    return this.settings.set(key, dto.value, req.user.id, { role: req.user.role, ip: req.ip })
  }
}
