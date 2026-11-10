import { BadRequestException, Controller, Get, Param, Query, Request, Res, StreamableFile } from '@nestjs/common'
import type { Response } from 'express'
import { Roles } from '../common/decorators/roles.decorator'
import { RequireDesignation } from '../common/decorators/require-designation.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { DocsService } from './docs.service'

const MAX_IDENTIFIER_LENGTH = 128
const MASTER_LIST_FORMATS = ['pdf', 'docx'] as const
const SESSION_ATTENDANCE_FORMATS = ['csv', 'pdf'] as const
const DPO_SUMMARY_FORMATS = ['pdf', 'docx'] as const
const CLASS_RECORD_FORMATS = ['pdf', 'docx'] as const
const AT_RISK_NOTICE_FORMATS = ['pdf', 'docx'] as const

@Controller('docs')
export class DocsController {
  constructor(private readonly docs: DocsService) {}

  @Get('master-list/:sectionId')
  @Roles('teacher', 'super_admin')
  async masterList(
    @Request() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Res({ passthrough: true }) response: Response,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    assertIdentifier(sectionId, 'sectionId')
    const document = await this.docs.masterList(req.user, sectionId, parseFormat(format, MASTER_LIST_FORMATS, 'pdf'))
    return sendAttachment(response, document)
  }

  @Get('session-attendance/:sessionId')
  @Roles('teacher', 'super_admin')
  async sessionAttendance(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Res({ passthrough: true }) response: Response,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    assertIdentifier(sessionId, 'sessionId')
    const document = await this.docs.sessionAttendance(
      req.user,
      sessionId,
      parseFormat(format, SESSION_ATTENDANCE_FORMATS, 'csv'),
    )
    return sendAttachment(response, document)
  }

  /**
   * F6: RA 10173 DPO one-pager. Same widening as the maintenance PUT: plain
   * teachers need the IT-coordinator designation; super admins pass directly.
   */
  @Get('dpo-summary')
  @Roles('teacher', 'super_admin')
  @RequireDesignation('it_operations')
  async dpoSummary(
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    const document = await this.docs.dpoSummary(req.user, parseFormat(format, DPO_SUMMARY_FORMATS, 'pdf'))
    return sendAttachment(response, document)
  }

  /**
   * F4: official PUP class record. Owning teacher, academic-oversight
   * department head (department-pinned), or a scoped super admin.
   */
  @Get('class-record/:sectionId')
  @Roles('teacher', 'super_admin')
  async classRecord(
    @Request() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Res({ passthrough: true }) response: Response,
    @Query('format') format?: string,
    @Query('from') from?: string,
  ): Promise<StreamableFile> {
    assertIdentifier(sectionId, 'sectionId')
    const document = await this.docs.classRecord(
      req.user,
      sectionId,
      parseFormat(format, CLASS_RECORD_FORMATS, 'pdf'),
      parseFromOverride(from),
    )
    return sendAttachment(response, document)
  }

  /**
   * F5: the official CHED "Notice of Impending Drop" slip. Same parties as the
   * referral read scope (owning teacher / department head / scoped super admin).
   */
  @Get('at-risk-notice/:referralId')
  @Roles('teacher', 'super_admin')
  async atRiskNotice(
    @Request() req: AuthenticatedRequest,
    @Param('referralId') referralId: string,
    @Res({ passthrough: true }) response: Response,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    assertIdentifier(referralId, 'referralId')
    const document = await this.docs.atRiskNotice(
      req.user,
      referralId,
      parseFormat(format, AT_RISK_NOTICE_FORMATS, 'pdf'),
    )
    return sendAttachment(response, document)
  }
}

function assertIdentifier(value: string, label: string): void {
  if (!value || !value.trim() || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new BadRequestException(`${label} must be 1-${MAX_IDENTIFIER_LENGTH} characters`)
  }
}

function parseFormat<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value.trim() === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (!(allowed as readonly string[]).includes(normalized)) {
    throw new BadRequestException(`format must be one of: ${allowed.join(', ')}`)
  }
  return normalized as T
}

/** Week-1 anchor override; absent or empty keeps the earliest-session anchor. */
function parseFromOverride(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null
  const datePattern = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim())
  if (!datePattern) throw new BadRequestException('from must be an ISO calendar date formatted as YYYY-MM-DD')
  return value.trim()
}

function sendAttachment(
  response: Response,
  document: { filename: string; contentType: string; body: Buffer },
): StreamableFile {
  response.setHeader('Content-Type', document.contentType)
  response.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`)
  response.setHeader('Content-Length', document.body.length)
  return new StreamableFile(document.body)
}
