import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class RegistrationSubmitDto {
  @IsIn(['student', 'teacher']) role!: 'student' | 'teacher'
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string
  @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(254) email!: string
  // The password policy is checked in the service, for one readable message.
  @IsString() @MaxLength(128) password!: string
  @IsOptional() @IsString() @MaxLength(32) studentId?: string
  @IsOptional() @IsString() @MaxLength(20) program?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8) yearLevel?: number
  @IsBoolean() consent!: boolean
  /** Honeypot: hidden on the form. */
  @IsOptional() @IsString() @MaxLength(200) website?: string
}

export class RegistrationDecisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  ids!: string[]
}
