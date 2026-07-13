import { Body, Controller, Get, Param, Post, Query, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateSessionDto, ActivateSessionDto, CreateBulkSessionsDto } from './dto/create-session.dto'
import { SessionsService } from './sessions.service'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  findAll(@Request() req, @Query('sectionId') sectionId?: string) { return this.sessions.findAll(req.user, sectionId) }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) { return this.sessions.findOne(id, req.user) }

  @Post()
  @Roles('teacher', 'student')
  create(@Request() req, @Body() dto: CreateSessionDto) { return this.sessions.create(dto, req.user) }

  @Post('bulk')
  @Roles('teacher')
  createBulk(@Request() req, @Body() dto: CreateBulkSessionsDto) { return this.sessions.createBulk(dto, req.user) }

  @Post(':id/activate')
  @Roles('teacher')
  activate(@Request() req, @Param('id') id: string, @Body() dto: ActivateSessionDto) { return this.sessions.activate(id, dto, req.user) }

  @Post(':id/end')
  @Roles('teacher')
  end(@Request() req, @Param('id') id: string) { return this.sessions.end(id, req.user) }
}
