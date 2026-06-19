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
  section: z.string().min(1, 'Section is required'),
  room: z.string().min(1, 'Room is required'),
  schedule: z.array(ScheduleDaySchema).min(1, 'At least one schedule day required'),
  semester: z.string().min(1, 'Semester is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadiusMeters: z.number().min(10).max(500).default(40),
})

export const SessionCreateSchema = z.object({
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  gracePeriodMinutes: z.number().min(0).max(60).default(15),
  tokenWindowSeconds: z.number().min(60).max(600).default(180),
})

export const AttendanceRecordSchema = z.object({
  sessionId: z.string().min(1),
  subjectId: z.string().min(1),
  studentId: z.string().min(1),
  timestamp: z.string().datetime(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  deviceId: z.string().optional(),
  tokenPayload: z.string().optional(),
})
