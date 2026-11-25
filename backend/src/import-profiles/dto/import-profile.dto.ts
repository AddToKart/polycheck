import { ArrayMaxSize, IsArray, IsIn, IsObject, IsString, MaxLength } from 'class-validator'

export const IMPORT_PROFILE_MODES = ['students', 'enrollments'] as const
export type ImportProfileMode = (typeof IMPORT_PROFILE_MODES)[number]

export class ImportProfileQueryDto {
  @IsIn(IMPORT_PROFILE_MODES) mode!: ImportProfileMode
  @IsString() @MaxLength(2_000) fingerprint!: string
}

export class UpsertImportProfileDto {
  @IsIn(IMPORT_PROFILE_MODES) mode!: ImportProfileMode
  @IsString() @MaxLength(2_000) fingerprint!: string

  /** The header names the fingerprint was derived from (kept so an admin can see what a profile is for). */
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(120, { each: true }) headers!: string[]

  /** field -> zero-based column index; validated against the allowed field list in the service. */
  @IsObject() mapping!: Record<string, unknown>
}
