import { Controller, Get, Header, Query, Request } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

class CalendarQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string
}

class ExportQueryDto {
  @IsOptional() @IsString() @MaxLength(128) sectionId?: string
  @IsOptional() @IsString() @MaxLength(128) sessionId?: string
}

class SearchQueryDto {
  @IsString() @MaxLength(100) q!: string
}

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('calendar/events')
  events(@Request() req: AuthenticatedRequest, @Query() query: CalendarQueryDto) {
    return this.dashboard.events(req.user, query.startDate, query.endDate)
  }

  @Get('reports/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() query?: ExportQueryDto) {
    return this.dashboard.exportCsv(req.user, query?.sectionId, query?.sessionId)
  }

  @Get('search')
  search(@Request() req: AuthenticatedRequest, @Query() query: SearchQueryDto) {
    return this.dashboard.search(req.user, query.q)
  }
}
