import { Body, Controller, Get, Param, Post, Query, Request } from '@nestjs/common'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { DisputesService } from './disputes.service'

class SubmitDisputeDto { @IsString() recordId: string; @IsString() reason: string; @IsString() description: string }
class ResolveDisputeDto { @IsIn(['accept', 'reject', 'override']) resolution: 'accept' | 'reject' | 'override'; @IsOptional() @IsIn(['present', 'late', 'absent', 'pending', 'disputed']) newStatus?: any }

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}
  @Get() findAll(@Request() req, @Query('sessionId') sessionId?: string, @Query('status') status?: 'pending'|'resolved'|'all', @Query('search') search?: string) { return this.disputes.findAll(req.user, sessionId, status, search) }
  @Post() @Roles('student') submit(@Request() req, @Body() dto: SubmitDisputeDto) { return this.disputes.submit(req.user, dto) }
  @Post(':id/resolve') @Roles('teacher', 'super_admin') resolve(@Request() req, @Param('id') id: string, @Body() dto: ResolveDisputeDto) { return this.disputes.resolve(req.user, id, dto.resolution, dto.newStatus) }
}
