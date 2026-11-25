'use client'

import { PUP_SANTA_MARIA_COURSES } from '@polycheck/shared'

export interface CourseScopeValue {
  managedCourses: string[]
  managesAllCourses: boolean
}

interface CourseScopeEditorProps {
  value: CourseScopeValue
  onChange: (next: CourseScopeValue) => void
  /** What the scope governs, for the helper copy: course oversight (head) and/or account administration (registrar). */
  subject: 'head' | 'registrar' | 'both'
}

const SUBJECT_COPY: Record<CourseScopeEditorProps['subject'], string> = {
  head: 'reports, excuses and at-risk students of the selected courses',
  registrar: 'student accounts and imports of the selected courses (all accounts when every course is selected)',
  both: 'oversight and student accounts of the selected courses',
}

/**
 * Course multi-select for head/registrar designees. "All courses" is the Head of
 * Academic Programs (and the campus-wide registrar); with nothing selected the
 * designation is fail-closed and sees no data.
 */
export function CourseScopeEditor({ value, onChange, subject }: CourseScopeEditorProps) {
  const toggleCourse = (code: string, checked: boolean) => {
    const next = checked ? [...value.managedCourses, code] : value.managedCourses.filter((entry) => entry !== code)
    onChange({ ...value, managedCourses: next })
  }
  const empty = !value.managesAllCourses && value.managedCourses.length === 0

  return (
    <div
      className="mt-3 border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/60"
      data-testid="course-scope-editor"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-maroon dark:text-golden">Course scope</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Controls {SUBJECT_COPY[subject]}. Courses come from the campus catalog.
      </p>

      <label className="mt-3 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-maroon dark:accent-golden"
          checked={value.managesAllCourses}
          onChange={(event) => onChange({ ...value, managesAllCourses: event.target.checked })}
        />
        <span className="text-sm text-foreground">
          <span className="font-semibold">All courses</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Head of Academic Programs: every course, with no classroom write access.
          </span>
        </span>
      </label>

      <fieldset className="mt-3" disabled={value.managesAllCourses}>
        <legend className="sr-only">Managed courses</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PUP_SANTA_MARIA_COURSES.map((course) => {
            const checked = value.managesAllCourses || value.managedCourses.includes(course.code)
            return (
              <label
                key={course.code}
                className={`flex items-start gap-2 border px-3 py-2 text-sm ${
                  checked
                    ? 'border-maroon/60 bg-maroon/5 dark:border-golden/60 dark:bg-golden/10'
                    : 'border-zinc-200 dark:border-zinc-800'
                } ${value.managesAllCourses ? 'opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-maroon dark:accent-golden"
                  checked={checked}
                  onChange={(event) => toggleCourse(course.code, event.target.checked)}
                  aria-label={`${course.code} — ${course.name}`}
                />
                <span>
                  <span className="font-semibold">{course.code}</span>
                  <span className="block text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                    {course.name}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {empty ? (
        <p role="note" className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
          No courses selected: this designation will see no data until at least one course is assigned.
        </p>
      ) : null}
    </div>
  )
}
