import type { Section, Subject } from '@polycheck/shared'

export type SessionSectionContext = {
  sectionId: string
  /** Null when the id came from a stale deep link and is not in the loaded lists. */
  sectionName: string | null
  subjectId: string | null
  subjectName: string | null
  subjectCode: string | null
  known: boolean
}

/**
 * Resolves the optional `sectionId` route param into display metadata for the
 * sessions list. Unknown ids stay usable as a filter (the list simply comes
 * back empty) instead of throwing away the deep link.
 */
export function resolveSessionSectionContext(
  sectionId: string | undefined | null,
  sections: Section[],
  subjects: Subject[],
): SessionSectionContext | null {
  const normalized = sectionId?.trim()
  if (!normalized) return null

  const section = sections.find((candidate) => candidate.id === normalized)
  if (!section) {
    return {
      sectionId: normalized,
      sectionName: null,
      subjectId: null,
      subjectName: null,
      subjectCode: null,
      known: false,
    }
  }

  const subject = subjects.find((candidate) => candidate.id === section.subjectId)
  return {
    sectionId: section.id,
    sectionName: section.section,
    subjectId: section.subjectId,
    subjectName: subject?.name ?? null,
    subjectCode: subject?.code ?? null,
    known: true,
  }
}
