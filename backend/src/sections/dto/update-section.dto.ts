import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator'

class ScheduleDayDto {
  @IsString()
  @IsOptional()
  day?: string

  @IsString()
  @IsOptional()
  startTime?: string

  @IsString()
  @IsOptional()
  endTime?: string

  @IsString()
  @IsOptional()
  room?: string
}

export class UpdateSectionDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  section?: string

  @IsString()
  @MinLength(1)
  @IsOptional()
  room?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  @IsOptional()
  schedule?: ScheduleDayDto[]

  @IsString()
  @MinLength(1)
  @IsOptional()
  semester?: string
}
