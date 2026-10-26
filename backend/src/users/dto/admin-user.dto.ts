import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { IsStrongPassword } from '../../common/decorators/strong-password.decorator'

export type AdminUserRole = 'super_admin' | 'teacher' | 'student'
export type AdminUserStatus = 'active' | 'inactive'
export type AssignableUserRole = 'teacher' | 'student'

/** Server-side filters + pagination for the super-admin user directory. */
export class AdminUserQueryDto {
  @IsOptional() @IsIn(['super_admin', 'teacher', 'student']) role?: AdminUserRole
  @IsOptional() @IsString() @MaxLength(100) q?: string
  @IsOptional() @IsString() @MaxLength(100) department?: string
  @IsOptional() @IsIn(['active', 'inactive']) status?: AdminUserStatus
  @IsOptional() @IsString() @MaxLength(10) limit?: string
  @IsOptional() @IsString() @MaxLength(10) offset?: string
}

/** Whitelisted profile fields for PATCH /users/:id (Locked Decision 8). */
export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string
  @IsOptional() @IsString() @MaxLength(100) department?: string
  @IsOptional() @IsEmail() @MaxLength(254) email?: string
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) program?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8) yearLevel?: number
}

/** Only student <-> teacher transitions are assignable (Locked Decision 6). */
export class ChangeUserRoleDto {
  @IsIn(['teacher', 'student']) role!: AssignableUserRole
}

/**
 * Promote an existing teacher (`userId`) or create a fresh super admin
 * (`fullName` + `email` + `password`) — never both.
 */
export class CreateAdminDto {
  @IsOptional() @IsString() @MaxLength(128) userId?: string
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string
  @IsOptional() @IsEmail() @MaxLength(254) email?: string
  @IsOptional() @IsStrongPassword() password?: string
  @IsOptional() @IsString() @MaxLength(100) department?: string
}
