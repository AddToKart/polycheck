import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Put, Request } from '@nestjs/common'
import { IsString, MaxLength } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { SettingsService } from './settings.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

class SetSettingDto {
  @IsString() @MaxLength(2_000) value!: string
}

@Controller('settings')
@Roles('super_admin')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list() {
    return this.settings.list()
  }

  @Put(':key')
  set(@Request() req: AuthenticatedRequest, @Param('key') key: string, @Body() dto: SetSettingDto) {
    if (req.user.scope !== 'institution') {
      throw new ForbiddenException('Only institution administrators can change institution settings')
    }
    if (!/^[a-z0-9._-]{1,100}$/i.test(key)) throw new BadRequestException('Invalid setting key')
    return this.settings.set(key, dto.value, req.user.id)
  }
}
