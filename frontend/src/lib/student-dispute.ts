import { ApiHttpError } from '@/lib/api-client'

/** Matches the backend `@MinLength(10)` on `POST /disputes`. */
export const DISPUTE_DESCRIPTION_MIN_LENGTH = 10
/** Matches the backend `@MaxLength(1000)` on `POST /disputes`. */
export const DISPUTE_DESCRIPTION_MAX_LENGTH = 1000

export const DISPUTE_SUBMIT_FALLBACK_MESSAGE =
  'Unable to submit your dispute. Check your connection and try again.'

export const DISPUTE_DESCRIPTION_TOO_SHORT_MESSAGE = `Please describe the issue in at least ${DISPUTE_DESCRIPTION_MIN_LENGTH} characters.`

/** Trimmed description must be long enough for the server to accept it. */
export function isDisputeDescriptionValid(description: string): boolean {
  return description.trim().length >= DISPUTE_DESCRIPTION_MIN_LENGTH
}

/**
 * User-facing message for a failed dispute submission.
 *
 * Typed API failures carry the server's validation/business message; anything
 * else (offline, timeout, DNS) falls back to a neutral retry hint so the dialog
 * never surfaces a raw `Failed to fetch`.
 */
export function describeDisputeSubmitError(error: unknown): string {
  if (error instanceof ApiHttpError && error.message.trim()) return error.message
  return DISPUTE_SUBMIT_FALLBACK_MESSAGE
}
