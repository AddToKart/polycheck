import { Module } from '@nestjs/common'
import { MaintenanceService } from './maintenance.service'
import { SessionPermissionsModule } from '../../session-permissions/session-permissions.module'
import { NotificationsModule } from '../../notifications/notifications.module'
import { SettingsModule } from '../../settings/settings.module'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule, SessionPermissionsModule, NotificationsModule, SettingsModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
