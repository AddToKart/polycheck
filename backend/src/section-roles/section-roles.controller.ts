import { Body, Controller, Delete, Get, Param, Post, Request } from '@nestjs/common'
import { IsIn, IsString } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { SectionRolesService } from './section-roles.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

class AssignRoleDto {
  @IsString() sectionId!: string
  @IsString() studentId!: string
  @IsIn(['president', 'qac']) role!: 'president' | 'qac'
}

@Controller('section-roles')
export class SectionRolesController {
  constructor(private readonly roles: SectionRolesService) {}

  @Get(':sectionId')
  getForSection(@Request() req: AuthenticatedRequest, @Param('sectionId') id: string) {
    return this.roles.getForSection(req.user, id)
  }

  @Get('student/:studentId')
  getForStudent(@Request() req: AuthenticatedRequest, @Param('studentId') id: string) {
    return this.roles.getForStudent(req.user, id)
  }

  @Post()
  @Roles('teacher')
  assign(@Request() req: AuthenticatedRequest, @Body() dto: AssignRoleDto) {
    return this.roles.assign(req.user, dto)
  }

  @Delete(':sectionId/:studentId/:role')
  @Roles('teacher')
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Param('studentId') studentId: string,
    @Param('role') role: 'president' | 'qac',
  ) {
    return this.roles.remove(req.user, sectionId, studentId, role)
  }
}
