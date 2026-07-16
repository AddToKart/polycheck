import { Controller, Post, Get, Body, Request, Req } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { AuthService } from './auth.service'
import { LoginStudentDto } from './dto/login-student.dto'
import { LoginFacultyDto } from './dto/login-faculty.dto'
import { ProvisionKeyDto } from './dto/provision-key.dto'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login/student')
  loginStudent(@Body() dto: LoginStudentDto, @Req() req: ExpressRequest) {
    return this.auth.loginStudent(dto.studentId, dto.password, req.ip)
  }

  @Public()
  @Post('login/faculty')
  loginFaculty(@Body() dto: LoginFacultyDto, @Req() req: ExpressRequest) {
    return this.auth.loginFaculty(dto.email, dto.password, req.ip)
  }

  @Get('me')
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.auth.getProfile(req.user.id)
  }

  @Roles('teacher')
  @Post('provision-key')
  provisionKey(@Request() req: AuthenticatedRequest, @Body() dto: ProvisionKeyDto) {
    return this.auth.provisionKey(req.user.id, dto.publicKey)
  }

  @Post('logout')
  logout(@Request() req: AuthenticatedRequest) {
    return this.auth.logout(req.user.id)
  }
}
