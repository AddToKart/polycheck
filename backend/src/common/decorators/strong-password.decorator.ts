import { applyDecorators } from '@nestjs/common'
import { IsString, Matches, MaxLength, MinLength } from 'class-validator'

/**
 * Shared strong-password policy for account creation, admin resets, and the
 * forced first-login password change flow.
 */
export const IsStrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(12),
    MaxLength(128),
    Matches(/[a-z]/, { message: 'password must contain a lowercase letter' }),
    Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' }),
    Matches(/[0-9]/, { message: 'password must contain a number' }),
    Matches(/[^A-Za-z0-9]/, { message: 'password must contain a special character' }),
  )
