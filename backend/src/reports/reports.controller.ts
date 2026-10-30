import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { CreateSystemReportDto, SystemReportQueryDto, UpdateSystemReportStatusDto } from './dto/report.dto'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { parsePagination } from '../common/utils/pagination'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @Roles('student', 'teacher')
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateSystemReportDto) {
    return this.reports.create(req.user, dto)
  }

  @Get('my')
  @Roles('student', 'teacher')
  myReports(@Request() req: AuthenticatedRequest) {
    return this.reports.myReports(req.user)
  }

  @Get('stats')
  @Roles('super_admin')
  stats(@Request() req: AuthenticatedRequest) {
    return this.reports.stats(req.user)
  }

  @Get()
  @Roles('super_admin')
  list(@Request() req: AuthenticatedRequest, @Query() query: SystemReportQueryDto) {
    return this.reports.list(req.user, query, parsePagination(query.limit, query.offset))
  }

  @Get(':id')
  @Roles('super_admin')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.reports.findOne(req.user, id)
  }

  /** Submitter or super admin only; streams the stored screenshot bytes. */
  @Get(':id/screenshot')
  screenshot(@Param('id') id: string, @Request() req: AuthenticatedRequest, @Res() response: Response) {
    void this.reports
      .screenshot(req.user, id)
      .then((file) => {
        response.setHeader('Cache-Control', 'private, max-age=300')
        response.type(file.contentType)
        response.send(file.buffer)
      })
      .catch(() => {
        response.status(404).json({ statusCode: 404, message: 'Screenshot not found' })
      })
  }

  @Patch(':id/status')
  @Roles('super_admin')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSystemReportStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.reports.updateStatus(req.user, id, dto, req.ip)
  }
}
