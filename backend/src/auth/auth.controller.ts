import { Controller, Post, Get, Body, Request, Req, Res } from '@nestjs/common'
import type { Request as ExpressRequest, Response } from 'express'
import { AuthService } from './auth.service'
import { toWebHeaders } from './http-headers'
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
  async loginStudent(
    @Body() dto: LoginStudentDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginStudent(dto.studentId, dto.password, req.ip, toWebHeaders(req.headers))
    this.applyAuthHeaders(res, result.headers)
    return { user: result.user }
  }

  @Public()
  @Post('login/faculty')
  async loginFaculty(
    @Body() dto: LoginFacultyDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginFaculty(dto.email, dto.password, req.ip, toWebHeaders(req.headers))
    this.applyAuthHeaders(res, result.headers)
    return { user: result.user }
  }

  @Public()
  @Post('mobile/login/student')
  async loginStudentMobile(@Body() dto: LoginStudentDto, @Req() req: ExpressRequest) {
    const result = await this.auth.loginStudent(dto.studentId, dto.password, req.ip, toWebHeaders(req.headers))
    if (!result.token) throw new Error('Better Auth did not issue a mobile bearer token')
    return { user: result.user, token: result.token }
  }

  @Public()
  @Post('mobile/login/faculty')
  async loginFacultyMobile(@Body() dto: LoginFacultyDto, @Req() req: ExpressRequest) {
    const result = await this.auth.loginFaculty(dto.email, dto.password, req.ip, toWebHeaders(req.headers))
    if (!result.token) throw new Error('Better Auth did not issue a mobile bearer token')
    return { user: result.user, token: result.token }
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
    const result = await this.auth.logout(toWebHeaders(req.headers))
    this.applyAuthHeaders(res, result.headers)
    return { message: result.message }
  }

  private applyAuthHeaders(response: Response, headers: Headers) {
    for (const cookie of headers.getSetCookie()) {
      response.append('set-cookie', cookie)
    }
  }
}
