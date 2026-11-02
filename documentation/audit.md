# Polycheck System Audit

**Audit date:** 2026-11-02  
**Repository:** `fix/cross-browser-runtime-compat` at `2706005`  
**Scope:** Current backend, shared package, web and Android API contracts, with attention to the in-progress attendance forensics and hash-ledger changes. The working tree already contained uncommitted changes; those were inspected and left untouched.

## Summary

The audit found seven actionable issues. The most urgent is a working-tree regression: `AttendanceService` now requires `LedgerService`, but Nest does not provide that dependency, so backend startup will fail. The other findings cover incomplete forensics APIs, ledger coverage and validation gaps, dispute integrity, and scan validation.

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 4 |
| Medium | 2 |

## Findings

### C1. Nest cannot resolve the new `LedgerService` dependency

**Evidence:** The current working tree injects `LedgerService` into `AttendanceService` (`backend/src/attendance/attendance.service.ts:42, 122`). `AttendanceModule` does not import or list `LedgerService` in its providers (`backend/src/attendance/attendance.module.ts:1-25`), and no other module provides it.

**Impact:** Nest cannot construct `AttendanceService` while bootstrapping `AttendanceModule`; backend startup fails before requests can be served.

**Recommended fix:** Register `LedgerService` in `AttendanceModule.providers` (or export/import it through a dedicated module), then verify Nest application bootstrap.

### H1. Forensics API additions leave both client contracts incomplete

**Evidence:** `shared/src/types/api.ts:435-437` adds `getScanAttempts`, `getRecordTimeline`, and `verifyLedger` to `ApiClient`. The web and Android clients end with `api satisfies ApiClient` at `frontend/src/lib/api-client.ts:1444` and `android/services/api-client.ts:1475`, but neither defines those methods. The backend currently exposes only the existing `/attendance/attempts` endpoint (`backend/src/attendance/attendance.controller.ts:50-55`); there are no timeline or ledger-verification routes.

**Impact:** The `satisfies` checks are expected to fail TypeScript compilation because both client objects omit required interface members. Even after that is addressed, the timeline call has no backend implementation, and ledger verification has no controller route.

**Recommended fix:** Implement the three methods and matching backend routes/services in the same change, or defer adding them as required `ApiClient` methods until the feature is implemented. Run frontend, Android, shared, and backend typechecks after the contract is complete.

### H2. Ledger coverage is incomplete, and verification can succeed with unhashed rows

**Evidence:** `appendLedger` is called for accepted scans and manual attendance (`backend/src/attendance/attendance.service.ts:507-521, 598-622`), but the `AttendanceService` resolution/update paths and dispute resolution also change attendance records without appending a new ledger event. `verifyLedger` filters its read to rows where `recordHash` is non-null (`backend/src/attendance/ledger.service.ts:126-129`) and skips sessions with no hashed rows (`:130-132`), then can return `{ verified: true }` when there are no anchors (`:219`). The service only reads `ledger.anchored` audit rows; no writer for those anchors exists in backend source.

**Impact:** Records and later decisions can be absent from the ledger while verification still reports success. There is also no public backend route for a verifier to be called.

**Recommended fix:** Define which attendance states must be covered, append immutable events for every accepted decision and later override, and make verification fail or report incomplete coverage when expected rows are unhashed. Add an anchor writer and a route for authorized callers.

### H3. The ledger hash does not cover attendance outcome or evidence

**Evidence:** `shared/src/utils/ledger.ts:25-34` hashes only `prevHash`, `studentId`, `timestampIso`, `sessionId`, and `salt`. It does not include fields such as `status`, `latitude`, `longitude`, `manuallySet`, scan token/evidence, or dispute resolution state.

**Impact:** Once chain writing is added, changing an attendance result or its supporting evidence would not change the stored hash. A verifier could report a valid chain even though the consequential attendance fields had been altered.

**Recommended fix:** Hash a canonical representation of every security-relevant field, with explicit versioning and stable serialization. Make later decisions append immutable events or re-chain the record in a way that preserves an auditable history.

### H4. Offline scan arrival can create ledger forks that the verifier accepts

**Evidence:** When `appendLedger` is called without an explicit predecessor, it chooses the session head by greatest attendance `timestamp` (`backend/src/attendance/ledger.service.ts:71-76`). Offline submissions can arrive after newer scans while carrying an earlier scan timestamp. The verifier then only checks that `prevHash` matches any hash in the session (`:134-148`); it does not require a single predecessor chain in append order.

**Impact:** Delayed offline records can branch from an old head instead of extending the latest committed node. The verifier can accept multiple branches as a valid chain, so the ordering and completeness guarantee is weaker than the service comment claims.

**Recommended fix:** Persist or derive a monotonic per-session chain position/append sequence under the same lock, append from that exact head, and verify each row against the immediately preceding node (including a single genesis and one head).

### M1. Teachers can resolve attendance records that have no open dispute

**Evidence:** `backend/src/disputes/disputes.service.ts:95-123` checks that the caller is the session's teacher, then updates the record's status and sets `disputeResolved: true`. It does not require `status === 'disputed'` or `disputeResolved === false`, and the update is not conditional on the state read earlier.

**Impact:** A teacher can call the dispute-resolution endpoint for any record in their session and change its attendance status, while marking it as a resolved dispute. Concurrent resolution requests can also overwrite each other's decisions.

**Recommended fix:** Reject records without an unresolved dispute and perform a conditional update or transaction that only succeeds while the record remains disputed and unresolved.

### M2. Client-controlled scan fields select the relaxed GPS policy

**Evidence:** The scan DTO accepts `inputChannel` from the request (`backend/src/attendance/dto/attendance.dto.ts:30`). `ScanValidatorService` treats any `deviceId` starting with `web-` or any `inputChannel === 'image'` as web at `backend/src/attendance/scan-validator.service.ts:260-278`. That path allows accuracy up to 500 m rather than 50 m and skips the geofence-uncertainty check; the thresholds are in `backend/src/attendance/types.ts:7-8`.

**Impact:** A client can claim the image/web channel to receive the looser GPS policy. This weakens the server-side geofence check for mobile requests as well as legitimate web requests.

**Recommended fix:** Do not use request-controlled channel or device ID as authority for a more permissive policy. Apply the strict policy uniformly, or establish the policy from a server-controlled, authenticated client capability and retain the stricter geofence uncertainty check.

## Verification and limits

- Reviewed the current source, Prisma schema/migration, API contracts, and existing audit reports. `git diff --check` completed without errors.
- No application, database, or device was run; no runtime behavior was reproduced, and no tests were run.
- Frontend (`pnpm --dir frontend exec tsc --noEmit`) and Android (`pnpm --dir android typecheck`) could not reach TypeScript: both terminated in `pnpm` with `[ERROR] fetch failed`. The missing `ApiClient` methods and Nest provider gap are confirmed by source inspection; compiler/bootstrap results were not run.
- This report records issues verified in the current source and is not a status update for every historical item in `documentation/bug-audit-2026-10-08.md`.
