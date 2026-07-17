import { Body, Controller, Post, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { SyncAttendanceBatchDto } from './dto/sync-attendance.dto'
import { SyncService } from './sync.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('attendance')
  @Roles('student')
  submitAttendance(@Request() req: AuthenticatedRequest, @Body() dto: SyncAttendanceBatchDto) {
    return this.sync.submit(req.user, dto.records)
  }
}
