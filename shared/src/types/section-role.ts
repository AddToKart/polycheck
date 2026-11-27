export type SectionRoleType = 'president' | 'qac'

export interface SectionRole {
  id: string
  sectionId: string
  studentId: string
  studentName: string
  role: SectionRoleType
  grantedBy: string
  grantedAt: string
}

export interface SessionPermission {
  id: string
  sectionId: string
  studentId: string
  grantedBy: string
  grantedAt: string
  expiresAt: string
  isActive: boolean
  /** How many sessions this grant lets the president create. */
  sessionLimit: number
  sessionsUsed: number
}

/** One line of the live list a president sees; view only. */
export interface HostRosterEntry {
  studentName: string
  status: string
  /** When the student checked in; absent while they have not. */
  scannedAt?: string
}

/** What a president can do with a session they created (`GET /sessions/:id/host`). */
export interface HostSessionState {
  sessionId: string
  isActive: boolean
  endedAt?: string
  canStart: boolean
  canEnd: boolean
  /** Why starting or ending is unavailable. */
  message?: string
  /** Present only while a session the president started is running. */
  qrToken?: string
  qrTokenExpiresAt?: string
  gracePeriodMinutes: number
  roster: HostRosterEntry[]
}

export interface HostStartInput {
  validityMinutes: number
  gracePeriodMinutes: number
  latitude?: number
  longitude?: number
  accuracyMeters?: number
  locationCapturedAt?: string
  clientTime?: string
  mocked?: boolean
  deviceId?: string
}

export interface HostStartResult extends HostSessionState {
  /** True when starting inside the class area marked the president present. */
  markedPresent: boolean
  presenceMessage: string
}

export interface ProofOfClass {
  id: string
  sectionId: string
  sessionId: string
  uploadedBy: string
  uploadedByStudentName: string
  photoData: string
  uploadedAt: string
  description?: string
}

/** A class of a QAC's section that is happening today. */
export interface QacSessionSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  room?: string
  /** Photos can be uploaded right now. */
  open: boolean
  /** How many photos this officer already added to the session. */
  myPhotoCount: number
}

/** A section in which the signed-in student is a Quality Assurance Coordinator. */
export interface QacSection {
  sectionId: string
  subjectName: string
  subjectCode: string
  section: string
  course?: string
  teacherName: string
  /** Sessions that are live or scheduled today, earliest first. */
  sessions: QacSessionSlot[]
}
