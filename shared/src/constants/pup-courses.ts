/**
 * PUP Santa Maria course (degree program) catalog.
 *
 * This is the default value list for the section "Course" selector. The codes
 * are stored verbatim on `Section.course`; the names are display-only.
 *
 * DRAFT: confirm every entry against the official PUP Santa Maria program
 * offerings before release, then keep this file as the single source of truth.
 * Teachers can still enter an off-catalog course through the form's
 * "Other — specify manually" option.
 */
export interface PupCourse {
  /** Short program code stored on the section, e.g. 'BSIT'. */
  code: string
  /** Full program name for display. */
  name: string
  /** Optional grouping key used by the selector (department/college). */
  department?: string
}

export const PUP_SANTA_MARIA_COURSES: PupCourse[] = [
  // College of Computer and Information Sciences (CCIS)
  { code: 'BSIT', name: 'BS Information Technology', department: 'CCIS' },
  { code: 'BSCS', name: 'BS Computer Science', department: 'CCIS' },
  { code: 'BSIS', name: 'BS Information Systems', department: 'CCIS' },
  // Business / Accountancy
  { code: 'BSA', name: 'BS Accountancy', department: 'Business' },
  { code: 'BSMA', name: 'BS Management Accounting', department: 'Business' },
  { code: 'BSAIS', name: 'BS Accounting Information Systems', department: 'Business' },
  { code: 'BSBA', name: 'BS Business Administration', department: 'Business' },
  { code: 'BSHM', name: 'BS Hospitality Management', department: 'Business' },
  { code: 'BSTM', name: 'BS Tourism Management', department: 'Business' },
  // Engineering
  { code: 'BSCE', name: 'BS Civil Engineering', department: 'Engineering' },
  { code: 'BSECE', name: 'BS Electronics Engineering', department: 'Engineering' },
  { code: 'BSME', name: 'BS Mechanical Engineering', department: 'Engineering' },
  { code: 'BSEE', name: 'BS Electrical Engineering', department: 'Engineering' },
  { code: 'BSIE', name: 'BS Industrial Engineering', department: 'Engineering' },
  // Teacher Education
  { code: 'BEEd', name: 'Bachelor of Elementary Education', department: 'Education' },
  { code: 'BSEd', name: 'Bachelor of Secondary Education', department: 'Education' },
  { code: 'BTVTE', name: 'Bachelor of Technical-Vocational Teacher Education', department: 'Education' },
  // Industrial Technology
  { code: 'BIT', name: 'Bachelor of Industrial Technology', department: 'Industrial Technology' },
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

/** Catalog entries grouped by department, preserving list order. */
export const pupCoursesByDepartment = (): { department: string; courses: PupCourse[] }[] => {
  const groups = new Map<string, PupCourse[]>()
  for (const course of PUP_SANTA_MARIA_COURSES) {
    const key = course.department ?? 'Other'
    const bucket = groups.get(key)
    if (bucket) bucket.push(course)
    else groups.set(key, [course])
  }
  return Array.from(groups, ([department, courses]) => ({ department, courses }))
}
