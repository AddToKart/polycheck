import { Body, Controller, Delete, ForbiddenException, Get, Put, Request } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { IsString, MaxLength } from 'class-validator'
import { Public } from '../common/decorators/public.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { BrandingService } from './branding.service'

class SetLogoDto {
  /** ~256 KB of image becomes ~350 K base64 characters. */
  @IsString() @MaxLength(400_000) dataUrl!: string
}

/**
 * Institution identity. Reading is public on purpose: the login screens and the mobile boot need the
 * institution's name and logo before anyone has signed in, and nothing here is sensitive.
 */
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Public()
  @SkipThrottle()
  @Get()
  current() {
    return this.branding.current()
  }

  @Put('logo')
  @Roles('super_admin')
  setLogo(@Request() req: AuthenticatedRequest, @Body() dto: SetLogoDto) {
    this.assertInstitutionAdmin(req)
    return this.branding.setLogo(dto.dataUrl, req.user.id)
  }

  @Delete('logo')
  @Roles('super_admin')
  clearLogo(@Request() req: AuthenticatedRequest) {
    this.assertInstitutionAdmin(req)
    return this.branding.clearLogo()
  }

  private assertInstitutionAdmin(req: AuthenticatedRequest) {
    if (req.user.role !== 'super_admin' || req.user.scope !== 'institution') {
      throw new ForbiddenException('Only institution administrators can change the institution logo')
    }
  }
}
