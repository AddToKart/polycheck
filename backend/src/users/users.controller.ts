import { Body, Controller, Get, Param, Patch, Post, Request } from '@nestjs/common'
import { UsersService } from './users.service'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateTeacherDto, SetUserStatusDto } from './dto/manage-user.dto'

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles('super_admin')
  findAll(@Request() req) {
    return this.users.findAll(req.user)
  }

  @Get('teachers')
  @Roles('super_admin')
  findTeachers(@Request() req) {
    return this.users.findTeachers(req.user)
  }

  @Get('students')
  @Roles('teacher', 'super_admin')
  findStudents(@Request() req) {
    return this.users.findStudents(req.user)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.users.findOne(id, req.user)
  }

  @Post('teachers')
  @Roles('super_admin')
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.users.createTeacher(dto)
  }

  @Patch(':id/status')
  @Roles('super_admin')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto) {
    return this.users.setStatus(id, dto.isActive)
  }
}
