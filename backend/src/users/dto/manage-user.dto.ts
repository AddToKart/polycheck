import { applyDecorators } from '@nestjs/common'
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

const IsStrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(12),
    MaxLength(128),
    Matches(/[a-z]/, { message: 'password must contain a lowercase letter' }),
    Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' }),
    Matches(/[0-9]/, { message: 'password must contain a number' }),
    Matches(/[^A-Za-z0-9]/, { message: 'password must contain a special character' }),
  )

export class CreateTeacherDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string
  @IsEmail() @MaxLength(254) email!: string
  @IsStrongPassword() password!: string
  @IsOptional() @IsString() @MaxLength(100) department?: string
}

export class CreateStudentDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string
  @IsString()
  @Matches(/^\d{4}-\d{5}-[A-Z]{2}-\d$/, { message: 'studentId must use the format 2024-00001-MN-0' })
  studentId!: string
  @IsOptional() @IsEmail() @MaxLength(254) email?: string
  @IsStrongPassword() password!: string
  @IsString() @MinLength(2) @MaxLength(150) program!: string
  @Type(() => Number) @IsInt() @Min(1) @Max(8) yearLevel!: number
  @IsString() @MinLength(2) @MaxLength(100) department!: string
}

export class ResetPasswordDto {
  @IsStrongPassword() password!: string
}

export class SetUserStatusDto {
  @IsBoolean() isActive!: boolean
}
