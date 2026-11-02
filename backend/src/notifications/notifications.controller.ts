import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { ListNotificationsQueryDto, MarkNotificationsReadDto, RegisterPushTokenDto } from './dto/notification.dto'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Request() req: AuthenticatedRequest, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(req.user, query)
  }

  @Get('unread-count')
  unreadCount(@Request() req: AuthenticatedRequest) {
    return this.notifications.unreadCount(req.user)
  }

  @Post('read')
  markRead(@Request() req: AuthenticatedRequest, @Body() dto: MarkNotificationsReadDto) {
    return this.notifications.markRead(req.user, dto)
  }

  @Post('push-token')
  registerPushToken(@Request() req: AuthenticatedRequest, @Body() dto: RegisterPushTokenDto) {
    return this.notifications.registerPushToken(req.user, dto)
  }
}
