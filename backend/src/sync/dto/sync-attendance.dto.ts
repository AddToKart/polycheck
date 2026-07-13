import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator'
import { ScanAttendanceDto } from '../../attendance/dto/attendance.dto'

export class SyncAttendanceBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ScanAttendanceDto)
  records: ScanAttendanceDto[]
}
