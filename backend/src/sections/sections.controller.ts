import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, HttpCode, HttpStatus } from '@nestjs/common'
import { SectionsService } from './sections.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateSectionDto } from './dto/create-section.dto'
import { UpdateSectionDto } from './dto/update-section.dto'
import { EnrollViaCodeDto } from './dto/enroll-via-code.dto'
import { EnrollStudentDto } from './dto/enroll-student.dto'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('sections')
export class SectionsController {
  constructor(private sections: SectionsService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query('subjectId') subjectId?: string) {
    return this.sections.findAll(req.user, subjectId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.sections.findOne(id, req.user)
  }

  @Post()
  @Roles('teacher')
  create(@Body() dto: CreateSectionDto, @Request() req: AuthenticatedRequest) {
    return this.sections.create(dto, req.user)
  }

  @Post('enroll-by-code')
  @Roles('student')
  enrollByCode(@Body() dto: EnrollViaCodeDto, @Request() req: AuthenticatedRequest) {
    return this.sections.enrollByCode(req.user.id, dto.enrollmentCode)
  }

  @Patch(':id')
  @Roles('teacher')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto, @Request() req: AuthenticatedRequest) {
    return this.sections.update(id, dto, req.user)
  }

  @Delete(':id')
  @Roles('teacher')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.sections.remove(id, req.user)
  }

  @Get(':id/students')
  @Roles('teacher', 'super_admin')
  getStudents(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.sections.getStudents(id, req.user)
  }

  @Post(':id/enroll')
  @Roles('student')
  enrollViaCode(@Param('id') id: string, @Body() dto: EnrollViaCodeDto, @Request() req: AuthenticatedRequest) {
    return this.sections.enrollViaCode(id, req.user.id, dto.enrollmentCode)
  }

  @Post(':id/enroll-student')
  @Roles('teacher')
  enrollStudent(@Param('id') id: string, @Body() dto: EnrollStudentDto, @Request() req: AuthenticatedRequest) {
    return this.sections.enrollStudent(id, req.user.id, dto.studentId, dto.studentName)
  }

  @Delete(':id/students/:studentId')
  @Roles('teacher')
  removeStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Request() req: AuthenticatedRequest) {
    return this.sections.removeStudent(id, req.user.id, studentId)
  }

  @Post(':id/enrollment-code/reset')
  @Roles('teacher')
  resetEnrollmentCode(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.sections.resetEnrollmentCode(id, req.user.id)
  }

  @Post(':id/enrollment-code/disable')
  @Roles('teacher')
  disableEnrollmentCode(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.sections.disableEnrollmentCode(id, req.user.id)
  }

  @Get(':id/enrollments')
  @Roles('teacher', 'super_admin')
  getEnrollments(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.sections.getEnrollments(id, req.user)
  }
}
