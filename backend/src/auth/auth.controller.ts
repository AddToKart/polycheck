import { Controller, Post, Get, Body, Request } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginStudentDto } from './dto/login-student.dto'
import { LoginFacultyDto } from './dto/login-faculty.dto'
import { ProvisionKeyDto } from './dto/provision-key.dto'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login/student')
  loginStudent(@Body() dto: LoginStudentDto) {
    return this.auth.loginStudent(dto.studentId, dto.password)
  }

  @Public()
  @Post('login/faculty')
  loginFaculty(@Body() dto: LoginFacultyDto) {
    return this.auth.loginFaculty(dto.email, dto.password)
  }

  @Get('me')
  getProfile(@Request() req) {
    return this.auth.getProfile(req.user.id)
  }

  @Roles('teacher')
  @Post('provision-key')
  provisionKey(@Request() req, @Body() dto: ProvisionKeyDto) {
    return this.auth.provisionKey(req.user.id, dto.publicKey)
  }

  @Post('logout')
  logout(@Request() req) {
    return this.auth.logout(req.user.id)
  }
}
