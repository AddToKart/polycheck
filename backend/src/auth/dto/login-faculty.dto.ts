import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class LoginFacultyDto {
  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string

  /** Accepted for mobile clients; staff accounts are never device-locked. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'deviceId must be URL-safe' })
  deviceId?: string
}
