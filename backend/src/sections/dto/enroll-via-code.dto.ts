import { IsString, MinLength } from 'class-validator'

export class EnrollViaCodeDto {
  @IsString()
  @MinLength(1)
  enrollmentCode: string
}
