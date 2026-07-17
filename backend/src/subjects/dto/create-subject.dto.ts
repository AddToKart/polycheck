import { IsString, MinLength, IsOptional, MaxLength, Matches } from 'class-validator'

export class CreateSubjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/)
  code!: string

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string
}
