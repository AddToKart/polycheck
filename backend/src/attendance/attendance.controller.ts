import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateManualAttendanceDto, ScanAttendanceDto, SubmitAttendanceDto, UpdateAttendanceStatusDto } from './dto/attendance.dto'
import { AttendanceService } from './attendance.service'

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  findAll(@Request() req, @Query('sessionId') sessionId?: string) { return this.attendance.findAll(req.user, sessionId) }

  @Get('summaries')
  summaries(@Request() req) { return this.attendance.summaries(req.user) }

  @Get('attempts')
  @Roles('teacher', 'super_admin')
  attempts(@Request() req, @Query('sessionId') sessionId?: string) { return this.attendance.findAttempts(req.user, sessionId) }

  @Get('student/:studentId')
  forStudent(@Request() req, @Param('studentId') studentId: string, @Query('sectionId') sectionId?: string) { return this.attendance.forStudent(req.user, studentId, sectionId) }

  @Post('submit')
  @Roles('student')
  submit(@Request() req, @Body() dto: SubmitAttendanceDto) { return this.attendance.submit(req.user, dto) }

  @Post('scan')
  @Roles('student')
  scan(@Request() req, @Body() dto: ScanAttendanceDto) { return this.attendance.scan(req.user, dto) }

  @Post('check')
  @Roles('student')
  check(@Request() req, @Body() dto: ScanAttendanceDto) { return this.attendance.check(req.user, dto) }

  @Post()
  @Roles('teacher', 'super_admin')
  createManual(@Request() req, @Body() dto: CreateManualAttendanceDto) { return this.attendance.createManual(req.user, dto) }

  @Patch(':id/status')
  @Roles('teacher', 'super_admin')
  updateStatus(@Request() req, @Param('id') id: string, @Body() dto: UpdateAttendanceStatusDto) { return this.attendance.updateStatus(req.user, id, dto.status) }
}
