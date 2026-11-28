/**
 * Institution identity shown across the product. PolyCheck is the product name and never changes;
 * the institution's own name, short name, campus and logo are administrator-editable runtime data so the
 * same build can serve any campus without code changes.
 */
export interface InstitutionBranding {
  /** Full institution name (document headers, login screen). */
  name: string
  /** Short form used in tight spaces and the document seal monogram (for example "ABC"). */
  shortName: string
  /** Campus or branch label; empty when the institution has a single site. */
  campus: string
  /** Uploaded logo as a PNG/JPEG/WebP data URL, or null to show the neutral PolyCheck mark. */
  logoDataUrl: string | null
}

export const BRANDING_STATUS_PATH = '/branding'
export const BRANDING_LOGO_PATH = '/branding/logo'
export const BRANDING_LOGO_MAX_BYTES = 256 * 1024
export const INSTITUTION_NAME_KEY = 'institution_name'
export const INSTITUTION_SHORT_NAME_KEY = 'institution_short_name'
export const INSTITUTION_CAMPUS_KEY = 'institution_campus'
export const INSTITUTION_LOGO_KEY = 'institution_logo'

/** Shown until an administrator configures the institution. */
export const DEFAULT_BRANDING: InstitutionBranding = {
  name: 'Your Institution',
  shortName: 'Institution',
  campus: '',
  logoDataUrl: null,
}

const SHORT_NAME_STOP_WORDS = new Set(['of', 'the', 'and', 'for', 'in', 'at', 'de', 'ng'])

/** "Example Polytechnic of the Province" -> "EPP". Used only when no short name is stored. */
export function deriveShortName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter((word) => word && !SHORT_NAME_STOP_WORDS.has(word.toLowerCase()))
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  return initials.length >= 2 ? initials.slice(0, 8) : name.trim().slice(0, 8)
}

/** Monogram for the vector seal on generated documents (1-4 characters). */
export function brandingMonogram(shortName: string): string {
  const letters = shortName.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return (letters || 'IN').slice(0, 4)
}

/**
 * The campus as printed under the institution name: "Santa Maria" reads "Santa Maria Campus", and a
 * value that already says campus is left alone.
 */
export function campusHeading(campus: string | null | undefined): string {
  const name = campus?.trim() ?? ''
  if (!name) return ''
  return /\bcampus\b/i.test(name) ? name : `${name} Campus`
}

/** Fills any missing field from the defaults and derives the short name from the name when absent. */
export function resolveBranding(partial: Partial<InstitutionBranding> | null | undefined): InstitutionBranding {
  const name = partial?.name?.trim() || DEFAULT_BRANDING.name
  const shortName = partial?.shortName?.trim() || (partial?.name?.trim() ? deriveShortName(name) : DEFAULT_BRANDING.shortName)
  return {
    name,
    shortName,
    campus: partial?.campus?.trim() ?? DEFAULT_BRANDING.campus,
    logoDataUrl: partial?.logoDataUrl ?? null,
  }
}

/** "Main Campus" -> "ABC · Main Campus"; collapses cleanly when there is no campus. */
export function brandingLabel(branding: Pick<InstitutionBranding, 'shortName' | 'campus'>): string {
  return branding.campus ? `${branding.shortName} · ${branding.campus}` : branding.shortName
}
