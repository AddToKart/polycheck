import { describe, expect, it } from 'vitest'
import {
  CAMPUS_COURSES_GROUP_LABEL,
  CAMPUS_COURSES,
  campusCourseByCode,
  campusCourseCodes,
  campusCourseName,
  campusCoursesByDepartment,
} from './campus-courses'

describe('Campus course catalog', () => {
  it('lists exactly the eight official programs', () => {
    expect(campusCourseCodes()).toEqual([
      'BSA',
      'BSCpE',
      'BSENTREP',
      'BSHM',
      'BSIT',
      'BSEDEN',
      'BSEDMT',
      'DOMTLOM',
    ])
  })

  it('exposes unique course codes', () => {
    const codes = CAMPUS_COURSES.map((course) => course.code.toLowerCase())
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('never lets an alias collide with another course', () => {
    const owner = new Map<string, string>()
    for (const course of CAMPUS_COURSES) {
      for (const key of [course.code, course.name, ...course.aliases]) {
        const compact = key.toLowerCase().replace(/[^a-z0-9]+/g, '')
        const previous = owner.get(compact)
        expect(previous === undefined || previous === course.code).toBe(true)
        owner.set(compact, course.code)
      }
    }
  })

  it('looks up courses case-insensitively', () => {
    expect(campusCourseByCode('bsit')?.name).toBe('Bachelor of Science in Information Technology')
    expect(campusCourseByCode('  bscpe  ')?.code).toBe('BSCpE')
  })

  it('returns undefined for unknown, legacy or blank codes', () => {
    expect(campusCourseByCode('NOPE')).toBeUndefined()
    expect(campusCourseByCode('BSCS')).toBeUndefined()
    expect(campusCourseByCode('')).toBeUndefined()
    expect(campusCourseByCode(null)).toBeUndefined()
  })

  it('falls back to the raw code for display when unknown', () => {
    expect(campusCourseName('BSHM')).toBe('Bachelor of Science in Hospitality Management')
    expect(campusCourseName('CUSTOM')).toBe('CUSTOM')
    expect(campusCourseName(undefined)).toBe('')
  })

  it('keeps the legacy grouping wrapper as one flat bucket (the campus has no departments)', () => {
    const groups = campusCoursesByDepartment()
    expect(groups).toHaveLength(1)
    expect(groups[0].department).toBe(CAMPUS_COURSES_GROUP_LABEL)
    expect(groups[0].courses).toHaveLength(CAMPUS_COURSES.length)
  })
})
