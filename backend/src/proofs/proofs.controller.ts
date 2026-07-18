import { Body, Controller, Delete, Get, Param, Post, Request, Res } from '@nestjs/common'
import type { Response } from 'express'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { ProofsService } from './proofs.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'

class UploadProofDto {
  @IsString() sectionId!: string
  @IsString() sessionId!: string
  @IsString() @MaxLength(7_000_000) photoData!: string
  @IsOptional() @IsString() @MaxLength(500) description?: string
}

@Controller('proofs')
export class ProofsController {
  constructor(private readonly proofs: ProofsService) {}

  @Get(':sessionId')
  list(@Request() req: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.proofs.list(req.user, sessionId)
  }

  @Get(':id/file')
  async file(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Res() response: Response) {
    const file = await this.proofs.file(req.user, id)
    response.setHeader('Cache-Control', 'private, max-age=300')
    response.type(file.contentType)
    return response.send(file.buffer)
  }

  @Post()
  @Roles('teacher', 'student')
  upload(@Request() req: AuthenticatedRequest, @Body() dto: UploadProofDto) {
    return this.proofs.upload(req.user, dto)
  }

  @Delete(':id')
  @Roles('teacher')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.proofs.remove(req.user, id)
  }
}
