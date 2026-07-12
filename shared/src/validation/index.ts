import { z } from 'zod'

export const DayOfWeekEnum = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

export const ScheduleDaySchema = z.object({
  day: DayOfWeekEnum,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  room: z.string().optional(),
})

export const GeofenceConfigSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(500),
})

export const SubjectCreateSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  description: z.string().optional(),
})

export const SectionCreateSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  section: z.string().min(1, 'Section is required'),
  room: z.string().min(1, 'Room is required'),
  schedule: z.array(ScheduleDaySchema).min(1, 'At least one schedule day required'),
  semester: z.string().min(1, 'Semester is required'),
  teacherId: z.string().min(1, 'Teacher is required'),
  teacherName: z.string().min(1, 'Teacher name is required'),
})

export const SessionCreateSchema = z.object({
  sectionId: z.string().min(1),
  subjectName: z.string().min(1, 'Subject name is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  room: z.string().optional(),
  qrValidityMinutes: z.number().min(1).max(180).default(20),
  gracePeriodMinutes: z.number().min(0).max(120).default(15),
  geofence: GeofenceConfigSchema,
  teacherId: z.string().min(1, 'Teacher is required'),
  isRescheduled: z.boolean().optional(),
  rescheduledFromDate: z.string().optional(),
  originalScheduleTime: z.string().optional(),
  originalRoom: z.string().optional(),
})

export const AttendanceRecordSchema = z.object({
  sessionId: z.string().min(1),
  sectionId: z.string().min(1),
  studentId: z.string().min(1),
  timestamp: z.string().datetime(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  deviceId: z.string().optional(),
})

export const SectionRoleTypeEnum = z.enum(['president', 'qac'])

export const AssignSectionRoleSchema = z.object({
  sectionId: z.string().min(1),
  studentId: z.string().min(1),
  role: SectionRoleTypeEnum,
})

export const ProofOfClassUploadSchema = z.object({
  sectionId: z.string().min(1),
  sessionId: z.string().min(1),
  photoData: z.string().min(1),
  description: z.string().optional(),
  uploadedBy: z.string().min(1),
  uploadedByStudentName: z.string().min(1),
})
