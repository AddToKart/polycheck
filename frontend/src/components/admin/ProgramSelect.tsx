'use client'

import { CAMPUS_COURSES, normalizeCourse } from '@polycheck/shared'

/** The catalog code for a stored program, or the stored text when it matches none. */
export function programSelectValue(stored: string): string {
  const trimmed = stored.trim()
  if (!trimmed) return ''
  const course = normalizeCourse(trimmed)
  return course.matched ? (course.code ?? trimmed) : trimmed
}

/**
 * A student's program (the campus calls it the course): one of the campus programs. An older record whose
 * program matches none of them keeps its value as an extra choice, so opening a form never changes it silently.
 */
export function ProgramSelect({
  id,
  value,
  onChange,
  required = true,
  className = '',
}: {
  id: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}) {
  const selected = programSelectValue(value)
  const offCatalog = selected !== '' && !CAMPUS_COURSES.some((course) => course.code === selected)
  return (
    <select
      id={id}
      value={selected}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className={`h-10 w-full min-w-0 border border-zinc-300 bg-white px-3 text-base text-foreground sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <option value="" disabled>
        Select a program
      </option>
      {CAMPUS_COURSES.map((course) => (
        <option key={course.code} value={course.code}>
          {course.code} - {course.name}
        </option>
      ))}
      {offCatalog ? <option value={selected}>{selected} (not in the program list)</option> : null}
    </select>
  )
}
