import { IsString, MinLength, IsArray, ValidateNested, IsOptional, IsIn } from 'class-validator'
import { Type } from 'class-transformer'

class ScheduleDayDto {
  @IsString()
  @IsIn(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  day: string

  @IsString()
  startTime: string

  @IsString()
  endTime: string

  @IsString()
  @IsOptional()
  room?: string
}

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  subjectId: string

  @IsString()
  @MinLength(1)
  section: string

  @IsString()
  @MinLength(1)
  room: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedule: ScheduleDayDto[]

  @IsString()
  @MinLength(1)
  semester: string

}
