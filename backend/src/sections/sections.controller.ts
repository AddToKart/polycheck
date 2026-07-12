import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, HttpCode, HttpStatus } from '@nestjs/common'
import { SectionsService } from './sections.service'
import { Roles } from '../common/decorators/roles.decorator'
import type { CreateSectionDto } from './dto/create-section.dto'
import type { UpdateSectionDto } from './dto/update-section.dto'
import type { EnrollViaCodeDto } from './dto/enroll-via-code.dto'
import type { EnrollStudentDto } from './dto/enroll-student.dto'

@Controller('sections')
export class SectionsController {
  constructor(private sections: SectionsService) {}

  @Get()
  findAll(@Request() req, @Query('subjectId') subjectId?: string) {
    return this.sections.findAll(req.user, subjectId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.sections.findOne(id, req.user)
  }

  @Post()
  @Roles('teacher')
  create(@Body() dto: CreateSectionDto, @Request() req) {
    return this.sections.create(dto, req.user)
  }

  @Post('enroll-by-code')
  @Roles('student')
  enrollByCode(@Body() dto: EnrollViaCodeDto, @Request() req) {
    return this.sections.enrollByCode(req.user.id, dto.enrollmentCode)
  }

  @Patch(':id')
  @Roles('teacher', 'super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto, @Request() req) {
    return this.sections.update(id, dto, req.user)
  }

  @Delete(':id')
  @Roles('teacher', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.sections.remove(id, req.user)
  }

  @Get(':id/students')
  @Roles('teacher', 'super_admin')
  getStudents(@Param('id') id: string, @Request() req) {
    return this.sections.getStudents(id, req.user)
  }

  @Post(':id/enroll')
  @Roles('student')
  enrollViaCode(@Param('id') id: string, @Body() dto: EnrollViaCodeDto, @Request() req) {
    return this.sections.enrollViaCode(id, req.user.id, dto.enrollmentCode)
  }

  @Post(':id/enroll-student')
  @Roles('teacher')
  enrollStudent(@Param('id') id: string, @Body() dto: EnrollStudentDto, @Request() req) {
    return this.sections.enrollStudent(id, req.user.id, dto.studentId, dto.studentName)
  }

  @Delete(':id/students/:studentId')
  @Roles('teacher')
  removeStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Request() req) {
    return this.sections.removeStudent(id, req.user.id, studentId)
  }

  @Post(':id/enrollment-code/reset')
  @Roles('teacher')
  resetEnrollmentCode(@Param('id') id: string, @Request() req) {
    return this.sections.resetEnrollmentCode(id, req.user.id)
  }

  @Post(':id/enrollment-code/disable')
  @Roles('teacher')
  disableEnrollmentCode(@Param('id') id: string, @Request() req) {
    return this.sections.disableEnrollmentCode(id, req.user.id)
  }

  @Get(':id/enrollments')
  @Roles('teacher', 'super_admin')
  getEnrollments(@Param('id') id: string, @Request() req) {
    return this.sections.getEnrollments(id, req.user)
  }
}
