import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { IsStrongPassword } from '../../common/decorators/strong-password.decorator'

export class CreateTeacherDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string
  @IsEmail() @MaxLength(254) email!: string
  /** Omit to let the server generate a temporary password (returned once). */
  @IsOptional() @IsStrongPassword() password?: string
  @IsOptional() @IsString() @MaxLength(100) department?: string
}

export class CreateStudentDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string
  @IsString()
  @Matches(/^\d{4}-\d{5}-[A-Z]{2}-\d$/, { message: 'studentId must use the format 2024-00001-MN-0' })
  studentId!: string
  @IsOptional() @IsEmail() @MaxLength(254) email?: string
  /** Omit to let the server generate a temporary password (returned once). */
  @IsOptional() @IsStrongPassword() password?: string
  @IsString() @MinLength(2) @MaxLength(150) program!: string
  @Type(() => Number) @IsInt() @Min(1) @Max(8) yearLevel!: number
  @IsString() @MinLength(2) @MaxLength(100) department!: string
}

export class ResetPasswordDto {
  /** Omit to let the server generate a temporary password (returned once). */
  @IsOptional() @IsStrongPassword() password?: string
}

export class SetUserStatusDto {
  @IsBoolean() isActive!: boolean
}
