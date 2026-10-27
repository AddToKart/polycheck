import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { StandingController } from './standing.controller'
import { StandingService } from './standing.service'

@Module({
  imports: [NotificationsModule],
  controllers: [StandingController],
  providers: [StandingService],
  exports: [StandingService],
})
export class StandingModule {}
