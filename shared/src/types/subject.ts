export interface ScheduleDay {
  day: DayOfWeek
  startTime: string
  endTime: string
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'

export interface Subject {
  id: string
  name: string
  code: string
  section: string
  room: string
  schedule: ScheduleDay[]
  semester: string
  teacherId: string
  teacherName: string
  enrollmentCode: string
  enrollmentCodeExpiry: string
  studentCount: number
  createdAt: string
  updatedAt: string
}

export interface Enrollment {
  id: string
  studentId: string
  subjectId: string
  enrolledAt: string
}
