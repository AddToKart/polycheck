export interface Subject {
  id: string
  name: string
  code: string
  description?: string
  createdAt: string
  updatedAt: string
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
  section: string
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
