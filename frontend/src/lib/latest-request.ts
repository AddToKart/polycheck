/**
 * Monotonic request guard for handlers that can overlap: global search and
 * the session-create duplicate check both issue a request per input change.
 * Only the newest request may commit its result; an older response (or an
 * error) is discarded as stale so the UI always describes the current inputs.
 */
export interface LatestRequestGuard {
  /** Starts a request and returns a predicate that is true while it is newest. */
  begin: () => () => boolean
  /** Invalidates every in-flight request (input cleared / check disabled). */
  invalidate: () => void
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let sequence = 0
  return {
    begin() {
      const requestId = ++sequence
      return () => requestId === sequence
    },
    invalidate() {
      sequence += 1
    },
  }
}

export interface LatestResult<T> {
  stale: boolean
  result: T | null
  error: unknown
}

/** Runs `task` and reports whether the result is still the newest request. */
export async function runLatest<T>(
  guard: LatestRequestGuard,
  task: () => Promise<T>,
): Promise<LatestResult<T>> {
  const isCurrent = guard.begin()
  try {
    const result = await task()
    return { stale: !isCurrent(), result, error: null }
  } catch (error) {
    return { stale: !isCurrent(), result: null, error }
  }
}
