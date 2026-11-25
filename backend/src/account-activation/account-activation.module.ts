import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { AccountActivationController } from './account-activation.controller'
import { AccountActivationService } from './account-activation.service'

/** Single-use email activation links for accounts created by an import. */
@Module({
  imports: [SettingsModule],
  controllers: [AccountActivationController],
  providers: [AccountActivationService],
  exports: [AccountActivationService],
})
export class AccountActivationModule {}
