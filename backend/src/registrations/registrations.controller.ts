import { Body, Controller, Get, HttpCode, Post, Query, Req, Request } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request as ExpressRequest } from 'express'
import { Public } from '../common/decorators/public.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { RegistrationDecisionDto, RegistrationSubmitDto } from './dto/registration.dto'
import { RegistrationsService } from './registrations.service'

/**
 * Temporary sign-up for data gathering. The `public` routes are called by the
 * landing page, which has no session; their abuse limits live in the service
 * because the global per-user limiter skips public routes.
 */
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Public()
  @SkipThrottle()
  @Get('public/status')
  status() {
    return this.registrations.status()
  }

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('public')
  submit(@Body() dto: RegistrationSubmitDto, @Req() req: ExpressRequest) {
    return this.registrations.submit(dto, req.ip)
  }

  @Get()
  @Roles('super_admin')
  list(@Request() req: AuthenticatedRequest, @Query('status') status?: string) {
    return this.registrations.list(req.user, status === 'approved' ? 'approved' : 'pending')
  }

  @HttpCode(200)
  @Post('approve')
  @Roles('super_admin')
  approve(@Request() req: AuthenticatedRequest, @Body() dto: RegistrationDecisionDto) {
    return this.registrations.approve(req.user, dto.ids)
  }

  @HttpCode(200)
  @Post('reject')
  @Roles('super_admin')
  reject(@Request() req: AuthenticatedRequest, @Body() dto: RegistrationDecisionDto) {
    return this.registrations.reject(req.user, dto.ids)
  }
}
