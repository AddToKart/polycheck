import { Module } from '@nestjs/common'
import { SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'
import { PresidentHostController } from './president-host.controller'
import { PresidentHostService } from './president-host.service'
import { LedgerService } from '../attendance/ledger.service'
import { RealtimeModule } from '../realtime/realtime.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [SessionsController, PresidentHostController],
  // LedgerService holds no state; it only appends inside the caller's transaction.
  providers: [SessionsService, PresidentHostService, LedgerService],
  exports: [SessionsService],
})
export class SessionsModule {}
