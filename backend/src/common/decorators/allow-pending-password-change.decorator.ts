import { SetMetadata } from '@nestjs/common'

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange'

/**
 * Marks the narrow set of routes a user with `mustChangePassword=true` may
 * still reach: profile/logout, privacy notice + consent, and the password
 * change endpoint itself.
 */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true)
