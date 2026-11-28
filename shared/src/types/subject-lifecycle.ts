/**
 * Archiving a subject hides it for the rest of its life unless it is restored. This long after archiving,
 * its evidence (class photos, excuse photos, location data and scan logs) is erased for good. Attendance
 * results are kept. The Privacy Policy states the same number, so change both together.
 */
export const ARCHIVE_EVIDENCE_RETENTION_DAYS = 90

/** Error code for a change attempted on an archived subject. */
export const SUBJECT_ARCHIVED_CODE = 'subject_archived'

export function archiveEvidencePurgeAt(archivedAt: string | Date): Date {
  return new Date(new Date(archivedAt).getTime() + ARCHIVE_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

export interface SubjectArchiveCounts {
  sections: number
  sessions: number
  attendanceRecords: number
  classPhotos: number
  excusePhotos: number
}

/** What the archive screen shows: when the evidence goes, and how much there is. */
export interface SubjectLifecycle {
  subjectId: string
  name: string
  code: string
  archivedAt: string | null
  /** When the evidence will be erased. Null while the subject is active. */
  evidencePurgeAt: string | null
  evidencePurgedAt: string | null
  counts: SubjectArchiveCounts
}
