import { IsString, MinLength } from 'class-validator'

export class LoginStudentDto {
  @IsString()
  studentId: string

  @IsString()
  @MinLength(6)
  password: string
}
