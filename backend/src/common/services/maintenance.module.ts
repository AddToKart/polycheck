import { Module } from '@nestjs/common'
import { MaintenanceService } from './maintenance.service'
import { SessionPermissionsModule } from '../../session-permissions/session-permissions.module'
import { PrismaModule } from '../../prisma/prisma.module'
import { NotificationsModule } from '../../notifications/notifications.module'

@Module({
  imports: [PrismaModule, SessionPermissionsModule, NotificationsModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
