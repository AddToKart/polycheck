import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { PasswordResetController } from './password-reset.controller'
import { PasswordResetService } from './password-reset.service'

/** Self-service "forgot password" by emailed link, for students with a bound contact email. */
@Module({
  imports: [NotificationsModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
