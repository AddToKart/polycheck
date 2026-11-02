import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { SettingsModule } from '../settings/settings.module'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { StudentImportService } from './student-import.service'
import { StudentImportQueueService } from './student-import-queue.service'
import { DeviceBindingService } from './device-binding.service'

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [UsersController],
  providers: [UsersService, StudentImportService, StudentImportQueueService, DeviceBindingService],
  exports: [UsersService, DeviceBindingService],
})
export class UsersModule {}
