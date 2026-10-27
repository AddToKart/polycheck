import { Module } from '@nestjs/common'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { AttendanceScopeService } from './attendance-scope.service'
import { AttendanceReportService } from './attendance-report.service'
import { AttendanceAtRiskService } from './attendance-at-risk.service'
import { GeofenceService } from './geofence.service'
import { ScanValidatorService } from './scan-validator.service'
import { RealtimeModule } from '../realtime/realtime.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProofsModule } from '../proofs/proofs.module'
import { StandingModule } from '../standing/standing.module'

@Module({
  imports: [RealtimeModule, NotificationsModule, ProofsModule, StandingModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceScopeService,
    AttendanceReportService,
    AttendanceAtRiskService,
    GeofenceService,
    ScanValidatorService,
    AttendanceService,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
