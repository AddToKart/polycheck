import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class SubmitAttendanceDto {
  @IsString() @MaxLength(128) sessionId!: string
  @IsString() @MaxLength(128) sectionId!: string
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number
  @IsOptional() @IsString() @MaxLength(128) deviceId?: string
  @IsString() @MinLength(80) @MaxLength(4096) qrToken!: string
  @IsOptional() @IsDateString() scannedAt?: string
}

export class ScanAttendanceDto {
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
