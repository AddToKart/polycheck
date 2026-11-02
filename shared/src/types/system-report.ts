import type { User } from './user'

export type ReportCategory =
  | 'scanner_camera'
  | 'geofence_gps'
  | 'ui_display'
  | 'enrollment_roster'
  | 'account_login'
  | 'feedback_suggestion'

export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  'scanner_camera',
  'geofence_gps',
  'ui_display',
  'enrollment_roster',
  'account_login',
  'feedback_suggestion',
]

export const REPORT_SEVERITIES: readonly ReportSeverity[] = ['low', 'medium', 'high', 'critical']

export const REPORT_STATUSES: readonly ReportStatus[] = ['open', 'in_review', 'resolved', 'dismissed']

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  scanner_camera: 'Scanner / camera',
  geofence_gps: 'Geofence / GPS',
  ui_display: 'UI / display',
  enrollment_roster: 'Enrollment / roster',
  account_login: 'Account / login',
  feedback_suggestion: 'Feedback / suggestion',
}

export const REPORT_SEVERITY_LABELS: Record<ReportSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export interface ReportSubmitter {
  id: string
  fullName: string
  role: User['role']
  studentId?: string | null
  email?: string | null
  department?: string | null
}

export interface SystemReport {
  id: string
  category: ReportCategory
  severity: ReportSeverity
  title: string
  description: string
  status: ReportStatus
  /** Client-supplied diagnostic context (bounded strings). */
  deviceInfo?: string | null
  appVersion?: string | null
  route?: string | null
  networkType?: string | null
  /** Streaming endpoint when an attachment exists; undefined otherwise. */
  screenshotUrl?: string | null
  adminNotes?: string | null
  resolvedAt?: string | null
  resolvedBy?: string | null
  createdAt: string
  updatedAt: string
  user: ReportSubmitter
}

export interface CreateSystemReportInput {
  category: ReportCategory
  severity: ReportSeverity
  title: string
  description: string
  /** JPEG/PNG/WebP data URL. Size and magic bytes are re-validated server-side. */
  screenshotData?: string
  /** Auto-captured client telemetry (identity is stamped server-side). */
  deviceInfo?: string
  appVersion?: string
  route?: string
  networkType?: string
}

export interface UpdateSystemReportStatusInput {
  status: ReportStatus
  adminNotes?: string
}

export interface SystemReportFilters {
  category?: ReportCategory
  severity?: ReportSeverity
  status?: ReportStatus
  role?: 'student' | 'teacher'
  search?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface SystemReportPage {
  data: SystemReport[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface SystemReportStats {
  total: number
  open: number
  inReview: number
  resolved: number
  dismissed: number
  scannerAndGps: number
  resolvedThisMonth: number
  critical: number
}
