import { Module } from '@nestjs/common'
import { SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'
import { RealtimeModule } from '../realtime/realtime.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
