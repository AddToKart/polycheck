import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator'

export class SubmitAttendanceDto {
  @IsString() sessionId: string
  @IsString() sectionId: string
  @Type(() => Number) @IsNumber() latitude: number
  @Type(() => Number) @IsNumber() longitude: number
  @IsOptional() @IsString() deviceId?: string
  @IsString() @MinLength(80) qrToken: string
  @IsOptional() @IsDateString() scannedAt?: string
}

export class ScanAttendanceDto {
  @IsString() sessionId: string
  @Type(() => Number) @IsNumber() lat: number
  @Type(() => Number) @IsNumber() lon: number
  @IsOptional() @IsString() deviceId?: string
  @IsString() @MinLength(80) qrToken: string
  @IsOptional() @IsDateString() scannedAt?: string
}

export class UpdateAttendanceStatusDto {
  @IsIn(['present', 'late', 'absent', 'pending', 'disputed']) status: 'present' | 'late' | 'absent' | 'pending' | 'disputed'
}

export class CreateManualAttendanceDto {
  @IsString() sessionId: string
  @IsString() sectionId: string
  @IsString() studentId: string
  @IsIn(['present', 'late', 'absent', 'pending', 'disputed']) status: 'present' | 'late' | 'absent' | 'pending' | 'disputed'
}
