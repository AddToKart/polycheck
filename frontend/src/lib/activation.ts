/**
 * Pure helpers for the public /activate page (kept out of the component so they
 * are unit-testable and the page stays light on weak mobile connections).
 */

export const STUDENT_NUMBER_PATTERN = /^\d{4}-\d{5}-[A-Za-z]{2}-\d$/

/** The token lives in the URL fragment (`#token=…`) so it never reaches a server log. */
export function readActivationToken(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const token = new URLSearchParams(raw).get('token')?.trim()
  return token && /^[A-Za-z0-9_-]{32,128}$/.test(token) ? token : null
}

export function normalizeStudentNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export interface PasswordCheck {
  id: 'length' | 'lower' | 'upper' | 'number' | 'special'
  label: string
  met: boolean
}

/** Mirrors the backend policy (12+ characters with lower, upper, number and symbol). */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: 'length', label: 'At least 12 characters', met: password.length >= 12 && password.length <= 128 },
    { id: 'lower', label: 'A lowercase letter', met: /[a-z]/.test(password) },
    { id: 'upper', label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'A number', met: /[0-9]/.test(password) },
    { id: 'special', label: 'A symbol (for example ! # @)', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function isPasswordAcceptable(password: string): boolean {
  return passwordChecks(password).every((check) => check.met)
}

export type ActivationFormProblem = 'student_number' | 'password' | 'mismatch' | null

/** First blocking problem with the activation form, or null when it can be submitted. */
export function activationFormProblem(input: {
  studentId: string
  password: string
  confirm: string
}): ActivationFormProblem {
  if (!STUDENT_NUMBER_PATTERN.test(normalizeStudentNumber(input.studentId))) return 'student_number'
  if (!isPasswordAcceptable(input.password)) return 'password'
  if (input.password !== input.confirm) return 'mismatch'
  return null
}

export const ACTIVATION_PROBLEM_COPY: Record<Exclude<ActivationFormProblem, null>, string> = {
  student_number: 'Enter your student number exactly as shown on your ID, for example 2024-00001-MN-0.',
  password: 'Your password needs every requirement in the list below.',
  mismatch: 'The two passwords do not match.',
}

export type ActivationFailure =
  | { kind: 'invalid_link' }
  | { kind: 'student_number'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'password'; message: string }
  | { kind: 'network'; message: string }

/** Map an API/transport error to what the student should see (and what the page should do). */
export function describeActivationFailure(error: unknown): ActivationFailure {
  const candidate = error as { status?: number; code?: string; message?: string } | null
  if (candidate && typeof candidate.status === 'number') {
    if (candidate.code === 'activation_link_invalid') return { kind: 'invalid_link' }
    if (candidate.code === 'activation_student_number_mismatch') {
      return { kind: 'student_number', message: 'That student number does not match this activation link.' }
    }
    if (candidate.code === 'activation_rate_limited' || candidate.status === 429) {
      return { kind: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' }
    }
    if (candidate.status === 400) {
      return { kind: 'password', message: candidate.message || 'Please check the details and try again.' }
    }
  }
  return {
    kind: 'network',
    message: 'We could not reach Polycheck. Check your connection and try again — it is safe to retry.',
  }
}
