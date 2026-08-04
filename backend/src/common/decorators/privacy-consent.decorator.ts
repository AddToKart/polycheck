import { SetMetadata } from '@nestjs/common'

export const REQUIRES_PRIVACY_CONSENT_KEY = 'requiresPrivacyConsent'
export const RequiresPrivacyConsent = () => SetMetadata(REQUIRES_PRIVACY_CONSENT_KEY, true)
