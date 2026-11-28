import { IsString, MaxLength, MinLength } from 'class-validator'

export class DeleteArchivedSubjectDto {
  /** The subject's own code, typed by the teacher to confirm. */
  @IsString() @MinLength(1) @MaxLength(64) confirmCode!: string
}
