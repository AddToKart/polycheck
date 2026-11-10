import type { UserRole } from '../prisma/client'

/**
 * Device-integrity login policy. Students may hold one active login at a time,
 * but a successful login never replaces another device: the login gates reject
 * a second device instead (see DeviceBindingService.assertLoginAllowed), and a
 * re-login on the same device only purges that device's stale duplicates.
 * Teachers and super admins may hold concurrent sessions (e.g. the mobile app
 * beside the web dashboard). Security-relevant revocations for every role still
 * work because password resets, account status changes, and forced rotations
 * increment `authVersion`, and every session's `generation` must match it.
 */
export function enforceSingleSession(role: UserRole): boolean {
  return role === 'student'
}

/**
 * Decides the `before` outcome for a new session. Returns `false` when the
 * account may not sign in at all; otherwise the generation to stamp on the
 * session. Login never advances `authVersion` — only revocations do.
 */
export function resolveSessionGeneration(account: {
  isActive: boolean
  role: UserRole
  authVersion: number
}): { allowed: false } | { allowed: true; generation: number } {
  if (!account.isActive) return { allowed: false }
  return { allowed: true, generation: account.authVersion }
}

/** Outcome of the `after` hook for a freshly created session. */
export type SessionCreateAfterAction = 'delete-self' | 'purge-same-device' | 'keep'

export function resolveSessionCreateAfter(
  session: { id: string; generation: number },
  account: { authVersion: number; role: UserRole } | null,
): SessionCreateAfterAction {
  if (!account || account.authVersion !== session.generation) return 'delete-self'
  return enforceSingleSession(account.role) ? 'purge-same-device' : 'keep'
}
