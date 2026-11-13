/**
 * Native Ed25519 verification for Node processes.
 *
 * The token format is tweetnacl's detached Ed25519 signature. tweetnacl is
 * pure JavaScript: verifying one token costs ~16 ms of CPU, which caps the
 * ingestion gateway at ~60 verifies/s per core (measured from a V8 profile of
 * the gateway under load). Node's `crypto.verify` with an Ed25519 key performs
 * the same check in native code in well under a millisecond.
 *
 * This module is Node-only and must never be imported by the web or Android
 * clients (no `node:crypto` there); they keep using the tweetnacl
 * implementation in `./token`. The signatures are interchangeable — a token
 * signed by `signQRToken` (tweetnacl) verifies here.
 */
import { createPublicKey, verify, type KeyObject } from 'node:crypto'
import type { QRTokenPayload } from '../types'
import { decodeBase64Url, normalizeQRTokenPayload } from './token'

/** DER prefix that wraps a raw 32-byte Ed25519 public key as an SPKI key. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/**
 * Teacher keys rotate rarely, so each process only ever needs to build a
 * handful of KeyObjects. The cap keeps hostile input from growing the map.
 */
const KEY_CACHE_LIMIT = 256
const keyCache = new Map<string, KeyObject>()

function publicKeyObject(publicKey: string): KeyObject | null {
  const cached = keyCache.get(publicKey)
  if (cached) return cached
  try {
    const raw = decodeBase64Url(publicKey)
    if (raw.length !== 32) return null
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(raw)]),
      format: 'der',
      type: 'spki',
    })
    if (keyCache.size >= KEY_CACHE_LIMIT) {
      const oldest = keyCache.keys().next().value
      if (oldest !== undefined) keyCache.delete(oldest)
    }
    keyCache.set(publicKey, key)
    return key
  } catch {
    // An unparsable key is attacker-supplied input, not a bug: the caller
    // treats a null result exactly like an invalid signature.
    return null
  }
}

/** Same contract as `verifyQRToken` in `./token`, backed by native crypto. */
export function verifyQRTokenNative(token: string, publicKey: string): QRTokenPayload | null {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split('.')
    if (!encodedPayload || !encodedSignature || extra) return null
    const key = publicKeyObject(publicKey)
    if (!key) return null
    const valid = verify(
      null,
      Buffer.from(encodedPayload, 'utf8'),
      key,
      Buffer.from(decodeBase64Url(encodedSignature)),
    )
    if (!valid) return null
    const payload = JSON.parse(Buffer.from(decodeBase64Url(encodedPayload)).toString('utf8')) as unknown
    return normalizeQRTokenPayload(payload)
  } catch {
    return null
  }
}
