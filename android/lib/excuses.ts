import type { AttendanceRecord, ExcuseReason, ExcuseStatus } from '@polycheck/shared'
import { isInDateRange } from './filters'

export const EXCUSE_REASON_OPTIONS: Array<{ value: ExcuseReason; label: string }> = [
  { value: 'medical', label: 'Medical or health reason' },
  { value: 'family_emergency', label: 'Family emergency' },
  { value: 'school_activity', label: 'Official school activity' },
  { value: 'transportation', label: 'Transportation problem' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'other', label: 'Other reason' },
]

const REASON_LABELS: Record<ExcuseReason, string> = {
  medical: 'Medical',
  family_emergency: 'Family emergency',
  school_activity: 'School activity',
  transportation: 'Transportation',
  bereavement: 'Bereavement',
  other: 'Other',
}

export const EXCUSE_STATUS_META: Record<ExcuseStatus, {
  label: string
  classes: string
  textClasses: string
}> = {
  requested: {
    label: 'Requested',
    classes: 'border-golden bg-golden/20 dark:border-golden/60 dark:bg-golden/10',
    textClasses: 'text-maroon-dark dark:text-golden',
  },
  approved: {
    label: 'Approved',
    classes: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    textClasses: 'text-emerald-800 dark:text-emerald-300',
  },
  rejected: {
    label: 'Rejected',
    classes: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
    textClasses: 'text-red-800 dark:text-red-300',
  },
}

export function excuseReasonLabel(reason?: ExcuseReason): string {
  return reason ? REASON_LABELS[reason] : ''
}

export function excuseStatusLabel(status?: ExcuseStatus): string {
  return status ? EXCUSE_STATUS_META[status].label : ''
}

/**
 * Students can request an excuse for a synced absent/late record. A rejected
 * request may be filed again; an open or approved request may not.
 */
export function isExcuseEligible(record: AttendanceRecord | null | undefined): boolean {
  if (!record || !record.isSynced) return false
  if (record.status !== 'absent' && record.status !== 'late') return false
  return !record.excuseStatus || record.excuseStatus === 'rejected'
}

export function validateExcuseForm(input: {
  reason: ExcuseReason | null
  description: string
}): string | null {
  if (!input.reason) return 'Select a reason for the absence or lateness.'
  const description = input.description.trim()
  if (description.length < 10) return 'Describe the reason in at least 10 characters.'
  if (description.length > 1_000) return 'Keep the description under 1,000 characters.'
  return null
}

/** Newest session first; pending requests do not need a separate sort. */
export function sortExcuseRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export type ExcuseTab = 'pending' | 'resolved'

/** Teacher queue filtering: open requests vs. decided ones, by section/date. */
export function filterExcuseRecords(
  records: AttendanceRecord[],
  filters: { tab: ExcuseTab; sectionId?: string; startDate?: string; endDate?: string },
): AttendanceRecord[] {
  return sortExcuseRecords(records.filter((record) => {
    if (!record.excuseStatus) return false
    const inTab = filters.tab === 'pending'
      ? record.excuseStatus === 'requested'
      : record.excuseStatus !== 'requested'
    if (!inTab) return false
    if (filters.sectionId && record.sectionId !== filters.sectionId) return false
    return isInDateRange(record.timestamp, filters.startDate, filters.endDate)
  }))
}
