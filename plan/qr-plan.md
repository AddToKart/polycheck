# Polycheck — QR Token Plan

## Responsibility

This document covers the full QR code lifecycle: token generation and signing (on teacher's device), token structure, server-side signature verification on sync, expiry logic, and the clock-drift-resistant validation approach.

The QR system is the core anti-cheat mechanism. Every decision here directly affects attendance integrity.

---

## Architecture Overview

QR tokens are not static images. They are **cryptographically signed payloads** containing the session ID, issuance timestamp, validity window, and teacher identity. The QR code is a visual encoding of this signed string.

```
Teacher device (offline)
  ├── Holds private key (in secure enclave, never leaves device)
  ├── Generates QRTokenPayload on session activation
  ├── Signs payload with private key → signed token string
  └── Encodes signed token as QR image for students to scan

Student device (offline)
  ├── Scans QR → decodes signed token string
  ├── Validates locally (expiry + geofence)
  └── Stores attendance record in local SQLite (isSynced = false)

Server (on sync)
  ├── Receives attendance record with tokenSnapshot
  ├── Decodes token payload
  ├── Verifies ECDSA signature against teacher's stored public key
  ├── Re-validates timestamp against server clock
  ├── Re-validates coordinates against stored geofence
  ├── Checks for duplicates (sessionId + studentId)
  └── Accepts or marks as disputed
```

---

## Token Payload Structure

Defined in `@polycheck/shared/types/session.ts`:

```ts
interface QRTokenPayload {
  sessionId: string
  sectionId: string
  issuedAt: number         // Unix timestamp in milliseconds
  validityMinutes: number
  gracePeriodMinutes: number
  teacherId: string
  teacherName: string
}
```

The `issuedAt` value is baked into the signed payload at generation time. It cannot be altered without invalidating the signature — this is what makes the device clock irrelevant to expiry.

---

## Signing Algorithm

**Algorithm: ECDSA with P-256 curve and SHA-256 hash (ES256)**

P-256 (secp256r1) is chosen because:
- Available in iOS Secure Enclave natively
- Available in Android Keystore natively
- Produces compact signatures (64 bytes, ~88 chars base64) — small enough for a QR code
- Widely supported in Node.js via the built-in `crypto` module

### Token Format

The signed token is a compact string format:

```
base64url(payload_json) + "." + base64url(ecdsa_signature)
```

This is intentionally **not JWT** — JWTs have a header segment that wastes QR code capacity and adds no value here since the algorithm is fixed.

The server splits on `.`, decodes both parts, verifies the signature, then decodes the payload.

### Current Mock Implementation

The current mock (`@polycheck/shared/utils/token.ts`) uses plain `btoa()` with no signature:
```ts
export function createQRTokenData(...): string {
  return btoa(JSON.stringify(payload))  // NO SIGNATURE — mock only
}
```

The production implementation must replace this with real ECDSA signing on the mobile app side. The server-side verifier must be implemented in NestJS.

---

## Server-Side Token Verification (on sync)

This is the authoritative validation pass. It runs inside the attendance sync endpoint.

### Steps

1. **Split the token**: `const [payloadB64, signatureB64] = tokenSnapshot.split('.')`
2. **Decode payload**: `JSON.parse(base64url.decode(payloadB64))`
3. **Fetch teacher's public key**: Look up `User.teacherPublicKey` by `payload.teacherId`
4. **Verify signature**:
   ```ts
   const isValid = crypto.verify(
     'SHA256',
     Buffer.from(payloadB64),  // what was signed
     { key: teacherPublicKey, dsaEncoding: 'ieee-p1363' },
     Buffer.from(signatureB64, 'base64url')
   )
   ```
5. **Validate timestamp**: Using `isTokenInValidityWindow(payload, serverNow)` from `@polycheck/shared/utils/token.ts`
6. **Validate coordinates**: Using `isWithinGeofence(...)` from `@polycheck/shared/utils/haversine.ts`
7. **Check duplicate**: Attempt `INSERT` — a unique constraint violation means a duplicate submission

### Failure Modes

| Failure | Record Outcome |
|---|---|
| Invalid signature | Mark `status = 'disputed'`, `disputeReason = 'invalid_signature'` |
| Token expired (outside grace) | Mark `status = 'disputed'`, `disputeReason = 'expired_token'` |
| Outside geofence | Mark `status = 'disputed'`, `disputeReason = 'outside_geofence'` |
| Duplicate submission | Reject entirely — log as duplicate, return error to caller |
| Teacher public key not found | Mark `status = 'disputed'`, `disputeReason = 'invalid_signature'` |

All failures except duplicate submission result in a `disputed` status record, not a server error. This preserves the audit trail.

---

## Expiry Logic

Defined in `@polycheck/shared/utils/token.ts`:

```ts
function isTokenInValidityWindow(payload, serverTimeMs?) {
  const validityEnd = payload.issuedAt + payload.validityMinutes * 60_000
  const graceEnd = validityEnd + payload.gracePeriodMinutes * 60_000
  const now = serverTimeMs ?? Date.now()

  if (now <= validityEnd) return { valid: true, inGrace: false }   // → Present
  if (now <= graceEnd)   return { valid: true, inGrace: true }    // → Late
  return { valid: false, inGrace: false }                          // → Absent (disputed)
}
```

**Server-side**: The server uses its own clock as `serverTimeMs`. The device clock is irrelevant.

**Grace period end**: The grace period ends when the teacher presses "End Session" — not on a timer. The `gracePeriodMinutes` field is metadata used to calculate the `Late` cutoff. After the QR validity window ends and before End Session, scans are `Late`. After End Session, remaining `pending` records become `Absent`.

---

## QR Code on the Teacher's Screen

The teacher's app displays the signed token as a QR image. The student's app camera reads it back.

### QR Content

The raw QR content is the signed token string:
```
<base64url_payload>.<base64url_signature>
```

QR version and error correction level should be calculated based on token string length. P-256 signatures produce roughly 220–260 char total strings — this fits comfortably in QR version 10–12 with medium error correction.

### QR Validity Display

The teacher's UI shows a countdown timer from `qrGeneratedAt` to `qrTokenExpiresAt`. This is a display-only UX element. The actual expiry enforcement happens on the server at sync time using the signed `issuedAt` field.

### QR Refresh

The teacher can generate a new QR at any time during an active session. Each generation overwrites `qrToken`, `qrGeneratedAt`, and `qrTokenExpiresAt` on the session. Students who already scanned the previous QR are not affected — their records are already stored locally.

---

## Key Provisioning (Mobile Side)

This is out of scope for the backend plan but affects the QR plan:

- The mobile app must generate an ECDSA P-256 key pair on first use.
- The private key is stored in the Secure Enclave (iOS) or Android Keystore.
- The public key is sent to the backend during teacher onboarding (`POST /auth/provision-key`).
- Signing is done inside a native module — the private key never passes through JavaScript.

Until the native signing module is built, the app can use a software fallback (e.g., `expo-crypto` or `@noble/curves`) for development builds only. Production builds must use hardware-backed storage.

---

## Token Security Properties

| Property | How It's Achieved |
|---|---|
| Unique per session | `sessionId` in payload |
| Cannot be reused across students | `@@unique([sessionId, studentId])` on `AttendanceRecord` |
| Cannot be backdated | `issuedAt` is inside the signed payload; changing it invalidates signature |
| Device clock manipulation is ineffective | Server validates against its own clock |
| Forwarding to absent friend is mitigated | Short expiry (2–5 min) + geofence re-validation on sync |
| Screenshot/replay attack is prevented | Single-use per student pair enforced at DB level |

---

## Open Questions

- **Mobile signing library**: For development, a pure-JS ECDSA library (`@noble/curves`) is acceptable. For production, a React Native native module wrapping Secure Enclave / Android Keystore must be implemented. This is a v2 concern unless security is a launch requirement.
- **Signature encoding**: The plan uses `base64url` for both payload and signature. Confirm the mobile library uses the same encoding to avoid mismatch on the server.
- **Token length vs. QR capacity**: Measure actual token string length once real signing is implemented. If it exceeds ~400 chars, QR version increases and scan reliability decreases on low-resolution cameras.
- **Multi-QR sessions**: No multi-QR session support in v1 (one QR at a time per session). If a teacher wants to re-display a QR, they generate a new one.
