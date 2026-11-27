import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

class HostDeviceSecurityDto {
  @IsOptional() @IsBoolean() rootDetected?: boolean
  @IsOptional() @IsBoolean() hookDetected?: boolean
  @IsOptional() @IsBoolean() emulatorDetected?: boolean
}

/** A president starting their session. The location is only used to mark them present. */
export class HostStartDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(15) validityMinutes!: number
  @Type(() => Number) @IsInt() @Min(0) @Max(60) gracePeriodMinutes!: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10_000) accuracyMeters?: number
  @IsOptional() @IsDateString() locationCapturedAt?: string
  /** The phone's clock when it sent this, to judge how old the location is. */
  @IsOptional() @IsDateString() clientTime?: string
  @IsOptional() @IsBoolean() mocked?: boolean
  @IsOptional() @IsString() @MaxLength(128) deviceId?: string
  @IsOptional() @ValidateNested() @Type(() => HostDeviceSecurityDto) deviceSecurity?: HostDeviceSecurityDto
}
