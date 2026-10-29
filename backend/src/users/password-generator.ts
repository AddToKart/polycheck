import { randomInt } from 'node:crypto'
import { isStrongPassword } from '../auth/password-policy'

const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const SYMBOLS = '!@#$%_-'

function take(length: number, alphabet: string): string {
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join('')
}

/**
 * Generates a human-readable temporary credential that always satisfies the
 * 12-character PUP password policy. The format is
 * `PUP-<6 upper/digit><2 digit>-<2 lower><1 symbol>` (16 chars): the fixed
 * segments guarantee upper, lower, digit, and symbol classes while remaining
 * easy to read aloud or write on a classroom slip. Ambiguous glyphs
 * (I, L, O, 0, 1) are excluded from the random alphabets.
 */
export function generateTemporaryPassword(): string {
  const candidate = `PUP-${take(6, UPPER + DIGITS)}${take(2, DIGITS)}-${take(2, LOWER)}${
    SYMBOLS[randomInt(0, SYMBOLS.length)]
  }`
  if (!isStrongPassword(candidate)) {
    // Structurally guaranteed by construction; failing closed is safer than
    // handing an out-of-policy credential to a student.
    throw new Error('Generated temporary password failed the password policy')
  }
  return candidate
}
