import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AttendanceGateway } from './attendance.gateway'
import { ServerStatusService } from './server-status.service'
import { MaintenanceModeModule } from '../maintenance-mode/maintenance-mode.module'

@Module({
  imports: [AuthModule, PrismaModule, AiModule, MaintenanceModeModule],
  providers: [AttendanceGateway, ServerStatusService],
  exports: [AttendanceGateway, ServerStatusService],
})
export class RealtimeModule {}
