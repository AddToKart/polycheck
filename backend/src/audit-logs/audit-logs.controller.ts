import { Controller, Get, Logger, Post, Query, Request } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { Roles } from '../common/decorators/roles.decorator'
import { LedgerService } from '../attendance/ledger.service'
import { PrismaService } from '../prisma/prisma.service'
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
  private readonly logger = new Logger(AuditLogsController.name)

  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('super_admin')
  list(@Request() req: AuthenticatedRequest, @Query() query: AuditLogQueryDto) {
    return this.auditLogs.list(req.user, query)
  }

  /**
   * Read-only, idempotent chain verification (F9/WF-LD11). The outcome is
   * audited fail-open per repo convention; the verify run itself never
   * mutates attendance rows.
   */
  @Post('ledger/verify')
  @Roles('super_admin')
  async verifyLedger(@Request() req: AuthenticatedRequest) {
    const result = await this.ledger.verifyLedger(this.prisma)
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorRole: req.user.role,
          action: 'ledger.verified',
          entityType: 'audit',
          metadata: {
            verified: result.verified,
            recordsChecked: result.recordsChecked,
            sessionsChecked: result.sessionsChecked,
          },
        },
      })
    } catch (error) {
      this.logger.warn(
        `Could not write ledger.verified audit row for ${req.user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    return result
  }
}
