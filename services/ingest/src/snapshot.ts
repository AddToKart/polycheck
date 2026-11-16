/**
 * Session-snapshot reader.
 *
 * This module exists because the key contract is the easiest thing to get wrong
 * across two processes: `RedisService` prefixes every key with `polycheck:`, and
 * the control plane publishes the teacher public key **inside** the same blob as
 * the session. Getting either half wrong means every scan is rejected with a
 * retryable 503, so the contract is asserted in `test/snapshot.test.ts`.
 */
import type Redis from 'ioredis'
import type { SessionSnapshot } from './core/scan'

/** Must match `RedisService.key('active-session:<id>')` in the control plane. */
export const ACTIVE_SESSION_KEY_PREFIX = 'polycheck:active-session:'

export interface ResolvedSnapshot {
  snapshot: SessionSnapshot
  teacherPublicKey: string
}

/**
 * Parses a raw `active-session:<id>` value. Exported separately so the hot-path
 * probe can read the blob inside a Redis pipeline (one round-trip with the
 * pending summary) and still share this one validation path.
 */
export function parseSessionSnapshot(raw: string | null | undefined): ResolvedSnapshot | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined

  let snapshot: SessionSnapshot
  try {
    snapshot = JSON.parse(raw) as SessionSnapshot
  } catch {
    return undefined
  }

  // The public key ships in the snapshot (activation path publishes
  // `{ ...session, teacherPublicKey }`). Without it the gateway cannot verify a
  // token, so a snapshot that lacks it is unusable rather than "trusted blindly".
  const teacherPublicKey = snapshot.teacherPublicKey
  if (typeof teacherPublicKey !== 'string' || teacherPublicKey.length === 0) return undefined

  return { snapshot, teacherPublicKey }
}

export async function readSessionSnapshot(
  redis: Pick<Redis, 'get'>,
  sessionId: string,
): Promise<ResolvedSnapshot | undefined> {
  return parseSessionSnapshot(await redis.get(`${ACTIVE_SESSION_KEY_PREFIX}${sessionId}`))
}
