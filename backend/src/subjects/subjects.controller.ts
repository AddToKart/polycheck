import { Controller, Get, Post, Patch, Delete, Body, Param, Request, HttpCode, HttpStatus } from '@nestjs/common'
import { SubjectsService } from './subjects.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateSubjectDto } from './dto/create-subject.dto'
import { UpdateSubjectDto } from './dto/update-subject.dto'

@Controller('subjects')
export class SubjectsController {
  constructor(private subjects: SubjectsService) {}

  @Get()
  findAll(@Request() req) {
    return this.subjects.findAll(req.user)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subjects.findOne(id)
  }

  @Post()
  @Roles('teacher', 'super_admin')
  create(@Body() dto: CreateSubjectDto, @Request() req) {
    return this.subjects.create(dto, req.user.id)
  }

  @Patch(':id')
  @Roles('teacher', 'super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjects.update(id, dto)
  }

  @Delete(':id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.subjects.remove(id)
  }
}
