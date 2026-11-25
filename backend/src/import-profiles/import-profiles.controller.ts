import { Body, Controller, Get, Put, Query, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { ImportProfileQueryDto, UpsertImportProfileDto } from './dto/import-profile.dto'
import { ImportProfilesService } from './import-profiles.service'

@Controller('import-profiles')
export class ImportProfilesController {
  constructor(private readonly profiles: ImportProfilesService) {}

  @Get()
  @Roles('teacher', 'super_admin')
  find(@Query() query: ImportProfileQueryDto, @Request() req: AuthenticatedRequest) {
    return this.profiles.find(req.user, query.mode, query.fingerprint)
  }

  @Put()
  @Roles('teacher', 'super_admin')
  save(@Body() dto: UpsertImportProfileDto, @Request() req: AuthenticatedRequest) {
    return this.profiles.save(req.user, dto)
  }
}
