/**
 * Browser fetch implementations report both aborted requests and genuine
 * network/CORS failures with the same engine-specific messages:
 * - Firefox: "NetworkError when attempting to fetch resource."
 * - WebKit: "TypeError: Load failed" / "... due to access control checks."
 * - Chromium: "Failed to fetch" / "The user aborted a request."
 * - Explicit AbortController aborts: "AbortError".
 *
 * This classifier is therefore only a shape check. Callers must gate it on
 * evidence that a cancellation was expected (for example, a navigation or page
 * teardown was in progress); it must never be used to suppress every matching
 * rejection, because that would also hide real outages and CORS failures.
 */
const CANCELLATION_SHAPED_PATTERNS = [
  /NetworkError when attempting to fetch resource/i,
  /Load failed/i,
  /Failed to fetch/i,
  /AbortError/i,
  /The user aborted a request/i,
  /due to access control checks/i,
]

export function isCancellationShapedError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')
  return CANCELLATION_SHAPED_PATTERNS.some((pattern) => pattern.test(message))
}
