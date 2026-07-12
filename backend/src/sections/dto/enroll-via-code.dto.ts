import { IsString, MinLength, MaxLength, Matches } from 'class-validator'

export class EnrollViaCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  @Matches(/^[A-Za-z0-9]+$/)
  enrollmentCode: string
}
