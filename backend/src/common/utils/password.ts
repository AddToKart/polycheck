import { hash } from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { PASSWORD_HASH_COST } from '../../auth/password-policy'

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*'
const ALL = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`

/**
 * Generates a server-side temporary password that satisfies the account
 * creation policy (>= 12 chars, upper/lower/digit/symbol). Ambiguous glyphs
 * are avoided because these passwords are printed and handed out.
 */
export function generateTemporaryPassword(length = 16): string {
  const targetLength = Math.max(12, length)
  const characters = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (characters.length < targetLength) characters.push(pick(ALL))

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]]
  }
  return characters.join('')
}

/**
 * Hashes generated passwords with bounded concurrency so a 250-row chunk does
 * not schedule 250 bcrypt operations at once.
 */
export async function hashPasswords(passwords: string[], concurrency = 4): Promise<string[]> {
  const hashes: string[] = []
  for (let index = 0; index < passwords.length; index += concurrency) {
    const batch = passwords.slice(index, index + concurrency)
    hashes.push(...(await Promise.all(batch.map((password) => hash(password, PASSWORD_HASH_COST)))))
  }
  return hashes
}

function pick(source: string): string {
  return source[randomInt(source.length)]
}
