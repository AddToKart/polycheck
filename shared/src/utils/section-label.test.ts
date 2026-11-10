import { describe, expect, it } from 'vitest'
import { formatSectionHeading, sectionCourseLabel } from './section-label'

describe('formatSectionHeading', () => {
  it('appends the course when the section carries one', () => {
    expect(formatSectionHeading({ section: '4-1', course: 'BSIT' })).toBe('Section 4-1 · BSIT')
  })

  it('renders the original label for legacy sections without a course', () => {
    expect(formatSectionHeading({ section: '4-1' })).toBe('Section 4-1')
  })

  it('ignores blank course values', () => {
    expect(formatSectionHeading({ section: '2-2', course: '   ' })).toBe('Section 2-2')
  })

  it('trims surrounding whitespace from the course', () => {
    expect(formatSectionHeading({ section: '1-1', course: ' BSA ' })).toBe('Section 1-1 · BSA')
  })
})

describe('sectionCourseLabel', () => {
  it('returns a trimmed course label', () => {
    expect(sectionCourseLabel(' BSIT ')).toBe('BSIT')
  })

  it('returns empty string when absent', () => {
    expect(sectionCourseLabel(undefined)).toBe('')
    expect(sectionCourseLabel(null)).toBe('')
    expect(sectionCourseLabel('  ')).toBe('')
  })
})
