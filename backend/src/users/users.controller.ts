import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { UsersService } from './users.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateStudentDto, CreateTeacherDto, ResetPasswordDto, SetUserStatusDto } from './dto/manage-user.dto'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { parsePagination } from '../common/utils/pagination'

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles('super_admin')
  findAll(@Request() req: AuthenticatedRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.users.findAll(req.user, parsePagination(limit, offset))
  }

  @Get('teachers')
  @Roles('super_admin')
  findTeachers(@Request() req: AuthenticatedRequest) {
    return this.users.findTeachers(req.user)
  }

  @Get('students')
  @Roles('teacher', 'super_admin')
  findStudents(@Request() req: AuthenticatedRequest) {
    return this.users.findStudents(req.user)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.users.findOne(id, req.user)
  }

  @Post('teachers')
  @Roles('super_admin')
  createTeacher(@Body() dto: CreateTeacherDto, @Request() req: AuthenticatedRequest) {
    return this.users.createTeacher(dto, req.user)
  }

  @Post('students')
  @Roles('super_admin')
  createStudent(@Body() dto: CreateStudentDto, @Request() req: AuthenticatedRequest) {
    return this.users.createStudent(dto, req.user)
  }

  @Patch(':id/password')
  @Roles('super_admin')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @Request() req: AuthenticatedRequest) {
    return this.users.resetPassword(id, dto.password, req.user)
  }

  @Patch(':id/status')
  @Roles('super_admin')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto, @Request() req: AuthenticatedRequest) {
    return this.users.setStatus(id, dto.isActive, req.user)
  }
}
