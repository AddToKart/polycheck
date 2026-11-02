import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import {
  AtRiskQueryDto,
  AtRiskReferralQueryDto,
  AttendanceListQueryDto,
  AttendanceReportQueryDto,
  CreateManualAttendanceDto,
  DecideExcuseDto,
  GenerateAtRiskReferralDto,
  ListExcusesQueryDto,
  RequestExcuseDto,
  ScanAttendanceDto,
  SubmitAttendanceDto,
  UpdateAtRiskReferralDto,
  UpdateAttendanceStatusDto,
} from './dto/attendance.dto'
import { AttendanceService } from './attendance.service'
import { AttendanceAtRiskService } from './attendance-at-risk.service'
import { AttendanceForensicsService } from './attendance-forensics.service'
import { AttendanceReferralService } from './attendance-referral.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { RequiresPrivacyConsent } from '../common/decorators/privacy-consent.decorator'

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly atRisk: AttendanceAtRiskService,
    private readonly forensics: AttendanceForensicsService,
    private readonly referrals: AttendanceReferralService,
  ) {}

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

  @Get('records/:id/timeline')
  @Roles('teacher', 'super_admin')
  recordTimeline(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.forensics.buildTimeline(req.user, id)
  }

  @Get('at-risk')
  @Roles('teacher', 'super_admin')
  atRiskStudents(@Request() req: AuthenticatedRequest, @Query() query: AtRiskQueryDto) {
    return this.atRisk.list(req.user, query)
  }

  /**
   * F5 (WF-LD7): CHED CMO No. 40 notice-of-impending-drop referrals.
   * Teachers generate/read for their own sections; the queue is department-wide
   * for heads and scoped for super admins. PATCH transitions stay head/admin
   * in the service (the generating teacher is read-only).
   */
  @Post('at-risk/referrals')
  @Roles('teacher', 'super_admin')
  generateAtRiskReferral(@Request() req: AuthenticatedRequest, @Body() dto: GenerateAtRiskReferralDto) {
    return this.referrals.generateReferral(req.user, dto)
  }

  @Get('at-risk/referrals')
  @Roles('teacher', 'super_admin')
  listAtRiskReferrals(@Request() req: AuthenticatedRequest, @Query() query: AtRiskReferralQueryDto) {
    return this.referrals.listReferrals(req.user, query)
  }

  @Patch('at-risk/referrals/:id')
  @Roles('teacher', 'super_admin')
  updateAtRiskReferral(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAtRiskReferralDto,
  ) {
    return this.referrals.updateReferralStatus(req.user, id, dto)
  }

  @Get('excuses')
  @Roles('teacher', 'super_admin')
  excuses(@Request() req: AuthenticatedRequest, @Query() query: ListExcusesQueryDto) {
    return this.attendance.listExcuses(req.user, query)
  }

  @Post('records/:id/excuse')
  @Roles('student')
  @RequiresPrivacyConsent()
  requestExcuse(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RequestExcuseDto) {
    return this.attendance.requestExcuse(req.user, id, dto)
  }

  @Post('records/:id/excuse/decision')
  @Roles('teacher')
  decideExcuse(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: DecideExcuseDto) {
    return this.attendance.decideExcuse(req.user, id, dto)
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
  @RequiresPrivacyConsent()
  submit(@Request() req: AuthenticatedRequest, @Body() dto: SubmitAttendanceDto) {
    return this.attendance.submit(req.user, dto)
  }

  @Post('scan')
  @Roles('student')
  @RequiresPrivacyConsent()
  scan(@Request() req: AuthenticatedRequest, @Body() dto: ScanAttendanceDto) {
    return this.attendance.scan(req.user, dto)
  }

  @Post('check')
  @Roles('student')
  @RequiresPrivacyConsent()
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
