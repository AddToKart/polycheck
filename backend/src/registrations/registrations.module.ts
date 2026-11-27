import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { RegistrationsController } from './registrations.controller'
import { RegistrationsService } from './registrations.service'

@Module({
  imports: [SettingsModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
