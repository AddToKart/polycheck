import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AttendanceGateway } from './attendance.gateway'
import { ServerStatusService } from './server-status.service'

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [AttendanceGateway, ServerStatusService],
  exports: [AttendanceGateway, ServerStatusService],
})
export class RealtimeModule {}
