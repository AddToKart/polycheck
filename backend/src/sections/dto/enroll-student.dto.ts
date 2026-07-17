import { IsString, MinLength } from 'class-validator'

export class EnrollStudentDto {
  @IsString()
  @MinLength(1)
  studentId!: string

  @IsString()
  @MinLength(1)
  studentName!: string
}
