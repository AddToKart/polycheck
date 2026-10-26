import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
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
const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '').trim().toUpperCase() : value
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)

export class StudentImportRowDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowNumber!: number

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string

  @Transform(trimUpper)
  @IsString()
  @Matches(STUDENT_ID_PATTERN, { message: 'studentId must use the format 2024-00001-MN-0' })
  studentId!: string

  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  program?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  yearLevel?: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  department?: string
}

export class StudentImportRequestDto {
  @IsIn(['validate', 'execute'])
  mode!: 'validate' | 'execute'

  @IsIn(['skip_existing', 'update_existing'])
  conflictMode!: 'skip_existing' | 'update_existing'

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => StudentImportRowDto)
  rows!: StudentImportRowDto[]

  @IsOptional()
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, { message: 'idempotencyKey must be 8-128 safe characters' })
  idempotencyKey?: string

  @ValidateIf((request: StudentImportRequestDto) => request.mode === 'execute' || request.rowChecksum !== undefined)
  @IsString()
  @Matches(ROW_CHECKSUM_PATTERN, { message: 'rowChecksum must be a 16-character lowercase hex string' })
  rowChecksum?: string
}
