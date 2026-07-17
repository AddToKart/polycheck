import { IsString, MinLength, IsOptional } from 'class-validator'

export class UpdateSubjectDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string

  @IsString()
  @MinLength(1)
  @IsOptional()
  code?: string

  @IsString()
  @IsOptional()
  description?: string
}
