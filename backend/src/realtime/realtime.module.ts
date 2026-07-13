import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AttendanceGateway } from './attendance.gateway'

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [AttendanceGateway],
  exports: [AttendanceGateway],
})
export class RealtimeModule {}
