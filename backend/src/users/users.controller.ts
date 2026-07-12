import { Controller, Get, Param, Request } from '@nestjs/common'
import { UsersService } from './users.service'
import { Roles } from '../common/decorators/roles.decorator'

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
}
