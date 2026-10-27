import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { StudentImportService } from './student-import.service'
import { StudentImportQueueService } from './student-import-queue.service'

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, StudentImportService, StudentImportQueueService],
  exports: [UsersService],
})
export class UsersModule {}
