import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { EXPO_PUSH_FETCH } from './notification-events'

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: EXPO_PUSH_FETCH, useValue: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
