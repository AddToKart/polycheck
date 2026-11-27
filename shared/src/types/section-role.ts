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
