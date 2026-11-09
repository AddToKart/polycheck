import { describe, expect, it } from 'vitest'
import {
  PUP_SANTA_MARIA_COURSES,
  pupCourseByCode,
  pupCourseName,
  pupCoursesByDepartment,
} from './pup-courses'

describe('PUP Santa Maria course catalog', () => {
  it('exposes unique course codes', () => {
    const codes = PUP_SANTA_MARIA_COURSES.map((course) => course.code.toLowerCase())
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('looks up courses case-insensitively', () => {
    expect(pupCourseByCode('bsit')?.name).toBe('BS Information Technology')
    expect(pupCourseByCode('  BSCS  ')?.name).toBe('BS Computer Science')
  })

  it('returns undefined for unknown or blank codes', () => {
    expect(pupCourseByCode('NOPE')).toBeUndefined()
    expect(pupCourseByCode('')).toBeUndefined()
    expect(pupCourseByCode(null)).toBeUndefined()
  })

  it('falls back to the raw code for display when unknown', () => {
    expect(pupCourseName('BSIT')).toBe('BS Information Technology')
    expect(pupCourseName('CUSTOM')).toBe('CUSTOM')
    expect(pupCourseName(undefined)).toBe('')
  })

  it('groups courses by department without dropping entries', () => {
    const groups = pupCoursesByDepartment()
    const total = groups.reduce((sum, group) => sum + group.courses.length, 0)
    expect(total).toBe(PUP_SANTA_MARIA_COURSES.length)
    expect(groups.map((group) => group.department)).toContain('CCIS')
  })
})
