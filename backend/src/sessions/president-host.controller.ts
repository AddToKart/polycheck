import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { BlocksArchivedSubject } from '../common/guards/archived-subject.guard'
import { HostStartDto } from './dto/host-session.dto'
import { PresidentHostService } from './president-host.service'

/** A section president's own session. Professors keep using `SessionsController`. */
@Controller('sessions/:id/host')
export class PresidentHostController {
  constructor(private readonly host: PresidentHostService) {}

  @Get()
  @Roles('student')
  state(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.host.state(id, req.user)
  }

  @Post('start')
  @BlocksArchivedSubject('session', 'params.id')
  @Roles('student')
  start(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: HostStartDto) {
    return this.host.start(id, dto, req.user)
  }

  @Post('end')
  @Roles('student')
  end(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.host.end(id, req.user)
  }
}
