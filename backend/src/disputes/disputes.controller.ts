import { Body, Controller, Get, Param, Post, Query, Request } from '@nestjs/common'
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { Roles } from '../common/decorators/roles.decorator'
import { DisputesService } from './disputes.service'
import type { AuthenticatedRequest } from '../common/types/authenticated-request'
import type { AttendanceStatus } from '@prisma/client'

class SubmitDisputeDto {
  @IsString() @MaxLength(128) recordId!: string
  @IsIn([
    'outside_geofence',
    'expired_token',
    'duplicate_submission',
    'invalid_signature',
    'device_mismatch',
    'suspicious_coordinates',
  ])
  reason!: string
  @IsString() @MinLength(10) @MaxLength(1000) description!: string
}

class ListDisputesQueryDto {
  @IsOptional() @IsString() @MaxLength(128) sessionId?: string
  @IsOptional() @IsIn(['pending', 'resolved', 'all']) status?: 'pending' | 'resolved' | 'all'
  @IsOptional() @IsString() @MaxLength(100) search?: string
}

class ResolveDisputeDto {
  @IsIn(['accept', 'reject', 'override']) resolution!: 'accept' | 'reject' | 'override'
  @IsOptional() @IsIn(['present', 'late', 'absent', 'pending', 'disputed']) newStatus?: AttendanceStatus
}

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query() query?: ListDisputesQueryDto) {
    return this.disputes.findAll(req.user, query?.sessionId, query?.status, query?.search)
  }

  @Post()
  @Roles('student')
  submit(@Request() req: AuthenticatedRequest, @Body() dto: SubmitDisputeDto) {
    return this.disputes.submit(req.user, dto)
  }

  @Post(':id/resolve')
  @Roles('teacher')
  resolve(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputes.resolve(req.user, id, dto.resolution, dto.newStatus)
  }
}
