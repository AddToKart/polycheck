import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

class GeofenceDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number
  @Type(() => Number) @IsInt() @Min(10) @Max(500) radiusMeters!: number
}

const SESSION_MODES = ['in_person', 'online'] as const
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

export class CreateSessionDto {
  @IsString() @MaxLength(128) sectionId!: string
  @IsString() @MaxLength(200) subjectName!: string
  @IsOptional() @IsIn(SESSION_MODES) mode?: 'in_person' | 'online'
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string
  @IsOptional() @IsString() @MaxLength(100) room?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(15) qrValidityMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) gracePeriodMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(300) startQrValiditySeconds?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) startGraceMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(300) endQrValiditySeconds?: number
  // Required for in-person sessions; must be omitted for online (RA 10173
  // zero-GPS). Validated again in the service for defense-in-depth.
  @ValidateIf((dto: CreateSessionDto) => dto.mode !== 'online')
  @ValidateNested()
  @Type(() => GeofenceDto)
  geofence?: GeofenceDto
  @IsOptional() @IsBoolean() isRescheduled?: boolean
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) rescheduledFromDate?: string
  @IsOptional() @IsString() @MaxLength(30) originalScheduleTime?: string
  @IsOptional() @IsString() @MaxLength(100) originalRoom?: string
}

export class ActivateSessionDto {
  @IsOptional() @IsIn(['start', 'end']) checkpoint?: 'start' | 'end'
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(15) validityMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) gracePeriodMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(300) validitySeconds?: number
  @IsOptional() @IsBoolean() regenerate?: boolean
  @IsString() @MinLength(80) @MaxLength(4096) token!: string
  // V4 anti-ghost-professor evidence (optional; only consulted for in-person
  // sessions). Absent coordinates keep today's behavior (offline activation).
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number
  @IsOptional() @IsBoolean() overrideTeacherLocation?: boolean
}

/**
 * One class meeting of a slot-aware bulk request. The weekday is swept over
 * [startDate, endDate] with this slot's own times.
 */
export class BulkSessionSlotDto {
  @IsString() @IsIn(DAYS_OF_WEEK) day!: string
  @IsString() @Matches(TIME_OF_DAY) startTime!: string
  @IsString() @Matches(TIME_OF_DAY) endTime!: string
}

export class CreateBulkSessionsDto {
  @IsString() @MaxLength(128) sectionId!: string
  @IsString() @MaxLength(200) subjectName!: string
  @IsOptional() @IsIn(SESSION_MODES) mode?: 'in_person' | 'online'
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string
  /**
   * Slot-aware shape: when present and non-empty it wins over the legacy
   * daysOfWeek + startTime/endTime pair (which is then ignored).
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BulkSessionSlotDto)
  slots?: BulkSessionSlotDto[]
  // Legacy shape — still sent by the Android composer.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(DAYS_OF_WEEK, { each: true })
  daysOfWeek?: string[]
  @IsOptional() @IsString() @Matches(TIME_OF_DAY) startTime?: string
  @IsOptional() @IsString() @Matches(TIME_OF_DAY) endTime?: string
  @IsOptional() @IsString() @MaxLength(100) room?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(15) qrValidityMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) gracePeriodMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(300) startQrValiditySeconds?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) startGraceMinutes?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(60) @Max(300) endQrValiditySeconds?: number
  @ValidateIf((dto: CreateBulkSessionsDto) => dto.mode !== 'online')
  @ValidateNested()
  @Type(() => GeofenceDto)
  geofence?: GeofenceDto
}
