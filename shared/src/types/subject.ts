export interface Subject {
  id: string
  name: string
  code: string
  description?: string
  createdAt: string
  updatedAt: string
  /** Set while the subject is archived (hidden at the end of a semester). */
  archivedAt?: string | null
  /** When an archived subject's evidence was erased. */
  evidencePurgedAt?: string | null
}

export interface ScheduleDay {
  day: DayOfWeek
  startTime: string
  endTime: string
  room?: string
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export interface Section {
  id: string
  subjectId: string
  /** Present when the section belongs to an archived subject. */
  subjectArchivedAt?: string
  section: string
  /**
   * Campus program/course short code (e.g. 'BSIT'). Two sections can
   * carry the same subject while belonging to different courses, so this must
   * be displayed anywhere a section is identified. Optional for legacy rows.
   */
  course?: string
  room: string
  schedule: ScheduleDay[]
  semester: string
  teacherId: string
  teacherName: string
  enrollmentCode?: string
  enrollmentCodeExpiry?: string
  studentCount: number
  createdAt: string
  updatedAt: string
}

export interface Enrollment {
  id: string
  studentId: string
  sectionId: string
  enrolledAt: string
}
