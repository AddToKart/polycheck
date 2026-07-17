import { IsString, MaxLength, MinLength } from 'class-validator'

export class LoginStudentDto {
  @IsString()
  @MaxLength(50)
  studentId!: string

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string
}
