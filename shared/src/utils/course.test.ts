import { describe, expect, it } from 'vitest'
import {
  type CourseScope,
  courseHeadLabel,
  courseInScope,
  courseScope,
  isCatalogCourse,
  normalizeCourse,
  normalizeCourseList,
  oversightCourses,
  resolveCourse,
} from './course'

describe('normalizeCourse', () => {
  it.each([
    ['BSIT', 'BSIT'],
    ['bsit', 'BSIT'],
    ['B.S.I.T.', 'BSIT'],
    ['  bs information technology ', 'BSIT'],
    ['Bachelor of Science in Information Technology', 'BSIT'],
    ['BSCPE', 'BSCpE'],
    ['BS Computer Engineering', 'BSCpE'],
    ['BSEntrep', 'BSENTREP'],
    ['BS Entrepreneurship', 'BSENTREP'],
    ['BS Hospitality Management', 'BSHM'],
    ['BS Accountancy', 'BSA'],
    ['BSED-EN', 'BSEDEN'],
    ['BSEd English', 'BSEDEN'],
    ['BSED-MT', 'BSEDMT'],
    ['bsed math', 'BSEDMT'],
    ['DOMT', 'DOMTLOM'],
  ])('maps %s to %s', (input, code) => {
    expect(normalizeCourse(input)).toEqual({ code, matched: true, raw: input.trim() })
  })

  it('never drops an unmatched value', () => {
    expect(normalizeCourse('BS Basket Weaving')).toEqual({ matched: false, raw: 'BS Basket Weaving' })
  })

  it('leaves the ambiguous legacy BSEd and the retired draft codes unmatched', () => {
    for (const legacy of ['BSEd', 'BSCS', 'BSIS', 'BEEd', 'BIT']) {
      expect(normalizeCourse(legacy).matched).toBe(false)
    }
  })

  it('handles blank input', () => {
    expect(normalizeCourse('')).toEqual({ matched: false, raw: '' })
    expect(normalizeCourse(null)).toEqual({ matched: false, raw: '' })
    expect(normalizeCourse(undefined).matched).toBe(false)
  })

  it('exposes catalog helpers', () => {
    expect(isCatalogCourse('bshm')).toBe(true)
    expect(isCatalogCourse('nope')).toBe(false)
    expect(resolveCourse('BS IT')?.code).toBe('BSIT')
    expect(resolveCourse('BS Basket Weaving')).toBeUndefined()
    expect(resolveCourse('bsit')?.code).toBe('BSIT')
  })
})

describe('courseScope', () => {
  const head = { role: 'teacher' as const, isDepartmentHead: true }

  it('is all-courses when managesAllCourses is set (it wins over a list)', () => {
    expect(courseScope({ ...head, managesAllCourses: true, managedCourses: ['BSIT'] })).toEqual({ kind: 'all' })
  })

  it('normalizes and de-duplicates the managed list', () => {
    expect(courseScope({ ...head, managedCourses: ['bsit', 'BS Information Technology', 'BSHM', 'junk'] })).toEqual({
      kind: 'courses',
      courses: ['BSIT', 'BSHM'],
    })
  })

  it('is fail-closed with no courses, no designation, or the wrong role', () => {
    expect(courseScope({ ...head })).toEqual({ kind: 'none' })
    expect(courseScope({ ...head, managedCourses: ['junk'] })).toEqual({ kind: 'none' })
    expect(courseScope({ role: 'teacher', managesAllCourses: true })).toEqual({ kind: 'none' })
    expect(courseScope({ role: 'student', isDepartmentHead: true, managesAllCourses: true })).toEqual({ kind: 'none' })
    expect(courseScope({ role: 'super_admin', isDepartmentHead: true, managesAllCourses: true })).toEqual({
      kind: 'none',
    })
    expect(courseScope(null)).toEqual({ kind: 'none' })
  })

  it('treats a registrar designee as a scope holder too', () => {
    expect(courseScope({ role: 'teacher', isUserRegistrar: true, managesAllCourses: true })).toEqual({ kind: 'all' })
  })
})

describe('oversightCourses', () => {
  it('returns null (all) for an all-courses head, a list for a course head, [] otherwise', () => {
    expect(oversightCourses({ role: 'teacher', isDepartmentHead: true, managesAllCourses: true })).toBeNull()
    expect(oversightCourses({ role: 'teacher', isDepartmentHead: true, managedCourses: ['BSIT'] })).toEqual(['BSIT'])
    expect(oversightCourses({ role: 'teacher', isDepartmentHead: true })).toEqual([])
    expect(oversightCourses({ role: 'teacher', isUserRegistrar: true, managesAllCourses: true })).toEqual([])
    expect(oversightCourses(undefined)).toEqual([])
  })
})

describe('courseInScope / labels', () => {
  it('checks membership through normalization', () => {
    const scope: CourseScope = { kind: 'courses', courses: ['BSIT'] }
    expect(courseInScope(scope, 'bs information technology')).toBe(true)
    expect(courseInScope(scope, 'BSHM')).toBe(false)
    expect(courseInScope(scope, null)).toBe(false)
    expect(courseInScope({ kind: 'all' }, 'anything')).toBe(true)
    expect(courseInScope({ kind: 'none' }, 'BSIT')).toBe(false)
  })

  it('labels heads by scope', () => {
    expect(courseHeadLabel({ role: 'teacher', isDepartmentHead: true, managesAllCourses: true })).toBe(
      'Head of Academic Programs',
    )
    expect(courseHeadLabel({ role: 'teacher', isDepartmentHead: true, managedCourses: ['BSIT', 'BSHM'] })).toBe(
      'Course Head (BSIT, BSHM)',
    )
    expect(courseHeadLabel({ role: 'teacher', isDepartmentHead: true })).toBe('Course Head')
  })

  it('normalizes lists', () => {
    expect(normalizeCourseList(['bsa', 'BS Accountancy', 'x'])).toEqual(['BSA'])
    expect(normalizeCourseList(null)).toEqual([])
  })
})
