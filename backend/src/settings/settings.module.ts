import { Module } from '@nestjs/common'
import { BrandingController } from './branding.controller'
import { BrandingService } from './branding.service'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

@Module({
  controllers: [SettingsController, BrandingController],
  providers: [SettingsService, BrandingService],
  exports: [SettingsService, BrandingService],
})
export class SettingsModule {}
