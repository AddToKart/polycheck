/**
 * WEB-10: classifies a failed scan message as "the meeting PIN may be the
 * problem", so the modal only returns to the PIN form for those failures.
 *
 * A PIN-protected token can still fail for reasons a PIN cannot fix (expired
 * window, duplicate, geofence, stale location, network). Sending those back to
 * the PIN form hid the real reason and invited pointless retries.
 *
 * Deliberately excluded: `pin_mismatch`-style configuration errors
 * ("PIN state does not match the session" / "PIN state is unavailable"). The
 * student's PIN cannot resolve those, so they surface as errors instead.
 */
export function isMeetingPinError(message: string | null | undefined): boolean {
  if (!message) return false
  const text = message.trim().toLowerCase()
  if (!text) return false
  // Server-side PIN configuration faults talk about "PIN state"; no PIN the
  // student types can fix those.
  if (text.includes('pin state')) return false
  return (
    text.includes('meeting pin') ||
    text.includes('pin is incorrect') ||
    text.includes('incorrect pin') ||
    text.includes('pin_incorrect') ||
    text.includes('pin_locked') ||
    text.includes('pin_required')
  )
}
