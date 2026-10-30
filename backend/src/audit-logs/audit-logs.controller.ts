import { Controller, Get, Query, Request } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { Roles } from '../common/decorators/roles.decorator'
import { AuditLogsService } from './audit-logs.service'

export class AuditLogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25
  @IsOptional() @IsString() @MaxLength(100) search?: string
  @IsOptional() @IsString() @MaxLength(100) action?: string
  @IsOptional() @IsIn(['initiated', 'succeeded', 'failed']) outcome?: 'initiated' | 'succeeded' | 'failed'
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string
}

@Controller('audit-logs')
@Roles('super_admin')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @Roles('super_admin')
  list(@Request() req: AuthenticatedRequest, @Query() query: AuditLogQueryDto) {
    return this.auditLogs.list(req.user, query)
  }
}
