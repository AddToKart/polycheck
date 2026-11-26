import { IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { IsStrongPassword } from '../../common/decorators/strong-password.decorator'

const STUDENT_NUMBER = /^\d{4}-\d{5}-[A-Za-z]{2}-\d$/

export class PasswordResetRequestDto {
  @IsString()
  @Matches(STUDENT_NUMBER, { message: 'studentId must use the format 2024-00001-MN-0' })
  studentId!: string
}

export class PasswordResetValidateDto {
  @IsString() @MinLength(32) @MaxLength(128) token!: string
}

export class PasswordResetCompleteDto {
  @IsString() @MinLength(32) @MaxLength(128) token!: string
  @IsStrongPassword() password!: string
}
