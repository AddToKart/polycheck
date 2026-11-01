import type { User } from '@polycheck/shared'

/** Epoch-ish cutoff beyond which a stuck in-flight stamp no longer mutes the monitor. */
export const OWN_LOGIN_IN_FLIGHT_WINDOW_MS = 30_000

export interface SessionReplacementProbe {
  restoreSession(): Promise<User | null>
  isOwnLoginInFlight?: (now?: number) => boolean
}

/**
 * The backend broadcasts `auth:session-replaced` to the whole user room —
 * including the device that just performed the replacement login, and that
 * socket event can beat the login's HTTP response (a probe may still carry
 * the pre-login token). The guard therefore mutes termination only while this
 * device has a login IN FLIGHT; once the login response completed the fresh
 * token is applied and a probe is authoritative — so a cross-device
 * replacement right after this device's own login resolves through the probe.
 * A genuinely replaced device fails it (null) and the caller signs out
 * exactly as before. Network failures are never proof of revocation either
 * way.
 */
export async function shouldTerminateForReplacedSession(
  probe: SessionReplacementProbe,
  now = Date.now(),
): Promise<boolean> {
  if (probe.isOwnLoginInFlight?.(now)) return false
  try {
    const user = await probe.restoreSession()
    return !user
  } catch {
    return false
  }
}
