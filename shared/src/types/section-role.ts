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
