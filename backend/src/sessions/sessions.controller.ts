import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { RescheduleSessionDto } from './dto/reschedule-session.dto'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateSessionDto, ActivateSessionDto, CreateBulkSessionsDto } from './dto/create-session.dto'
import { SessionsService } from './sessions.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { BlocksArchivedSubject } from '../common/guards/archived-subject.guard'
import { parsePagination } from '../common/utils/pagination'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query('sectionId') sectionId?: string) {
    return this.sessions.findAll(req.user, sectionId)
  }

  @Get('page')
  findPage(
    @Request() req: AuthenticatedRequest,
    @Query('sectionId') sectionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sessions.findPage(req.user, sectionId, parsePagination(limit, offset))
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sessions.findOne(id, req.user)
  }

  @Post()
  @BlocksArchivedSubject('section', 'body.sectionId')
  @Roles('teacher', 'student')
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateSessionDto) {
    return this.sessions.create(dto, req.user)
  }

  @Patch(':id')
  @Roles('teacher')
  @BlocksArchivedSubject('session', 'params.id')
  reschedule(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RescheduleSessionDto) {
    return this.sessions.reschedule(id, dto, req.user)
  }

  @Post('bulk')
  @BlocksArchivedSubject('section', 'body.sectionId')
  @Roles('teacher')
  createBulk(@Request() req: AuthenticatedRequest, @Body() dto: CreateBulkSessionsDto) {
    return this.sessions.createBulk(dto, req.user)
  }

  @Post(':id/activate')
  @BlocksArchivedSubject('session', 'params.id')
  @Roles('teacher')
  activate(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ActivateSessionDto) {
    return this.sessions.activate(id, dto, req.user)
  }

  @Post(':id/end')
  @Roles('teacher')
  end(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sessions.end(id, req.user)
  }
}
