import { createHash, randomBytes } from 'node:crypto'

/** 32 random bytes → 43 base64url characters. */
const TOKEN_BYTES = 32

export interface GeneratedActivationToken {
  /** Goes into the email link fragment only; never persisted or logged. */
  raw: string
  /** `sha256(raw)` hex — the only thing stored. */
  hash: string
}

export function hashActivationToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export function generateActivationToken(): GeneratedActivationToken {
  const raw = randomBytes(TOKEN_BYTES).toString('base64url')
  return { raw, hash: hashActivationToken(raw) }
}

/** Student numbers are compared after the same normalization the import applies. */
export function normalizeStudentNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** Minimal, deliberately strict shape check so junk never reaches the database. */
export function looksLikeActivationToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value)
}

export const ACTIVATION_MAX_FAILED_ATTEMPTS = 5
export const DEFAULT_ACTIVATION_TTL_HOURS = 168
