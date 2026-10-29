import { z } from 'zod'

// Keep browser validation compatible with the production CSP. Zod's optional
// JIT path probes `Function(...)`, which Firefox reports as a CSP violation even
// though Zod catches the failure and falls back to its interpreter.
z.config({ jitless: true })

export const DayOfWeekEnum = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a real HH:mm time')
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Must be a real calendar date')

export const ScheduleDaySchema = z.object({
  day: DayOfWeekEnum,
  startTime: TimeSchema,
  endTime: TimeSchema,
  room: z.string().optional(),
}).refine((value) => value.endTime > value.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
})

export const GeofenceConfigSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(500),
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
  // Derived from the authenticated teacher by the API; accepted only for
  // backward-compatible callers that still include them.
  teacherId: z.string().min(1).optional(),
  teacherName: z.string().min(1).optional(),
})

export const SessionCreateSchema = z.object({
  sectionId: z.string().min(1),
  subjectName: z.string().min(1, 'Subject name is required'),
  date: IsoDateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema,
  room: z.string().optional(),
  qrValidityMinutes: z.number().min(1).max(15).default(15),
  gracePeriodMinutes: z.number().min(0).max(60).default(15),
  geofence: GeofenceConfigSchema,
  teacherId: z.string().min(1, 'Teacher is required'),
  isRescheduled: z.boolean().optional(),
  rescheduledFromDate: IsoDateSchema.optional(),
  originalScheduleTime: z.string().optional(),
  originalRoom: z.string().optional(),
}).refine((value) => value.endTime > value.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
})

export const AttendanceStatusSchema = z.enum(['present', 'late', 'absent', 'pending', 'disputed', 'excused'])

export const AttendanceRecordSchema = z.object({
  sessionId: z.string().min(1),
  sectionId: z.string().min(1),
  studentId: z.string().min(1),
  status: AttendanceStatusSchema,
  timestamp: z.string().datetime().optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  deviceId: z.string().optional(),
  excuseStatus: z.enum(['requested', 'approved', 'rejected']).optional(),
  excuseReason: z.enum(['medical', 'family_emergency', 'school_activity', 'transportation', 'bereavement', 'other']).optional(),
  excuseDescription: z.string().max(1_000).optional(),
  excuseEvidencePath: z.string().optional(),
  excuseReviewedBy: z.string().optional(),
  excuseReviewedAt: z.string().optional(),
  excuseReviewNote: z.string().max(500).optional(),
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

// ── Account governance (GOV) ──

export const EmergencyDeviceReleaseReasonSchema = z.enum([
  'dead_battery',
  'lost_or_damaged',
  'borrowed_device',
  'other',
])

export const TeacherResetStudentPasswordSchema = z.object({
  sectionId: z.string().min(1, 'Section is required').max(64),
})

export const EmergencyDeviceReleaseSchema = z.object({
  sectionId: z.string().min(1, 'Section is required').max(64),
  reason: EmergencyDeviceReleaseReasonSchema,
  note: z.string().trim().max(280, 'Reason note must be 280 characters or fewer').optional(),
})

const OptionalEmailOrEmptySchema = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Must be a valid email address')

const OptionalPhoneOrEmptySchema = z
  .string()
  .trim()
  .max(20)
  .refine((value) => value === '' || /^\+?[0-9\s-]{7,20}$/.test(value), 'Must be a valid phone number')

export const UpdateContactsSchema = z
  .object({
    contactEmail: OptionalEmailOrEmptySchema.optional(),
    contactPhone: OptionalPhoneOrEmptySchema.optional(),
  })
  .refine((value) => value.contactEmail !== undefined || value.contactPhone !== undefined, {
    message: 'Provide at least one contact field',
  })

export const DeviceCooldownHoursSchema = z.number().int().min(1).max(24)

export * from './bulk-import'
export * from './ai'
export * from './excuse'
