import { Controller, Post, Get, Body, Request, Req, Res } from '@nestjs/common'
import type { Request as ExpressRequest, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { LoginStudentDto } from './dto/login-student.dto'
import { LoginFacultyDto } from './dto/login-faculty.dto'
import { ProvisionKeyDto } from './dto/provision-key.dto'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('login/student')
  async loginStudent(
    @Body() dto: LoginStudentDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginStudent(dto.studentId, dto.password, req.ip)
    this.setAccessCookie(res, result.token)
    return result
  }

  @Public()
  @Post('login/faculty')
  async loginFaculty(
    @Body() dto: LoginFacultyDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginFaculty(dto.email, dto.password, req.ip)
    this.setAccessCookie(res, result.token)
    return result
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
  async logout(@Request() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(req.user.id)
    res.clearCookie('polycheck_access', this.cookieOptions())
    return result
  }

  private setAccessCookie(response: Response, token: string) {
    response.cookie('polycheck_access', token, this.cookieOptions())
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
      path: '/',
    }
  }
}
