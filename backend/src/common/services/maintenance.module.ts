import { Module } from '@nestjs/common'
import { MaintenanceService } from './maintenance.service'
import { SessionPermissionsModule } from '../../session-permissions/session-permissions.module'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule, SessionPermissionsModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
