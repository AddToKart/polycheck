import {
  courseInScope,
  courseScopeMode,
  designeeCourseScope,
  hasOversightScope,
  oversightCourseList,
  oversightRecordWhere,
  oversightSectionWhere,
  oversightSessionWhere,
  resetCourseScopeWarningForTests,
  sectionCourseWhere,
} from './course-scope'
import { academicOversightDepartment } from './designations/department-pin'

type Actor = Parameters<typeof designeeCourseScope>[0]

const head = (extra: Record<string, unknown> = {}): NonNullable<Actor> =>
  ({ role: 'teacher', department: 'CCIS', isDepartmentHead: true, ...extra }) as NonNullable<Actor>

describe('courseScopeMode', () => {
  beforeEach(() => resetCourseScopeWarningForTests())

  it('defaults to legacy and accepts course (case-insensitive)', () => {
    expect(courseScopeMode({} as NodeJS.ProcessEnv)).toBe('legacy')
    expect(courseScopeMode({ COURSE_SCOPE_MODE: '' } as NodeJS.ProcessEnv)).toBe('legacy')
    expect(courseScopeMode({ COURSE_SCOPE_MODE: 'legacy' } as NodeJS.ProcessEnv)).toBe('legacy')
    expect(courseScopeMode({ COURSE_SCOPE_MODE: ' Course ' } as NodeJS.ProcessEnv)).toBe('course')
  })

  it('degrades unknown values to legacy', () => {
    expect(courseScopeMode({ COURSE_SCOPE_MODE: 'coruse' } as NodeJS.ProcessEnv)).toBe('legacy')
  })

  it('reads process.env by default', () => {
    const original = process.env.COURSE_SCOPE_MODE
    try {
      process.env.COURSE_SCOPE_MODE = 'course'
      expect(courseScopeMode()).toBe('course')
      delete process.env.COURSE_SCOPE_MODE
      expect(courseScopeMode()).toBe('legacy')
    } finally {
      if (original === undefined) delete process.env.COURSE_SCOPE_MODE
      else process.env.COURSE_SCOPE_MODE = original
    }
  })
})

describe('designeeCourseScope', () => {
  it('is all-courses when managesAllCourses (it wins over a list)', () => {
    expect(designeeCourseScope(head({ managesAllCourses: true, managedCourses: ['BSIT'] }))).toEqual({ kind: 'all' })
  })

  it('trims, de-duplicates (case-insensitive) and keeps the stored spelling', () => {
    expect(designeeCourseScope(head({ managedCourses: [' BSIT ', 'bsit', 'BSHM', ''] }))).toEqual({
      kind: 'courses',
      courses: ['BSIT', 'BSHM'],
    })
  })

  it('is fail-closed for empty scope, non-designees, other roles and null', () => {
    expect(designeeCourseScope(head())).toEqual({ kind: 'none' })
    expect(designeeCourseScope({ role: 'teacher', managesAllCourses: true })).toEqual({ kind: 'none' })
    expect(designeeCourseScope({ role: 'student', isDepartmentHead: true, managesAllCourses: true })).toEqual({
      kind: 'none',
    })
    expect(designeeCourseScope({ role: 'super_admin', isDepartmentHead: true, managesAllCourses: true })).toEqual({
      kind: 'none',
    })
    expect(designeeCourseScope(null)).toEqual({ kind: 'none' })
  })

  it('a registrar designee carries a scope too', () => {
    expect(designeeCourseScope({ role: 'teacher', isUserRegistrar: true, managedCourses: ['BSHM'] })).toEqual({
      kind: 'courses',
      courses: ['BSHM'],
    })
  })
})

describe('courseInScope / sectionCourseWhere', () => {
  it('matches case-insensitively and fails closed', () => {
    const scope = { kind: 'courses', courses: ['BSIT'] } as const
    expect(courseInScope({ ...scope, courses: [...scope.courses] }, ' bsit ')).toBe(true)
    expect(courseInScope({ kind: 'courses', courses: ['BSIT'] }, 'BSHM')).toBe(false)
    expect(courseInScope({ kind: 'courses', courses: ['BSIT'] }, null)).toBe(false)
    expect(courseInScope({ kind: 'all' }, 'whatever')).toBe(true)
    expect(courseInScope({ kind: 'none' }, 'BSIT')).toBe(false)
  })

  it('builds the section filter', () => {
    expect(sectionCourseWhere({ kind: 'all' })).toEqual({})
    expect(sectionCourseWhere({ kind: 'none' })).toEqual({ id: { in: [] } })
    expect(sectionCourseWhere({ kind: 'courses', courses: ['BSIT', 'BSHM'] })).toEqual({
      OR: [{ course: { equals: 'BSIT', mode: 'insensitive' } }, { course: { equals: 'BSHM', mode: 'insensitive' } }],
    })
  })
})

describe('oversightSectionWhere — legacy mode (parity with the previous inline clause)', () => {
  it('is exactly the old teacher-department clause', () => {
    expect(oversightSectionWhere(head(), 'legacy')).toEqual({
      teacher: { department: { equals: 'CCIS', mode: 'insensitive' } },
    })
  })

  it('agrees with academicOversightDepartment for every actor shape', () => {
    const actors = [
      head(),
      head({ department: '  ' }),
      head({ department: undefined }),
      head({ isDepartmentHead: false }),
      { role: 'student' as const, department: 'CCIS', isDepartmentHead: true },
      { role: 'super_admin' as const, department: 'CCIS', isDepartmentHead: true },
      { role: 'teacher' as const, department: 'CCIS' },
    ] as NonNullable<Actor>[]
    for (const actor of actors) {
      const legacyDepartment = academicOversightDepartment(actor as never)
      const where = oversightSectionWhere(actor, 'legacy')
      expect(where === null).toBe(legacyDepartment === null)
    }
  })

  it('ignores course fields entirely', () => {
    expect(oversightSectionWhere(head({ managesAllCourses: true, managedCourses: ['BSHM'] }), 'legacy')).toEqual({
      teacher: { department: { equals: 'CCIS', mode: 'insensitive' } },
    })
  })

  it('a head without a department has no oversight (plain-teacher fallback)', () => {
    expect(oversightSectionWhere(head({ department: null }), 'legacy')).toBeNull()
    expect(hasOversightScope(head({ department: null }), 'legacy')).toBe(false)
  })
})

describe('oversightSectionWhere — course mode', () => {
  it('pins a course head to their courses regardless of their department', () => {
    expect(oversightSectionWhere(head({ department: 'Unspecified', managedCourses: ['BSIT'] }), 'course')).toEqual({
      OR: [{ course: { equals: 'BSIT', mode: 'insensitive' } }],
    })
  })

  it('a Head of Academic Programs sees every course (no predicate)', () => {
    expect(oversightSectionWhere(head({ managesAllCourses: true }), 'course')).toEqual({})
    expect(hasOversightScope(head({ managesAllCourses: true }), 'course')).toBe(true)
  })

  it('a head with no courses has no oversight (fail-closed to plain-teacher behavior)', () => {
    expect(oversightSectionWhere(head(), 'course')).toBeNull()
    expect(oversightSectionWhere(head({ managedCourses: [] }), 'course')).toBeNull()
    expect(hasOversightScope(head(), 'course')).toBe(false)
  })

  it('never grants oversight to non-heads', () => {
    expect(oversightSectionWhere({ role: 'teacher', managesAllCourses: true }, 'course')).toBeNull()
    expect(
      oversightSectionWhere({ role: 'student', isDepartmentHead: true, managesAllCourses: true }, 'course'),
    ).toBeNull()
    expect(oversightSectionWhere({ role: 'super_admin', managesAllCourses: true }, 'course')).toBeNull()
    expect(oversightSectionWhere(null, 'course')).toBeNull()
  })

  it('a registrar-only designee is not an oversight head', () => {
    expect(
      oversightSectionWhere({ role: 'teacher', isUserRegistrar: true, managesAllCourses: true }, 'course'),
    ).toBeNull()
  })
})

describe('oversight session/record wrappers', () => {
  it('nest the section clause the way the call sites did', () => {
    const user = head()
    expect(oversightSessionWhere(user, 'legacy')).toEqual({
      section: { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } },
    })
    expect(oversightRecordWhere(user, 'legacy')).toEqual({
      session: { section: { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } } },
    })
    expect(oversightSessionWhere({ role: 'teacher' }, 'legacy')).toBeNull()
    expect(oversightRecordWhere({ role: 'teacher' }, 'course')).toBeNull()
  })

  it('uses the process mode when none is passed', () => {
    const original = process.env.COURSE_SCOPE_MODE
    try {
      process.env.COURSE_SCOPE_MODE = 'course'
      expect(oversightSessionWhere(head({ managedCourses: ['BSIT'] }))).toEqual({
        section: { OR: [{ course: { equals: 'BSIT', mode: 'insensitive' } }] },
      })
    } finally {
      if (original === undefined) delete process.env.COURSE_SCOPE_MODE
      else process.env.COURSE_SCOPE_MODE = original
    }
  })
})

describe('oversightCourseList', () => {
  it('returns null for all, the list for course heads, and [] otherwise', () => {
    expect(oversightCourseList(head({ managesAllCourses: true }))).toBeNull()
    expect(oversightCourseList(head({ managedCourses: ['BSIT', 'BSHM'] }))).toEqual(['BSIT', 'BSHM'])
    expect(oversightCourseList(head())).toEqual([])
    expect(oversightCourseList({ role: 'teacher', isUserRegistrar: true, managesAllCourses: true })).toEqual([])
    expect(oversightCourseList(null)).toEqual([])
  })
})
