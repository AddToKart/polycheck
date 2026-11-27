/**
 * Temporary self sign-up for data gathering: the landing page collects a
 * request, and an account exists only after a super admin approves it.
 */
export type RegistrationRole = 'student' | 'teacher'
export type RegistrationStatus = 'pending' | 'approved'

/** `GET /registrations/public/status`. */
export interface RegistrationOpenStatus {
  open: boolean
  programs: Array<{ code: string; name: string }>
}

/** Body of `POST /registrations/public`. */
export interface RegistrationInput {
  role: RegistrationRole
  fullName: string
  email: string
  password: string
  studentId?: string
  program?: string
  yearLevel?: number
  consent: boolean
  /** Left empty by people; bots tend to fill it. */
  website?: string
}

/** Why a waiting request needs a closer look. */
export type RegistrationIssue = 'account_exists' | 'duplicate_request'

export interface RegistrationRequestView {
  id: string
  role: RegistrationRole
  fullName: string
  email: string
  studentId?: string
  program?: string
  yearLevel?: number
  status: RegistrationStatus
  createdAt: string
  reviewedAt?: string
  issues: RegistrationIssue[]
}

export interface RegistrationList {
  open: boolean
  items: RegistrationRequestView[]
  pendingCount: number
}

export interface RegistrationApprovalResult {
  approved: number
  failed: Array<{ id: string; fullName: string; reason: string }>
}
