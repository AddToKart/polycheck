/**
 * F7 "Drop-the-Mic" outage simulator — the demo killswitch flag store.
 *
 * Arming flips a process-wide flag that the API clients consult FIRST inside
 * their fetch wrappers: every request then rejects with a `TypeError` whose
 * message is identical to a real network failure, so all existing downstream
 * paths (offline queue enqueue, `isNetworkFailure`, sync classification,
 * offline banners) behave exactly as they would in a real campus outage.
 * Nothing in this module touches storage, RN, `window`, or timers at import
 * time — the store is plain module state so both the web client and the
 * Android services can import it from `@polycheck/shared` untouched.
 *
 * The engine itself (encrypted queues, batch sync, receipts) is untouched;
 * Resume simply disarms and lets the existing drain paths replay the queue.
 */

/** Exact message of the simulated failure thrown by the guarded fetchers. */
export const SIMULATED_NETWORK_OUTAGE_MESSAGE =
  'Simulated network outage (Polycheck simulator)' as const

type OutageListener = (armed: boolean) => void

let armed = false
const listeners = new Set<OutageListener>()

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(armed)
    } catch {
      // A broken listener must never wedge the flag store for other apps.
    }
  }
}

/** Starts simulating a network outage (idempotent). */
export function armOutage(): void {
  if (armed) return
  armed = true
  notify()
}

/** Stops the simulation and lets requests through again (idempotent). */
export function disarmOutage(): void {
  if (!armed) return
  armed = false
  notify()
}

/** Current simulator state. */
export function isOutageArmed(): boolean {
  return armed
}

/**
 * Subscribes to arm/disarm transitions. `subscribeToOutage` intentionally
 * does NOT fire on registration: callers seed their own initial state from
 * `isOutageArmed()` to keep first render render-time pure. Returns an
 * unsubscribe function; the returned cleanup is stable and safe to call
 * more than once.
 */
export function subscribeToOutage(listener: OutageListener): () => void {
  listeners.add(listener)
  let active = true
  return () => {
    if (!active) return
    active = false
    listeners.delete(listener)
  }
}

/** The simulated network failure the API-client guards throw while armed. */
export function createSimulatedNetworkOutage(): TypeError {
  return new TypeError(SIMULATED_NETWORK_OUTAGE_MESSAGE)
}

/**
 * Renders the local receipt chip for the demo surface:
 * `Receipt #104 · a1b2c3d4`. The sequence is the caller's queue position
 * (pending operations count) and the prefix is the first 8 characters of the
 * queued operation id. Missing/empty ids hide the prefix entirely.
 */
export function formatOutageReceipt(sequence: number, operationId?: string | null): string {
  const safeSequence = Number.isFinite(sequence) && sequence > 0 ? Math.floor(sequence) : 0
  const prefix = typeof operationId === 'string' ? operationId.slice(0, 8) : ''
  return prefix ? `Receipt #${safeSequence} · ${prefix}` : `Receipt #${safeSequence}`
}
