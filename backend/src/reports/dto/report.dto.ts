import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import {
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '@polycheck/shared'

export class CreateSystemReportDto {
  @IsIn(REPORT_CATEGORIES as readonly ReportCategory[])
  category!: ReportCategory

  @IsIn(REPORT_SEVERITIES as readonly ReportSeverity[])
  severity!: ReportSeverity

  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string

  @IsString()
  @MinLength(10)
  @MaxLength(4_000)
  description!: string

  /** Client-validated data URL; re-verified (magic bytes + size) server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(7_500_000)
  screenshotData?: string

  // ── Auto-captured client telemetry (identity is stamped server-side) ──
  @IsOptional() @IsString() @MaxLength(200) deviceInfo?: string
  @IsOptional() @IsString() @MaxLength(200) appVersion?: string
  @IsOptional() @IsString() @MaxLength(200) route?: string
  @IsOptional() @IsString() @MaxLength(20) networkType?: string
}

export class UpdateSystemReportStatusDto {
  @IsIn(REPORT_STATUSES as readonly ReportStatus[])
  status!: ReportStatus

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminNotes?: string
}

export class SystemReportQueryDto {
  @IsOptional() @IsIn(REPORT_CATEGORIES as readonly ReportCategory[]) category?: ReportCategory
  @IsOptional() @IsIn(REPORT_SEVERITIES as readonly ReportSeverity[]) severity?: ReportSeverity
  @IsOptional() @IsIn(REPORT_STATUSES as readonly ReportStatus[]) status?: ReportStatus
  @IsOptional() @IsIn(['student', 'teacher']) role?: 'student' | 'teacher'
  @IsOptional() @IsString() @MaxLength(100) search?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @MaxLength(10) limit?: string
  @IsOptional() @IsString() @MaxLength(10) offset?: string
}
