import type { Section } from '../types/subject'

/**
 * Canonical section heading used wherever a section is identified.
 *
 * Two sections can carry the same subject while belonging to different courses
 * (e.g. "IT Elective" taught to BSIT and to BSA), so the course must always be
 * visible when known. Legacy sections without a course render unchanged.
 */
export const formatSectionHeading = (
  section: Pick<Section, 'section' | 'course'>,
): string => {
  const course = section.course?.trim()
  return course ? `Section ${section.section} · ${course}` : `Section ${section.section}`
}

/** Course label for chips/badges; empty string when the section has no course. */
export const sectionCourseLabel = (course?: string | null): string => course?.trim() ?? ''
