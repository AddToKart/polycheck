/**
 * F7 (WF-LD9) — pure UI logic for the Android outage simulator surface.
 *
 * The restore flow computes the reconciled count from pending queue counts
 * before/after the drain — never faked — and picks an honest toast outcome:
 * a queue that did not drain reports "still pending", not success.
 */

export type OutageRestoreOutcome =
  | { kind: 'reconciled'; count: number; message: string }
  | { kind: 'still-pending'; count: number; message: string }
  | { kind: 'empty'; count: 0; message: string }

export function outageRestoreOutcome(before: number, after: number): OutageRestoreOutcome {
  const safeBefore = Number.isFinite(before) && before > 0 ? Math.floor(before) : 0
  const safeAfter = Number.isFinite(after) && after > 0 ? Math.floor(after) : 0
  const reconciled = Math.max(0, safeBefore - safeAfter)
  if (reconciled > 0) {
    return {
      kind: 'reconciled',
      count: reconciled,
      message: `${reconciled} offline check-ins reconciled.`,
    }
  }
  if (safeAfter > 0) {
    return {
      kind: 'still-pending',
      count: safeAfter,
      message: `${safeAfter} saved records are still queued — check the connection and replay again.`,
    }
  }
  return {
    kind: 'empty',
    count: 0,
    message: 'The encrypted queue is empty — nothing to replay.',
  }
}
