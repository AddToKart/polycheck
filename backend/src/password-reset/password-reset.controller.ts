import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request } from 'express'
import { Public } from '../common/decorators/public.decorator'
import { PasswordResetCompleteDto, PasswordResetRequestDto, PasswordResetValidateDto } from './dto/password-reset.dto'
import { PasswordResetService } from './password-reset.service'

/**
 * Public self-service reset surface (the student has no session). Abuse limits live in the service (per IP, per
 * account, per token) because the global per-user limiter skips public routes.
 */
@Controller('password-reset')
export class PasswordResetController {
  constructor(private readonly reset: PasswordResetService) {}

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('request')
  request(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    return this.reset.request(dto.studentId, req.ip)
  }

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('validate')
  validate(@Body() dto: PasswordResetValidateDto, @Req() req: Request) {
    return this.reset.validate(dto.token, req.ip)
  }

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('complete')
  complete(@Body() dto: PasswordResetCompleteDto, @Req() req: Request) {
    return this.reset.complete(dto, req.ip)
  }
}
