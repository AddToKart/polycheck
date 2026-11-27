/**
 * The Privacy Policy and Terms live on the landing site, so there is exactly one copy of each. The app's
 * accepted notice (and its URL) comes from the API; these are the public links the web app shows.
 */
const LEGAL_SITE_URL = (process.env.NEXT_PUBLIC_LEGAL_SITE_URL?.trim() || 'https://polycheck.live').replace(/\/+$/, '')

export const PRIVACY_POLICY_URL = `${LEGAL_SITE_URL}/privacy`
export const TERMS_URL = `${LEGAL_SITE_URL}/terms`
/** The temporary sign-up form lives on the same landing site. */
export const SIGN_UP_URL = `${LEGAL_SITE_URL}/register`
