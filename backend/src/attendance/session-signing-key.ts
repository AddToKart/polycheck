/**
 * Which key a session's QR codes are signed with.
 *
 * Returns the session's own key only when a section president started it.
 * Otherwise returns undefined and the caller uses the professor's key, exactly
 * as before. Mirrored by the ingestion gateway's commit-time check.
 */
export function presidentSigningKey(session: {
  hostStartedAt?: Date | string | null
  hostPublicKey?: string | null
}): string | undefined {
  return session.hostStartedAt && session.hostPublicKey ? session.hostPublicKey : undefined
}
