/** Pure countdown formatting for the maintenance surfaces (unit-testable). */

export interface MaintenanceCountdown {
  tone: 'none' | 'pending' | 'overdue'
  label: string
}

/**
 * Formats the announced resumption estimate. The timestamp is an estimate, not
 * a scheduler: past the deadline the mode stays on and the UI asks the user to
 * retry later / contact IT.
 */
export function formatMaintenanceRemaining(
  estimatedEnd: string | undefined,
  nowMs: number,
): MaintenanceCountdown {
  if (!estimatedEnd) return { tone: 'none', label: '' }
  const targetMs = Date.parse(estimatedEnd)
  if (!Number.isFinite(targetMs)) return { tone: 'none', label: '' }

  const remainingMs = targetMs - nowMs
  if (remainingMs <= 0) {
    return { tone: 'overdue', label: 'Resumption is overdue — contact the IT desk' }
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  if (totalMinutes < 60) {
    return { tone: 'pending', label: `Estimated resumption in ${totalMinutes} min` }
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return {
    tone: 'pending',
    label: `Estimated resumption in ${hours} h${minutes > 0 ? ` ${minutes} min` : ''}`,
  }
}
