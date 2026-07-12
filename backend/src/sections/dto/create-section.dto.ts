import { IsString, MinLength, IsArray, ValidateNested, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

class ScheduleDayDto {
  @IsString()
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

  @IsString()
  @MinLength(1)
  teacherId: string

  @IsString()
  @MinLength(1)
  teacherName: string
}
