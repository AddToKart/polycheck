/** Rules for proof-of-class photos and the section president's permission, shared by server and web. */

/** How many photos one officer may add to one session. */
export const PROOF_PHOTOS_PER_SESSION = 4
/** Largest photo the server stores. Both apps compress well below this before uploading. */
export const PROOF_PHOTO_MAX_BYTES = 1_500_000
/** Photos are still accepted for this long after the scheduled end of class. */
export const PROOF_GRACE_AFTER_CLASS_MINUTES = 15

/** Preset lengths a professor can give a president's permission, in hours. */
export const SESSION_PERMISSION_PRESET_HOURS = [8, 24] as const
export const SESSION_PERMISSION_DEFAULT_HOURS = 24
export const SESSION_PERMISSION_MAX_HOURS = 168
export const SESSION_PERMISSION_MAX_SESSIONS = 20

const CAMPUS_OFFSET_MS = 8 * 60 * 60 * 1000

export interface ProofWindowSession {
  date: string
  startTime: string
  endTime: string
  isActive: boolean
}

const minutesOf = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/**
 * Whether a class counts as ongoing. The QR code closes a few minutes into a class, long before the class
 * ends, so the scheduled time counts too. Times are campus (Asia/Manila) times.
 */
export function isProofWindowOpen(session: ProofWindowSession, now: Date = new Date()): boolean {
  if (session.isActive) return true
  const campus = new Date(now.getTime() + CAMPUS_OFFSET_MS).toISOString()
  if (campus.slice(0, 10) !== session.date) return false
  const start = minutesOf(session.startTime)
  const end = minutesOf(session.endTime)
  const current = minutesOf(campus.slice(11, 16))
  if (start === null || end === null || current === null) return false
  return current >= start && current <= end + PROOF_GRACE_AFTER_CLASS_MINUTES
}
