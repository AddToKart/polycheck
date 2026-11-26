/**
 * Pure helpers for the public /forgot-password and /reset-password pages. The token and password rules are
 * shared with the activation page, so they are reused rather than duplicated.
 */
import { STUDENT_NUMBER_PATTERN, normalizeStudentNumber, readActivationToken } from './activation'

export { STUDENT_NUMBER_PATTERN, normalizeStudentNumber }
export { isPasswordAcceptable, passwordChecks } from './activation'

/** The reset token lives in the URL fragment (`#token=...`) so it never reaches a server log. */
export const readResetToken = readActivationToken

export type ResetFormProblem = 'password' | 'mismatch' | null

export const RESET_PROBLEM_COPY: Record<Exclude<ResetFormProblem, null>, string> = {
  password: 'Your password needs every requirement in the list below.',
  mismatch: 'The two passwords do not match.',
}

export type ResetFailure =
  | { kind: 'invalid_link' }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'password'; message: string }
  | { kind: 'network'; message: string }

/** Map an API/transport error to what the student should see (and what the page should do). */
export function describeResetFailure(error: unknown): ResetFailure {
  const candidate = error as { status?: number; code?: string; message?: string } | null
  if (candidate && typeof candidate.status === 'number') {
    if (candidate.code === 'password_reset_link_invalid') return { kind: 'invalid_link' }
    if (candidate.code === 'password_reset_rate_limited' || candidate.status === 429) {
      return { kind: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' }
    }
    if (candidate.status === 400) {
      return { kind: 'password', message: candidate.message || 'Please check the details and try again.' }
    }
  }
  return {
    kind: 'network',
    message: 'We could not reach Polycheck. Check your connection and try again. It is safe to retry.',
  }
}
