import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import {
  AttendanceListQueryDto,
  AttendanceReportQueryDto,
  CreateManualAttendanceDto,
  ScanAttendanceDto,
  SubmitAttendanceDto,
  UpdateAttendanceStatusDto,
} from './dto/attendance.dto'
import { AttendanceService } from './attendance.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query() query: AttendanceListQueryDto) {
    return this.attendance.findAll(req.user, query)
  }

  @Get('page')
  findPage(@Request() req: AuthenticatedRequest, @Query() query: AttendanceListQueryDto) {
    return this.attendance.findPage(req.user, query, {
      limit: Math.min(query.limit ?? 50, 100),
      offset: query.offset ?? 0,
    })
  }

  @Get('summaries')
  @Roles('teacher', 'super_admin')
  summaries(@Request() req: AuthenticatedRequest, @Query() query: AttendanceReportQueryDto) {
    return this.attendance.summaries(req.user, query)
  }

  @Get('report')
  @Roles('teacher', 'super_admin')
  report(@Request() req: AuthenticatedRequest, @Query() query: AttendanceReportQueryDto) {
    return this.attendance.report(req.user, query)
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
