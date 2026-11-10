# Polycheck System Audit

**Audit date:** 2026-11-04

**Snapshot:** `ddeda57177b9d6a877057bf6aa379282611ba462`
**Scope:** Current backend, shared package, web and Android clients, with focus on the completed wow-factor suite, attendance evidence integrity, privacy claims, and deployment configuration. Source files were inspected without modification.

## Summary

The finished system has a coherent architecture and a broad, presentation-ready feature set. The previous audit's Nest provider and missing client/API contract blockers are resolved. Several remaining issues affect the trustworthiness of attendance decisions and the evidence presented to administrators, so the system still needs a focused hardening pass before it can be rated deployment-ready without qualification.

| Category | Rating | Assessment |
|---|---:|---|
| Architecture | 8/10 | Strong shared contracts, clear service boundaries, and a substantial offline-first design. |
| Feature completeness and capstone impact | 8/10 | Distinctive governance, privacy, forensics, and outage-demo features; some evidence claims need correction. |
| Code quality | 7/10 | Generally organized, with remaining authorization/integrity edge cases and one shared TypeScript error. |
| Security and privacy | 6/10 | Client-selected GPS policy and incomplete ledger coverage weaken key trust claims. |
| Test confidence | 6.5/10 | Project documentation reports broad green suites; this audit did not rerun them, and the shared TypeScript check fails. |
| Deployment readiness | 7.5/10 | Production Compose, validation, backup, and recovery tooling are present; live deployment and recovery were not exercised in this audit. |
| **Overall current state** | **7/10** | Promising and close to capstone-ready, with material integrity and security fixes still outstanding. |

Ratings are an engineering judgment from this source snapshot, not a measured benchmark. They rate the current implementation and evidence available in the repository.

## Findings

### H1. Client-controlled scan fields select a relaxed geofence policy

**Evidence:** `backend/src/attendance/scan-validator.service.ts:260-278` selects the web policy when the request's `deviceId` starts with `web-` or `inputChannel` equals `image`. That policy permits location accuracy up to 500 m and skips the geofence uncertainty check; the DTO accepts `inputChannel` from the client.

**Impact:** A client can request weaker location validation by changing scan fields. This weakens server-side geofence evidence for any caller able to submit a scan.

**Recommended fix:** Do not choose validation strength from request-controlled fields. Apply one policy to all scans or derive any exception from a server-verified client capability, while retaining boundary uncertainty checks.

### H2. Ledger verification does not detect changes to attendance outcomes

**Evidence:** `shared/src/utils/ledger.ts:33-35` hashes only the predecessor, student ID, timestamp, session ID, and salt. Attendance status and evidence fields are not included. Status can change through manual updates (`backend/src/attendance/attendance.service.ts:611`) and dispute resolution (`backend/src/disputes/disputes.service.ts:119-121`) without creating a new ledger event.

**Impact:** An attendance result can change while its stored hash still recomputes successfully. A green verification result therefore does not establish that the current attendance outcome matches the outcome that was originally recorded.

**Recommended fix:** Record immutable decision events that include the outcome and relevant evidence, and have verification cover those events. Define explicitly which fields and transitions the ledger attests to.

### H3. Ledger appends can branch, and verification accepts branches

**Evidence:** `backend/src/attendance/attendance.service.ts:539-542` documents server arrival order as linkage order, but `backend/src/attendance/ledger.service.ts:71-74` chooses the predecessor by greatest scan timestamp. Delayed offline records can therefore make multiple nodes point to the same predecessor. Verification at `ledger.service.ts:134-148` checks only that a predecessor hash exists somewhere in the session; it does not enforce a single genesis, linear order, or one head.

**Impact:** The ledger can represent a fork while returning `verified: true`, weakening the ordering guarantee used to explain offline attendance evidence.

**Recommended fix:** Persist a monotonic append sequence or session head under the existing lock, link from that exact head, and verify the unique linear chain in append order.

### H4. Dispute resolution can change a record with no open dispute

**Evidence:** `backend/src/disputes/disputes.service.ts:104-121` checks session ownership but does not require `status === 'disputed'` and `disputeResolved === false` before updating the record. The update is not conditional on the state checked earlier.

**Impact:** A teacher can call the dispute-resolution endpoint on an ordinary attendance record in their session and change its status while marking it as a resolved dispute. Concurrent resolutions can overwrite one another.

**Recommended fix:** Require an unresolved dispute and use a conditional update or transaction so only one resolution can succeed.

### H5. Daily ledger anchors target the wrong UTC date

**Evidence:** `backend/src/common/services/maintenance.service.ts:128-142` runs at 2 AM and computes the anchor date by subtracting two hours. On the UTC schedule described by the code comment, this selects the current UTC date at 00:00 rather than the completed previous day.

**Impact:** The anchor can cover only the first hours of the current day, leaving the prior day's completed records without the intended daily anchor.

**Recommended fix:** Select the previous UTC calendar day explicitly and configure the cron timezone to UTC.

### M1. Privacy Center displays a hard-coded zero as a live attestation

**Evidence:** `frontend/src/app/faculty/settings/page.tsx:290-295` renders the literal `0` for “rows live beyond retention.” The response built by `backend/src/settings/settings.service.ts:194-215` includes the retention window and last shred summary, but does not calculate the current count of stale coordinates.

**Impact:** The page can claim zero rows beyond retention even when stale coordinates exist or shredding has not run. The DPO PDF's live query does not make the on-screen claim accurate.

**Recommended fix:** Compute the count from stored coordinates and the configured retention cutoff; show unknown or unavailable when that query fails.

### M2. Forensics recommendation ignores check-out evidence

**Evidence:** `backend/src/attendance/attendance-forensics.service.ts:214-239` returns the first available token candidate, while `:295-365` evaluates only `primaryAttempt` (the online check-in attempt). The check-out attempt/token is not included in recommendation evaluation.

**Impact:** For online sessions with start and end checkpoints, the recommendation can report acceptance without accounting for contradictory or missing check-out evidence.

**Recommended fix:** Evaluate both checkpoint attempts and their matching tokens, and make the recommendation rationale state which checkpoint evidence was considered.

### M3. Shared TypeScript check fails on a test fixture

**Evidence:** `shared/src/types/session.ts:19` requires `Session.mode`, but `shared/src/utils/calendar.test.ts:45-63` creates a `Session` without it. The direct `tsc --noEmit -p shared/tsconfig.json` check fails with TS2322 at that fixture.

**Impact:** The shared package's TypeScript check is not clean, and this fixture can hide future contract drift if test files are expected to typecheck with source.

**Recommended fix:** Add a valid `mode` to the fixture or separate test compilation from the production typecheck with its own explicit test configuration.

### M4. Automatic signing-key recovery can invalidate queued offline scans

**Evidence:** `frontend/src/lib/api-client.ts:844-861` retries activation after an error message mentions an invalid signature or signing key by force-provisioning the browser's public key. `backend/src/auth/auth.service.ts:230-263` replaces the account's single stored public key; no key history or verification grace period is kept.

**Impact:** If this browser has a different key from another teacher device, the retry can silently rotate the server key. QR tokens already issued by the prior key may then fail when students sync queued attendance, and there is no old key available to verify them.

**Recommended fix:** Make key rotation an explicit, audited operation with a transition period that accepts already-issued tokens under the prior public key, or retain key versions and bind each token/session to its signing-key version. Do not rotate solely because an activation error string contains a match.

## Standards and specification review

### Standards

- `AGENTS.md` says not to put `className` and `style` on the same React Native element. New code does so at `android/app/(faculty)/settings.tsx:643` and `android/app/(faculty)/sessions/[id].tsx:130`.
- The feature-parity gate requires paired Playwright and Maestro coverage for shared role journeys. The new wow-factor coverage adds Playwright journeys, but no corresponding new Maestro flow was found for those journeys. This is a validation gap, not proof that the mobile features are absent.

### Specification

- The previous audit's critical Nest provider blocker and missing forensics client/API methods are resolved in this snapshot.
- WF-LD11 describes server-arrival linkage and a completed-day daily anchor. The current append order and anchor date do not match those requirements (findings H3 and H5).
- WF-LD8 calls for a live count of coordinates beyond retention. The privacy screen currently substitutes a literal zero (finding M1).
- WF-LD10's recommendation does not evaluate both online checkpoints (finding M2).

## Verification and limits

- Backend, frontend, and Android `tsc --noEmit` checks passed.
- Shared `tsc --noEmit -p shared/tsconfig.json` failed on the missing `Session.mode` test fixture (M3).
- No test suites, application builds, Docker stack, database, or Android device were run for this audit. The repository's progress notes report green automated suites and a rebuilt Docker stack, but those results were not independently reproduced here.
- The working tree was clean at the audited snapshot. No source changes were made during this audit.
