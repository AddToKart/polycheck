import { Body, Controller, Post, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { SyncAttendanceBatchDto } from './dto/sync-attendance.dto'
import { SyncService } from './sync.service'

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('attendance')
  @Roles('student')
  submitAttendance(@Request() req, @Body() dto: SyncAttendanceBatchDto) {
    return this.sync.submit(req.user, dto.records)
  }
}
