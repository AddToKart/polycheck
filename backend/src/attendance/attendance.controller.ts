import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import {
  CreateManualAttendanceDto,
  ScanAttendanceDto,
  SubmitAttendanceDto,
  UpdateAttendanceStatusDto,
} from './dto/attendance.dto'
import { AttendanceService } from './attendance.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { parsePagination } from '../common/utils/pagination'

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query('sessionId') sessionId?: string) {
    return this.attendance.findAll(req.user, sessionId)
  }

  @Get('page')
  findPage(
    @Request() req: AuthenticatedRequest,
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.attendance.findPage(req.user, sessionId, parsePagination(limit, offset))
  }

  @Get('summaries')
  summaries(@Request() req: AuthenticatedRequest) {
    return this.attendance.summaries(req.user)
  }

  @Get('attempts')
  @Roles('teacher', 'super_admin')
  attempts(@Request() req: AuthenticatedRequest, @Query('sessionId') sessionId?: string) {
    return this.attendance.findAttempts(req.user, sessionId)
  }

  @Get('student/:studentId')
  forStudent(
    @Request() req: AuthenticatedRequest,
    @Param('studentId') studentId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.attendance.forStudent(req.user, studentId, sectionId)
  }

  @Post('submit')
  @Roles('student')
  submit(@Request() req: AuthenticatedRequest, @Body() dto: SubmitAttendanceDto) {
    return this.attendance.submit(req.user, dto)
  }

  @Post('scan')
  @Roles('student')
  scan(@Request() req: AuthenticatedRequest, @Body() dto: ScanAttendanceDto) {
    return this.attendance.scan(req.user, dto)
  }

  @Post('check')
  @Roles('student')
  check(@Request() req: AuthenticatedRequest, @Body() dto: ScanAttendanceDto) {
    return this.attendance.check(req.user, dto)
  }

  @Post()
  @Roles('teacher')
  createManual(@Request() req: AuthenticatedRequest, @Body() dto: CreateManualAttendanceDto) {
    return this.attendance.createManual(req.user, dto)
  }

  @Patch(':id/status')
  @Roles('teacher')
  updateStatus(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateAttendanceStatusDto) {
    return this.attendance.updateStatus(req.user, id, dto.status)
  }
}
