import { BadRequestException, Controller, Get, Param, Query, Request, Res, StreamableFile } from '@nestjs/common'
import type { Response } from 'express'
import { Roles } from '../common/decorators/roles.decorator'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import { DocsService } from './docs.service'

const MAX_IDENTIFIER_LENGTH = 128
const MASTER_LIST_FORMATS = ['pdf', 'docx'] as const
const SESSION_ATTENDANCE_FORMATS = ['csv', 'pdf'] as const

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

function sendAttachment(
  response: Response,
  document: { filename: string; contentType: string; body: Buffer },
): StreamableFile {
  response.setHeader('Content-Type', document.contentType)
  response.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`)
  response.setHeader('Content-Length', document.body.length)
  return new StreamableFile(document.body)
}
