import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

class ScanEvidenceDto {
  @IsOptional() @IsString() @MaxLength(128) clientAttemptId?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10_000) accuracyMeters?: number
  @IsOptional() @IsDateString() locationCapturedAt?: string
  @IsOptional() @IsBoolean() mocked?: boolean
  @IsOptional() @IsIn(['camera', 'image', 'manual']) inputChannel?: 'camera' | 'image' | 'manual'
}

export class SubmitAttendanceDto extends ScanEvidenceDto {
  @IsString() @MaxLength(128) sessionId!: string
  @IsString() @MaxLength(128) sectionId!: string
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number
  @IsOptional() @IsString() @MaxLength(128) deviceId?: string
  @IsString() @MinLength(80) @MaxLength(4096) qrToken!: string
  @IsOptional() @IsDateString() scannedAt?: string
}

export class ScanAttendanceDto extends ScanEvidenceDto {
  @IsString() @MaxLength(128) sessionId!: string
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lon!: number
  @IsOptional() @IsString() @MaxLength(128) deviceId?: string
  @IsString() @MinLength(80) @MaxLength(4096) qrToken!: string
  @IsOptional() @IsDateString() scannedAt?: string
}

export class UpdateAttendanceStatusDto {
  @IsIn(['present', 'late', 'absent', 'pending', 'disputed']) status!:
    'present' | 'late' | 'absent' | 'pending' | 'disputed'
}

export class CreateManualAttendanceDto {
  @IsString() @MaxLength(128) sessionId!: string
  @IsString() @MaxLength(128) sectionId!: string
  @IsString() @MaxLength(128) studentId!: string
  @IsIn(['present', 'late', 'absent', 'pending', 'disputed']) status!:
    'present' | 'late' | 'absent' | 'pending' | 'disputed'
}

export class AttendanceListQueryDto {
  @IsOptional() @IsString() @MaxLength(128) sessionId?: string
  @IsOptional() @IsString() @MaxLength(128) sectionId?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(1000) limit?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) offset?: number
}

export class AttendanceReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string
  @IsOptional() @IsString() @MaxLength(128) teacherId?: string
  @IsOptional() @IsString() @MaxLength(128) subjectId?: string
  @IsOptional() @IsString() @MaxLength(128) sectionId?: string
  @IsOptional() @IsString() @MaxLength(128) sessionId?: string
}
