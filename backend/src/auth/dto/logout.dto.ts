import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class LogoutDto {
  /** Identity of the device logging out; exempted from the armed cooldown. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string

  /**
   * Opt-out for programmatic/forced logouts (replaced or revoked sessions).
   * When `false` no cooldown is armed. Defaults to true; a logout without a
   * device id never arms regardless of this flag.
   */
  @IsOptional()
  @IsBoolean()
  armDeviceCooldown?: boolean
}
