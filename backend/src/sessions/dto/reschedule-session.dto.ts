import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { SESSION_ROOM_MAX_LENGTH } from '@polycheck/shared'

export class RescheduleSessionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string
  @IsOptional() @IsString() @MaxLength(SESSION_ROOM_MAX_LENGTH) room?: string
}
