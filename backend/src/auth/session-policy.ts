import type { UserRole } from '../prisma/client'

/**
 * Single-active-session policy. Students are the anti-cheat surface (proxy
 * attendance check-ins with a borrowed phone are only possible when one
 * account is signed in everywhere), so login-time replacement — the
 * `authVersion` bump, sibling-session revocation, and the `auth.session-replaced`
 * broadcast with `reason: new_login` — applies to students only. Teachers and
 * super admins may hold concurrent sessions (e.g. the mobile app beside the
 * web dashboard); security-relevant revocations for staff still work because
 * password resets, account status changes, and forced rotations increment
 * `authVersion`, and every session's `generation` must match it.
 */
export function enforceSingleSession(role: UserRole): boolean {
  return role === 'student'
}

/**
 * Decides the `before` outcome for a new session. Returns `false` when the
 * account may not sign in at all; otherwise the generation to stamp on the
 * session and whether `authVersion` advanced (which is what invalidates the
 * user's other sessions on their next request).
 */
export function resolveSessionGeneration(account: {
  isActive: boolean
  role: UserRole
  authVersion: number
}): { allowed: false } | { allowed: true; generation: number; bumpedAuthVersion: boolean } {
  if (!account.isActive) return { allowed: false }
  if (enforceSingleSession(account.role)) {
    return { allowed: true, generation: account.authVersion + 1, bumpedAuthVersion: true }
  }
  return { allowed: true, generation: account.authVersion, bumpedAuthVersion: false }
}

/** Outcome of the `after` hook for a freshly created session. */
export type SessionCreateAfterAction = 'delete-self' | 'delete-others' | 'keep'

export function resolveSessionCreateAfter(
  session: { id: string; generation: number },
  account: { authVersion: number; role: UserRole } | null,
): SessionCreateAfterAction {
  if (!account || account.authVersion !== session.generation) return 'delete-self'
  if (!enforceSingleSession(account.role)) return 'keep'
  return 'delete-others'
}

/**
 * Whether this login should broadcast `auth:session-replaced` to the user's
 * realtime room (kicking connected devices and showing the replaced notice).
 */
export function broadcastsLoginReplacement(role: UserRole): boolean {
  return enforceSingleSession(role)
}
