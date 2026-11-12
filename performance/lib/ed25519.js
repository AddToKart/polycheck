/**
 * Minimal Ed25519 signer for k6 (RFC 8032), compatible with the backend's
 * `verifyQRToken` (tweetnacl `nacl.sign.detached`).
 *
 * k6's WebCrypto implementation does not expose Ed25519, so the curve maths is
 * done with BigInt and SHA-512 comes from k6/crypto. This is used only by the
 * `session_lifecycle` flow to sign a throwaway session's activation token with
 * the professor's fixture key; nothing else needs signing.
 *
 * The secret key format matches tweetnacl: 64 bytes = seed(32) || publicKey(32),
 * base64url encoded exactly like `createSigningKeyPair()` in shared/src.
 */
import crypto from 'k6/crypto'
import encoding from 'k6/encoding'

const P = (1n << 255n) - 19n
const L = (1n << 252n) + 27742317777372353535851937790883648493n

// Base point (RFC 8032 §5.1).
const BX = 15112221349535400772501151409588531511454012693041857206046113283949847762202n
const BY = 46316835694926478169428394003475163141307993866256225615783033603165251855960n

function mod(a) {
  const r = a % P
  return r >= 0n ? r : r + P
}

function powMod(base, exponent, modulus) {
  let result = 1n
  let b = ((base % modulus) + modulus) % modulus
  let e = exponent
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus
    b = (b * b) % modulus
    e >>= 1n
  }
  return result
}

const D = mod(-121665n * powMod(121666n, P - 2n, P))
const D2 = mod(2n * D)
const BASE = { X: BX, Y: BY, Z: 1n, T: mod(BX * BY) }

const IDENTITY = { X: 0n, Y: 1n, Z: 1n, T: 0n }

function pointAdd(p, q) {
  const a = mod((p.Y - p.X) * (q.Y - q.X))
  const b = mod((p.Y + p.X) * (q.Y + q.X))
  const c = mod(p.T * D2 * q.T)
  const d = mod(p.Z * 2n * q.Z)
  const e = mod(b - a)
  const f = mod(d - c)
  const g = mod(d + c)
  const h = mod(b + a)
  return { X: mod(e * f), Y: mod(g * h), Z: mod(f * g), T: mod(e * h) }
}

function pointDouble(p) {
  const a = mod(p.X * p.X)
  const b = mod(p.Y * p.Y)
  const c = mod(2n * p.Z * p.Z)
  const h = mod(a + b)
  const e = mod(h - (p.X + p.Y) * (p.X + p.Y))
  const g = mod(a - b)
  const f = mod(c + g)
  return { X: mod(e * f), Y: mod(g * h), Z: mod(f * g), T: mod(e * h) }
}

function scalarMultiply(scalar, point) {
  let k = scalar
  let acc = IDENTITY
  let base = point
  while (k > 0n) {
    if (k & 1n) acc = pointAdd(acc, base)
    base = pointDouble(base)
    k >>= 1n
  }
  return acc
}

function encodePoint(point) {
  const zInverse = powMod(point.Z, P - 2n, P)
  const x = mod(point.X * zInverse)
  const y = mod(point.Y * zInverse)
  const out = new Array(32)
  let rest = y
  for (let index = 0; index < 32; index++) {
    out[index] = Number(rest & 0xffn)
    rest >>= 8n
  }
  out[31] = (out[31] & 0x7f) | (x & 1n ? 0x80 : 0)
  return out
}

function bytesToBigIntLittleEndian(bytes) {
  let value = 0n
  for (let index = bytes.length - 1; index >= 0; index--) value = (value << 8n) | BigInt(bytes[index])
  return value
}

function bigIntToBytesLittleEndian(value, length) {
  const out = new Array(length)
  let rest = value
  for (let index = 0; index < length; index++) {
    out[index] = Number(rest & 0xffn)
    rest >>= 8n
  }
  return out
}

function sha512Bytes(bytes) {
  const digest = crypto.sha512(new Uint8Array(bytes).buffer, 'binary')
  // k6 returns an ArrayBuffer for the 'binary' output encoding; older builds
  // return a latin1 string. Support both so the lib is version-tolerant.
  if (typeof digest === 'string') {
    const out = new Array(digest.length)
    for (let index = 0; index < digest.length; index++) out[index] = digest.charCodeAt(index) & 0xff
    return out
  }
  const view = new Uint8Array(digest)
  const out = new Array(view.length)
  for (let index = 0; index < view.length; index++) out[index] = view[index]
  return out
}

function utf8Bytes(text) {
  const out = []
  for (let index = 0; index < text.length; index++) {
    let code = text.charCodeAt(index)
    if (code < 0x80) {
      out.push(code)
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
      index += 1
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return out
}

function decodeSecretKey(secretKeyBase64Url) {
  const buffer = encoding.b64decode(secretKeyBase64Url, 'rawurl', 'b')
  const bytes = new Array(buffer.byteLength)
  const view = new Uint8Array(buffer)
  for (let index = 0; index < bytes.length; index++) bytes[index] = view[index]
  if (bytes.length !== 64) throw new Error(`Ed25519 secret key must be 64 bytes, got ${bytes.length}`)
  return bytes
}

/** Returns the base64url 32-byte public key for a base64url 64-byte secret key. */
export function publicKeyFromSecret(secretKeyBase64Url) {
  const key = decodeSecretKey(secretKeyBase64Url)
  return encoding.b64encode(new Uint8Array(key.slice(32)).buffer, 'rawurl')
}

/**
 * Signs a QR token payload (object) exactly like shared `signQRToken`:
 * the signed bytes are the ASCII base64url *encoding* of the JSON payload, not
 * the raw JSON. Returns `<base64url(payload json)>.<base64url(signature)>`.
 */
export function signQRTokenPayload(payload, secretKeyBase64Url) {
  const key = decodeSecretKey(secretKeyBase64Url)
  const seed = key.slice(0, 32)
  const publicKey = key.slice(32, 64)
  const encodedPayload = encoding.b64encode(
    new Uint8Array(utf8Bytes(JSON.stringify(payload))).buffer,
    'rawurl',
  )
  // The verifier signs/verifies the encoded payload string (ASCII), matching
  // shared/src/utils/token.ts `signQRToken`.
  const message = utf8Bytes(encodedPayload)

  const digest = sha512Bytes(seed)
  const scalarBytes = digest.slice(0, 32)
  scalarBytes[0] &= 248
  scalarBytes[31] &= 127
  scalarBytes[31] |= 64
  const scalar = bytesToBigIntLittleEndian(scalarBytes)
  const prefix = digest.slice(32, 64)

  const nonce = bytesToBigIntLittleEndian(sha512Bytes(prefix.concat(message))) % L
  const encodedR = encodePoint(scalarMultiply(nonce, BASE))
  const challenge =
    bytesToBigIntLittleEndian(sha512Bytes(encodedR.concat(publicKey).concat(message))) % L
  const s = (nonce + challenge * scalar) % L
  const signature = encodedR.concat(bigIntToBytesLittleEndian(s, 32))

  const encodedSignature = encoding.b64encode(new Uint8Array(signature).buffer, 'rawurl')
  return `${encodedPayload}.${encodedSignature}`
}
