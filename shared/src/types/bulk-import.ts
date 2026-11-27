export type ImportMode = 'validate' | 'execute'

export type ImportConflictMode = 'skip_existing' | 'update_existing'

export interface StudentImportRow {
  rowNumber: number
  fullName: string
  /** Normalized at parse time (trimmed + uppercased). */
  studentId: string
  email?: string
  program?: string
  yearLevel?: number
  department?: string
}

/** A class list row. It identifies the student by student number, or by school email when it has none. */
export interface EnrollImportRow {
  rowNumber: number
  studentId?: string
  /** The account's school email. Sent only when the row has no student number. */
  email?: string
  /** Verification only — never stored from the list. */
  studentName?: string
  /** Verification warning when it differs from the account. */
  expectedProgram?: string
  expectedYearLevel?: number
}

export type ImportIssueCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_STUDENT_NUMBER'
  | 'INVALID_EMAIL'
  | 'DUPLICATE_IN_FILE'
  | 'YEAR_LEVEL_OUT_OF_RANGE'
  | 'PROGRAM_TOO_SHORT'
  | 'DEPARTMENT_MISMATCH'
  | 'EXCEL_MANGLED_STUDENT_NUMBER'
  | 'STUDENT_NOT_FOUND'
  | 'STUDENT_INACTIVE'
  | 'ALREADY_ENROLLED'
  | 'ACCOUNT_ALREADY_EXISTS'
  | 'FIELD_UPDATE_PREVIEW'
  | 'PROGRAM_YEAR_MISMATCH'

export interface ImportIssue {
  rowNumber: number
  column?: string
  code: ImportIssueCode
  message: string
}

export interface ImportSummaryBase {
  total: number
  valid: number
  skip: number
  invalid: number
}

export interface StudentImportSummary extends ImportSummaryBase {
  new: number
  update: number
}

export interface EnrollImportSummary extends ImportSummaryBase {
  enrollable: number
  provisioning?: number
}

export interface ImportCredential {
  rowNumber: number
  studentId: string
  tempPassword: string
}

export interface StudentImportResult {
  mode: ImportMode
  conflictMode: ImportConflictMode
  /** Binds an execute request to the validated row set. */
  rowChecksum: string
  summary: StudentImportSummary
  /** Capped at 50 in the response payload. */
  issues: ImportIssue[]
  hasMoreIssues: boolean
  /** Execute-only, returned exactly once. Never persisted or resendable. */
  credentials?: ImportCredential[]
  /** Present only for `activation_email` imports. */
  activation?: { queued: number; fallbackTemporary: number }
}

export interface EnrollImportResult {
  mode: ImportMode
  rowChecksum: string
  summary: EnrollImportSummary
  issues: ImportIssue[]
  hasMoreIssues: boolean
}

export interface ImportChunkResult {
  chunkIndex: number
  created: number
  updated?: number
  skipped: number
  failed: number
}

/**
 * How new student accounts receive their first credential. Omitted = `temporary_password`
 * (today's behavior). `activation_email` emails a single-use activation link to rows that
 * have an email; rows without one fall back to a temporary password.
 */
export type StudentImportDeliveryMode = 'temporary_password' | 'activation_email'

export interface StudentImportRequest {
  mode: ImportMode
  conflictMode: ImportConflictMode
  rows: StudentImportRow[]
  deliveryMode?: StudentImportDeliveryMode
  idempotencyKey?: string
  /** Required for execute; must equal the value returned by validate. */
  rowChecksum?: string
}

export interface EnrollImportRequest {
  mode: ImportMode
  rows: EnrollImportRow[]
  idempotencyKey?: string
  rowChecksum?: string
}

export type ImportJobState = 'waiting' | 'active' | 'completed' | 'failed' | 'unknown'

export interface ImportJobStatus {
  id: string
  state: ImportJobState
  progress?: { chunksDone: number; chunksTotal: number }
  result?: StudentImportResult
  error?: string
}

/** Server-side import audit summary (counts and codes only — never PII rows). */
export interface ImportBatchSummary {
  id: string
  kind: 'student_registration' | 'section_enrollment'
  actorId: string
  department?: string
  createdAt: string
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  rowChecksum: string
}
