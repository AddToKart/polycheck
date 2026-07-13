import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateTeacherDto {
  @IsString() @MinLength(2) fullName: string
  @IsEmail() email: string
  @IsString() @MinLength(8) password: string
  @IsOptional() @IsString() department?: string
}

export class SetUserStatusDto {
  @IsBoolean() isActive: boolean
}
