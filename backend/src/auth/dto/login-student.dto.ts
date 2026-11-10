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
   * Installation identity of the calling client. Web browsers send their
   * persistent `web-…` installation id and the mobile app sends its `mobile-…`
   * SecureStore id; both channels are subject to the same student-only device
   * gates (active session elsewhere + logout cooldown).
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'deviceId must be URL-safe' })
  deviceId?: string
}
