import { Module } from '@nestjs/common'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { AttendanceScopeService } from './attendance-scope.service'
import { AttendanceReportService } from './attendance-report.service'
import { GeofenceService } from './geofence.service'
import { ScanValidatorService } from './scan-validator.service'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports: [RealtimeModule],
  controllers: [AttendanceController],
  providers: [AttendanceScopeService, AttendanceReportService, GeofenceService, ScanValidatorService, AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
