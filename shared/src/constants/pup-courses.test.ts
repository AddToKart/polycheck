import { describe, expect, it } from 'vitest'
import {
  PUP_COURSES_GROUP_LABEL,
  PUP_SANTA_MARIA_COURSES,
  pupCourseByCode,
  pupCourseCodes,
  pupCourseName,
  pupCoursesByDepartment,
} from './pup-courses'

describe('PUP Santa Maria course catalog', () => {
  it('lists exactly the eight official programs', () => {
    expect(pupCourseCodes()).toEqual([
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
    const codes = PUP_SANTA_MARIA_COURSES.map((course) => course.code.toLowerCase())
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('never lets an alias collide with another course', () => {
    const owner = new Map<string, string>()
    for (const course of PUP_SANTA_MARIA_COURSES) {
      for (const key of [course.code, course.name, ...course.aliases]) {
        const compact = key.toLowerCase().replace(/[^a-z0-9]+/g, '')
        const previous = owner.get(compact)
        expect(previous === undefined || previous === course.code).toBe(true)
        owner.set(compact, course.code)
      }
    }
  })

  it('looks up courses case-insensitively', () => {
    expect(pupCourseByCode('bsit')?.name).toBe('Bachelor of Science in Information Technology')
    expect(pupCourseByCode('  bscpe  ')?.code).toBe('BSCpE')
  })

  it('returns undefined for unknown, legacy or blank codes', () => {
    expect(pupCourseByCode('NOPE')).toBeUndefined()
    expect(pupCourseByCode('BSCS')).toBeUndefined()
    expect(pupCourseByCode('')).toBeUndefined()
    expect(pupCourseByCode(null)).toBeUndefined()
  })

  it('falls back to the raw code for display when unknown', () => {
    expect(pupCourseName('BSHM')).toBe('Bachelor of Science in Hospitality Management')
    expect(pupCourseName('CUSTOM')).toBe('CUSTOM')
    expect(pupCourseName(undefined)).toBe('')
  })

  it('keeps the legacy grouping wrapper as one flat bucket (the campus has no departments)', () => {
    const groups = pupCoursesByDepartment()
    expect(groups).toHaveLength(1)
    expect(groups[0].department).toBe(PUP_COURSES_GROUP_LABEL)
    expect(groups[0].courses).toHaveLength(PUP_SANTA_MARIA_COURSES.length)
  })
})
