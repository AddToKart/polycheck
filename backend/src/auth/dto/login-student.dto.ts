import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class LoginStudentDto {
  @IsString()
  @MaxLength(50)
  studentId!: string

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string

  /**
   * Mobile installation identity. Web browser logins never send this; the
   * server only applies device binding/cooldown rules on the mobile routes.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'deviceId must be URL-safe' })
  deviceId?: string
}
