import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { MaintenanceModeController } from './maintenance-mode.controller'
import { SystemMaintenanceService } from './system-maintenance.service'

/**
 * Institution maintenance-mode subsystem.
 *
 * Deliberately distinct from the legacy cron `MaintenanceService`
 * (`backend/src/common/services/maintenance.service.ts`), which prunes expired
 * permissions and old rows. This module owns the settings-driven 503 shield.
 */
@Module({
  imports: [SettingsModule],
  controllers: [MaintenanceModeController],
  providers: [SystemMaintenanceService],
  exports: [SystemMaintenanceService],
})
export class MaintenanceModeModule {}
