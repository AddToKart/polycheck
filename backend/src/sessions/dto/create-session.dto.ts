import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

class GeofenceDto {
  @Type(() => Number) @IsNumber() latitude!: number
  @Type(() => Number) @IsNumber() longitude!: number
  @Type(() => Number) @IsInt() @Min(10) @Max(500) radiusMeters!: number
}

export class CreateSessionDto {
  @IsString() sectionId!: string
  @IsString() subjectName!: string
  @IsString() date!: string
  @IsString() startTime!: string
  @IsString() endTime!: string
  @IsOptional() @IsString() room?: string
  @Type(() => Number) @IsInt() @Min(1) @Max(180) qrValidityMinutes!: number
  @Type(() => Number) @IsInt() @Min(0) @Max(180) gracePeriodMinutes!: number
  @ValidateNested() @Type(() => GeofenceDto) geofence!: GeofenceDto
  @IsOptional() @IsBoolean() isRescheduled?: boolean
  @IsOptional() @IsString() rescheduledFromDate?: string
  @IsOptional() @IsString() originalScheduleTime?: string
  @IsOptional() @IsString() originalRoom?: string
}

export class ActivateSessionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(180) validityMinutes!: number
  @IsString() @MinLength(80) token!: string
}

export class CreateBulkSessionsDto {
  @IsString() sectionId!: string
  @IsString() subjectName!: string
  @IsDateString() startDate!: string
  @IsDateString() endDate!: string
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { each: true })
  daysOfWeek!: string[]
  @IsString() startTime!: string
  @IsString() endTime!: string
  @IsOptional() @IsString() room?: string
  @Type(() => Number) @IsInt() @Min(1) @Max(180) qrValidityMinutes!: number
  @Type(() => Number) @IsInt() @Min(0) @Max(180) gracePeriodMinutes!: number
  @ValidateNested() @Type(() => GeofenceDto) geofence!: GeofenceDto
}
