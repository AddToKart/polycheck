import { Module } from '@nestjs/common'
import { AccountActivationModule } from '../account-activation/account-activation.module'
import { AccountMailProcessor } from './account-mail.processor'
import { AccountMailQueueService } from './account-mail-queue.service'
import { MailService } from './mail.service'

/** Provider-agnostic mail + the activation-mail outbox worker. */
@Module({
  imports: [AccountActivationModule],
  providers: [MailService, AccountMailProcessor, AccountMailQueueService],
  exports: [MailService, AccountMailProcessor],
})
export class MailModule {}
