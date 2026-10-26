import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports: [AuditLogsModule, RealtimeModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
