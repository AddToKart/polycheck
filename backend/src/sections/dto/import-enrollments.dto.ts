import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

const STUDENT_ID_PATTERN = /^\d{4}-\d{5}-[A-Z]{2}-\d$/
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/
const ROW_CHECKSUM_PATTERN = /^[a-f0-9]{16}$/

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)
const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '').trim().toUpperCase() : value

export class EnrollImportRowDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowNumber!: number

  /** Required unless the row identifies the student by school email instead. */
  @ValidateIf((row: EnrollImportRowDto) => Boolean(row.studentId) || !row.email)
  @Transform(trimUpper)
  @IsString()
  @Matches(STUDENT_ID_PATTERN, { message: 'studentId must use the format 2024-00001-MN-0' })
  studentId?: string

  /** Checked row by row in the service, so one bad address rejects its row and not the whole batch. */
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @MaxLength(500)
  email?: string

  /** Verification only — never stored from the list. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  studentName?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  expectedProgram?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  expectedYearLevel?: number
}

export class EnrollImportRequestDto {
  @IsIn(['validate', 'execute'])
  mode!: 'validate' | 'execute'

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => EnrollImportRowDto)
  rows!: EnrollImportRowDto[]

  @IsOptional()
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, { message: 'idempotencyKey must be 8-128 safe characters' })
  idempotencyKey?: string

  @ValidateIf((request: EnrollImportRequestDto) => request.mode === 'execute' || request.rowChecksum !== undefined)
  @IsString()
  @Matches(ROW_CHECKSUM_PATTERN, { message: 'rowChecksum must be a 16-character lowercase hex string' })
  rowChecksum?: string
}
