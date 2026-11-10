import { Module } from '@nestjs/common'
import { AuditLogsController } from './audit-logs.controller'
import { AuditLogsService } from './audit-logs.service'
import { AttendanceModule } from '../attendance/attendance.module'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule, AttendanceModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
