import { Module } from '@nestjs/common'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { AttendanceScopeService } from './attendance-scope.service'
import { AttendanceReportService } from './attendance-report.service'
import { AttendanceAtRiskService } from './attendance-at-risk.service'
import { AttendanceForensicsService } from './attendance-forensics.service'
import { AttendanceReferralService } from './attendance-referral.service'
import { GeofenceService } from './geofence.service'
import { LedgerService } from './ledger.service'
import { ScanValidatorService } from './scan-validator.service'
import { RealtimeModule } from '../realtime/realtime.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProofsModule } from '../proofs/proofs.module'
import { StandingModule } from '../standing/standing.module'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [RealtimeModule, NotificationsModule, ProofsModule, StandingModule, UsersModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceScopeService,
    AttendanceReportService,
    AttendanceAtRiskService,
    AttendanceForensicsService,
    AttendanceReferralService,
    GeofenceService,
    LedgerService,
    ScanValidatorService,
    AttendanceService,
  ],
  exports: [AttendanceService, LedgerService],
})
export class AttendanceModule {}
