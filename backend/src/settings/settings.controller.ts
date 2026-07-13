import { Body, Controller, Get, Param, Put, Request } from '@nestjs/common'
import { IsString, MaxLength } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { SettingsService } from './settings.service'

class SetSettingDto {
  @IsString() @MaxLength(2_000) value: string
}

@Controller('settings')
@Roles('super_admin')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list() { return this.settings.list() }

  @Put(':key')
  set(@Request() req, @Param('key') key: string, @Body() dto: SetSettingDto) {
    return this.settings.set(key, dto.value, req.user.id)
  }
}
