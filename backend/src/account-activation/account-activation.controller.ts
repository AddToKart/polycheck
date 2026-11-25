import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request } from 'express'
import { Public } from '../common/decorators/public.decorator'
import { AccountActivationService } from './account-activation.service'
import { ActivationCompleteDto, ActivationRequestLinkDto, ActivationValidateDto } from './dto/activation.dto'

/**
 * Public activation surface (the student has no session yet). Deliberately a
 * separate controller: the login routes in `auth.controller.ts` are untouched.
 * Abuse limits live in the service (per token, per account, per IP) because the
 * global per-user limiter skips public routes.
 */
@Controller('activation')
export class AccountActivationController {
  constructor(private readonly activation: AccountActivationService) {}

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('validate')
  validate(@Body() dto: ActivationValidateDto, @Req() req: Request) {
    return this.activation.validate(dto.token, req.ip)
  }

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('complete')
  complete(@Body() dto: ActivationCompleteDto, @Req() req: Request) {
    return this.activation.complete(dto, req.ip)
  }

  @Public()
  @SkipThrottle()
  @HttpCode(202)
  @Post('request-link')
  requestLink(@Body() dto: ActivationRequestLinkDto, @Req() req: Request) {
    return this.activation.requestLink(dto, req.ip)
  }
}
