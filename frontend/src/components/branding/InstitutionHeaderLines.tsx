'use client'

import { useBranding } from '@/components/branding/BrandingProvider'

/**
 * The institution's name (and campus, when set) as the two small lines at the top of an ID card face. Comes
 * from the administrator-editable branding, so no institution is hardcoded into the card.
 */
export function InstitutionHeaderLines({
  nameClassName,
  campusClassName,
}: {
  nameClassName: string
  campusClassName: string
}) {
  const branding = useBranding()
  return (
    <div className="min-w-0">
      <p className={`truncate ${nameClassName}`}>{branding.name.toUpperCase()}</p>
      {branding.campus ? <p className={`truncate ${campusClassName}`}>{branding.campus.toUpperCase()}</p> : null}
    </div>
  )
}
