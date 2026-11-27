import { createHmac } from 'node:crypto'
import { createSigningKeyPair } from '@polycheck/shared'

/**
 * The signing key of one president-run session.
 *
 * It is derived from the server secret and the session id, so no private key is
 * ever stored, sent to a phone, or shared between sessions. Professors are not
 * involved: their QR codes are still signed on their own device with their own
 * key. Only `PresidentHostService` signs with this, after checking permission.
 */
export function presidentSessionKeyPair(sessionId: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set to sign president-run sessions')
  }
  const seed = createHmac('sha256', secret).update(`polycheck.president-session.v1:${sessionId}`).digest()
  return createSigningKeyPair(Uint8Array.from(seed))
}
