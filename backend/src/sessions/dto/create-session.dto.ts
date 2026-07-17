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
  ValidateNested,
} from 'class-validator'

class GeofenceDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number
  @Type(() => Number) @IsInt() @Min(10) @Max(500) radiusMeters!: number
}

export class CreateSessionDto {
  @IsString() @MaxLength(128) sectionId!: string
  @IsString() @MaxLength(200) subjectName!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string
  @IsOptional() @IsString() @MaxLength(100) room?: string
  @Type(() => Number) @IsInt() @Min(1) @Max(180) qrValidityMinutes!: number
  @Type(() => Number) @IsInt() @Min(0) @Max(180) gracePeriodMinutes!: number
  @ValidateNested() @Type(() => GeofenceDto) geofence!: GeofenceDto
  @IsOptional() @IsBoolean() isRescheduled?: boolean
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) rescheduledFromDate?: string
  @IsOptional() @IsString() @MaxLength(30) originalScheduleTime?: string
  @IsOptional() @IsString() @MaxLength(100) originalRoom?: string
}

export class ActivateSessionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(180) validityMinutes!: number
  @IsString() @MinLength(80) @MaxLength(4096) token!: string
}

export class CreateBulkSessionsDto {
  @IsString() @MaxLength(128) sectionId!: string
  @IsString() @MaxLength(200) subjectName!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { each: true })
  daysOfWeek!: string[]
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string
  @IsOptional() @IsString() @MaxLength(100) room?: string
  @Type(() => Number) @IsInt() @Min(1) @Max(180) qrValidityMinutes!: number
  @Type(() => Number) @IsInt() @Min(0) @Max(180) gracePeriodMinutes!: number
  @ValidateNested() @Type(() => GeofenceDto) geofence!: GeofenceDto
}
