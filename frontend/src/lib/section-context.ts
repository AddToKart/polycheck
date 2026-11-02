/**
 * PL-1 — Sessions workspace section context.
 *
 * `sectionId` is an ordinary URL filter on the sessions list. These helpers keep
 * section-context navigation consistent so deep links round-trip and the
 * "clear section" link removes only `sectionId`, preserving every other active
 * filter (status, dates, subject, and unrelated params such as `tab`).
 */

export function sectionContextHref(
  pathname: string,
  currentSearch: string,
  sectionId: string | null,
): string {
  const params = new URLSearchParams(currentSearch)
  if (sectionId) params.set('sectionId', sectionId)
  else params.delete('sectionId')
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

/** Canonical sessions list URL, optionally scoped to one section. */
export function sessionsListHref(sectionId?: string | null): string {
  return sectionContextHref('/faculty/sessions', '', sectionId ?? null)
}

/** Canonical session-create URL that preselects the originating section. */
export function createSessionHref(sectionId?: string | null): string {
  return sectionContextHref('/faculty/sessions/create', '', sectionId ?? null)
}
