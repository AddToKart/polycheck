/**
 * PUP Santa Maria course (degree program) catalog.
 *
 * PUP Santa Maria has no academic departments: it has courses (degree
 * programs), each with a head professor. The catalog is therefore a flat list
 * and the course `code` is the only scoping key. Codes are stored verbatim on
 * `Section.course` and normalized into `User.program` for students; names are
 * display-only.
 *
 * Source: the eight programs published on the official campus page
 * (https://www.pup.edu.ph/stamaria/), cross-checked against the campus-maintained
 * site. The page is undated, so the registrar's sign-off is a release gate
 * (see plan/course-scope-plan.md §4.1). Teachers can still enter an off-catalog
 * course through the form's "Other — specify manually" option; such values are
 * never silently dropped, but heads cannot be assigned to them.
 */
export interface PupCourse {
  /** Short program code stored on the section, e.g. 'BSIT'. */
  code: string
  /** Full official program name for display. */
  name: string
  /** Alternate spellings that normalize to this code (matched ignoring case, spacing and punctuation). */
  aliases: readonly string[]
  /**
   * Legacy grouping key from the pre-course draft catalog. Never set on the
   * current entries; kept optional so older consumers still compile.
   */
  department?: string
}

export const PUP_SANTA_MARIA_COURSES: PupCourse[] = [
  { code: 'BSA', name: 'Bachelor of Science in Accountancy', aliases: ['BS Accountancy'] },
  {
    code: 'BSCpE',
    name: 'Bachelor of Science in Computer Engineering',
    aliases: ['BSCPE', 'BS Computer Engineering'],
  },
  {
    code: 'BSENTREP',
    name: 'Bachelor of Science in Entrepreneurship',
    aliases: ['BS Entrepreneurship', 'BSEntrep'],
  },
  {
    code: 'BSHM',
    name: 'Bachelor of Science in Hospitality Management',
    aliases: ['BS Hospitality Management'],
  },
  {
    code: 'BSIT',
    name: 'Bachelor of Science in Information Technology',
    aliases: ['BS Information Technology'],
  },
  {
    code: 'BSEDEN',
    name: 'Bachelor of Secondary Education major in English',
    aliases: ['BSED-EN', 'BSEd English', 'BSEd major in English'],
  },
  {
    code: 'BSEDMT',
    name: 'Bachelor of Secondary Education major in Mathematics',
    aliases: ['BSED-MT', 'BSEd Math', 'BSEd Mathematics', 'BSEd major in Mathematics'],
  },
  {
    code: 'DOMTLOM',
    name: 'Diploma in Office Management Technology – Legal Office Management',
    aliases: ['DOMT', 'DOMT-LOM', 'Diploma in Office Management Technology'],
  },
]

/** Case-insensitive catalog lookup by program code. */
export const pupCourseByCode = (code?: string | null): PupCourse | undefined => {
  const needle = code?.trim().toLowerCase()
  if (!needle) return undefined
  return PUP_SANTA_MARIA_COURSES.find((course) => course.code.toLowerCase() === needle)
}

/** Display name for a stored course code, falling back to the raw code. */
export const pupCourseName = (code?: string | null): string => {
  const trimmed = code?.trim()
  if (!trimmed) return ''
  return pupCourseByCode(trimmed)?.name ?? trimmed
}

/** Every catalog code, in catalog order. */
export const pupCourseCodes = (): string[] => PUP_SANTA_MARIA_COURSES.map((course) => course.code)

/** Label of the single bucket returned by the legacy grouping wrapper. */
export const PUP_COURSES_GROUP_LABEL = 'PUP Santa Maria programs'

/**
 * Legacy wrapper kept so older selectors keep compiling. The campus has no
 * departments, so this is always one bucket containing the whole catalog.
 */
export const pupCoursesByDepartment = (): { department: string; courses: PupCourse[] }[] => [
  { department: PUP_COURSES_GROUP_LABEL, courses: [...PUP_SANTA_MARIA_COURSES] },
]
