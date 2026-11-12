import { Type } from 'class-transformer'
import { IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator'

// Same validation as CreateSectionDto: a schedule entry always replaces a
// persisted row, so `day` must be a real weekday and times must be HH:mm.
// Otherwise `{ day: 'Funday' }` reaches Prisma as a 500 and `9:00` corrupts
// sessionDurationMinutes (online auto-end would shrink to 15 minutes).
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

export class UpdateSectionDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  section?: string

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(30)
  course?: string

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
