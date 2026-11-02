import { Controller, Get, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { StandingService } from './standing.service'

@Controller('me')
export class StandingController {
  constructor(private readonly standing: StandingService) {}

  @Get('standing')
  @Roles('student')
  standingForStudent(@Request() req: AuthenticatedRequest) {
    return this.standing.forStudent(req.user)
  }
}
