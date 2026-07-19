import { Controller, Get, Header, Query, Request } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'

class CalendarQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string
}

class ExportQueryDto {
  @IsOptional() @IsString() @MaxLength(128) sectionId?: string
  @IsOptional() @IsString() @MaxLength(128) sessionId?: string
  @IsOptional() @IsString() @MaxLength(128) teacherId?: string
  @IsOptional() @IsString() @MaxLength(128) subjectId?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string
}

class OverviewQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string
}

class SearchQueryDto {
  @IsString() @MinLength(2) @MaxLength(100) q!: string
}

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('calendar/events')
  events(@Request() req: AuthenticatedRequest, @Query() query: CalendarQueryDto) {
    return this.dashboard.events(req.user, query.startDate, query.endDate)
  }

  @Get('reports/export')
  @Roles('teacher', 'super_admin')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  exportCsv(@Request() req: AuthenticatedRequest, @Query() query: ExportQueryDto) {
    return this.dashboard.exportCsv(req.user, query)
  }

  @Get('dashboard/overview')
  @Roles('teacher', 'super_admin')
  overview(@Request() req: AuthenticatedRequest, @Query() query: OverviewQueryDto) {
    return this.dashboard.overview(req.user, query)
  }

  @Get('search')
  search(@Request() req: AuthenticatedRequest, @Query() query: SearchQueryDto) {
    return this.dashboard.search(req.user, query.q)
  }
}
