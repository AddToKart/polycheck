import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator'

class ScheduleDayDto {
  @IsString()
  @IsIn(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  day!: string

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  room?: string
}

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  subjectId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  section!: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  room!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedule!: ScheduleDayDto[]

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  semester!: string
}
