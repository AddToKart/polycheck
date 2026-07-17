import { Controller, Get, Post, Patch, Delete, Body, Param, Request, HttpCode, HttpStatus } from '@nestjs/common'
import { SubjectsService } from './subjects.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateSubjectDto } from './dto/create-subject.dto'
import { UpdateSubjectDto } from './dto/update-subject.dto'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('subjects')
export class SubjectsController {
  constructor(private subjects: SubjectsService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.subjects.findAll(req.user)
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
  update(@Param('id') id: string, @Body() dto: UpdateSubjectDto, @Request() req: AuthenticatedRequest) {
    return this.subjects.update(id, dto, req.user)
  }

  @Delete(':id')
  @Roles('teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.subjects.remove(id, req.user)
  }
}
