import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { DisputesController } from './disputes.controller'
import { DisputesService } from './disputes.service'

@Module({
  imports: [NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
