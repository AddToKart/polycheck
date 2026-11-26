import { Module } from '@nestjs/common'
import { AccountActivationModule } from '../account-activation/account-activation.module'
import { PasswordResetModule } from '../password-reset/password-reset.module'
import { AccountMailProcessor } from './account-mail.processor'
import { AccountMailQueueService } from './account-mail-queue.service'
import { MailService } from './mail.service'
import { ResendWebhookController } from './resend-webhook.controller'

/** Provider-agnostic mail + the activation-mail outbox worker. */
@Module({
  imports: [AccountActivationModule, PasswordResetModule],
  controllers: [ResendWebhookController],
  providers: [MailService, AccountMailProcessor, AccountMailQueueService],
  exports: [MailService, AccountMailProcessor],
})
export class MailModule {}
