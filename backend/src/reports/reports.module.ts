import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'
import { ProofsModule } from '../proofs/proofs.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [ProofsModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
