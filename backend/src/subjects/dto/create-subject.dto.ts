import { IsString, MinLength, IsOptional } from 'class-validator'

export class CreateSubjectDto {
  @IsString()
  @MinLength(1)
  name: string

  @IsString()
  @MinLength(1)
  code: string

  @IsString()
  @IsOptional()
  description?: string
}
