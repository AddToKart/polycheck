import { Controller, Get, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { SectionsService } from './sections.service'

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  @Roles('student', 'teacher', 'super_admin')
  findAll(@Request() req: AuthenticatedRequest) {
    return this.sections.findEnrollments(req.user)
  }
}
