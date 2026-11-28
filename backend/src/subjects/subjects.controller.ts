import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, HttpCode, HttpStatus } from '@nestjs/common'
import { BlocksArchivedSubject } from '../common/guards/archived-subject.guard'
import { SubjectLifecycleService } from './subject-lifecycle.service'
import { DeleteArchivedSubjectDto } from './dto/delete-archived-subject.dto'
import { SubjectsService } from './subjects.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateSubjectDto } from './dto/create-subject.dto'
import { UpdateSubjectDto } from './dto/update-subject.dto'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('subjects')
export class SubjectsController {
  constructor(
    private subjects: SubjectsService,
    private lifecycles: SubjectLifecycleService,
  ) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query('archived') archived?: string) {
    return this.subjects.findAll(req.user, archived === 'true')
  }

  @Get(':id/lifecycle')
  @Roles('teacher', 'super_admin')
  lifecycle(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.lifecycles.lifecycle(id, req.user)
  }

  @Post(':id/archive')
  @Roles('teacher')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.lifecycles.archive(id, req.user)
  }

  @Post(':id/restore')
  @Roles('teacher')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.lifecycles.restore(id, req.user)
  }

  @Post(':id/delete-permanently')
  @Roles('teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePermanently(
    @Param('id') id: string,
    @Body() dto: DeleteArchivedSubjectDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.lifecycles.deletePermanently(id, req.user, dto.confirmCode)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.subjects.findOne(id, req.user)
  }

  @Post()
  @Roles('teacher')
  create(@Body() dto: CreateSubjectDto, @Request() req: AuthenticatedRequest) {
    return this.subjects.create(dto, req.user)
  }

  @Patch(':id')
  @Roles('teacher')
  @BlocksArchivedSubject('subject', 'params.id')
  update(@Param('id') id: string, @Body() dto: UpdateSubjectDto, @Request() req: AuthenticatedRequest) {
    return this.subjects.update(id, dto, req.user)
  }

  @Delete(':id')
  @Roles('teacher')
  @BlocksArchivedSubject('subject', 'params.id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.subjects.remove(id, req.user)
  }
}
