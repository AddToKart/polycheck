# Polycheck System Audit

**Audit date:** 2026-11-04

**Branch under review:** `test/audit-hardening-9of10`

**Base snapshot:** `ddeda57`
**Scope:** NestJS backend, shared package, web and Android clients; attendance validation, disputes, signing keys, forensics, ledger, privacy telemetry, and maintenance.

## Overall assessment

**Revised engineering confidence: 8.6/10.** The hardening fixes address several exploitable validation, concurrency, evidence, and reporting defects. The branch typechecks across all three apps, and the focused suites pass. I cannot substantiate a 9/10 rating yet because the attendance ledger does not cover every consequential record state and does not hash attendance outcomes or evidence. Deployment and end-to-end paths also have not been exercised against a real database or devices.

| Area | Rating | Evidence / limit |
|---|---:|---|
| Architecture | 8.5/10 | Clear shared contracts and separated web, mobile, and backend packages; offline sync and role workflows add substantial integration complexity. |
| Code quality | 8.7/10 | Strict TypeScript checks pass; critical scan, dispute, key, and ledger paths have focused regression coverage. |
| Security and privacy | 8.3/10 | Client-selected GPS relaxation and dispute races are closed; signing keys no longer rotate silently. Ledger coverage and independent anchoring remain open. |
| Feature completeness | 9.0/10 | Core classroom and oversight flows exist across platforms; this audit did not revalidate every journey. |
| Deployment readiness | 7.8/10 | Source checks pass, but no production database migration, app bootstrap, device run, or deployment rehearsal was performed. |

## Resolved or verified

- **Nest provider registration:** `AttendanceModule` provides and exports `LedgerService`, so the audited startup dependency is registered.
- **Forensics API parity:** the shared `ApiClient`, web client, Android client, and backend routes include scan attempts, record timelines, and ledger verification.
- **Ledger forks:** append now derives the chain head from topology under the per-session transaction lock; verification rejects multiple roots, branches, missing links, duplicate hashes, cycles, and disconnected rows.
- **Dispute resolution:** only a still-disputed, unresolved record can be resolved; the database update is conditional, and concurrent attempts become conflicts.
- **Geofence accuracy:** request-controlled channel and device ID no longer select a looser accuracy threshold; strict accuracy and uncertainty checks apply to every channel.
- **Online attendance forensics:** recommendations now inspect both signed checkpoints and require accepted, in-window check-out evidence when an end checkpoint was armed.
- **Signing-key safety:** the server refuses implicit replacement of an existing teacher key. The web client no longer retries by re-provisioning a different key, protecting offline scans signed by the original key.
- **Privacy retention display:** the web and Android privacy views show the live count of rows with coordinates beyond the configured retention window, or `Unknown` when unavailable.
- **UTC anchoring window:** the daily anchor job uses the completed UTC calendar day regardless of server timezone.
- **Mobile style conflict:** two touched NativeWind views no longer combine `className` and `style` on one element.

## Remaining findings

### H1. The ledger does not cover the complete attendance decision history

The existing hash covers session, student, timestamp, predecessor, and salt. It does not cover attendance status, manual overrides, dispute resolution, GPS evidence, or token evidence. Verification now reports finalized non-pending rows with no hash as incomplete coverage, but it cannot detect outcome or evidence edits on rows that are already hashed. A clean chain therefore does not prove that all attendance outcomes and supporting evidence are intact.

**Required before claiming a 9/10 integrity posture:** introduce append-only decision events that include canonical outcome and evidence fields; record every status-changing path; have verification report incomplete coverage; and test those paths with database-backed integration tests.

### H2. Ledger anchors share the application database

Daily anchors are written to `AuditLog`. A database administrator able to rewrite attendance rows can also rewrite those anchors, and ordinary audit-log retention can remove older anchors. The chain helps detect accidental or limited tampering, but it is not an independently protected audit archive.

**Recommended next step:** retain anchors in a separately controlled, append-only store and define a retention policy that preserves them for the required audit period.

### M1. End-to-end and deployment readiness are unverified

Typechecks and focused unit tests passed, but no database-backed bootstrap, migration rehearsal, Playwright journey, Maestro flow, or deployment smoke test was run for this branch. These checks are still required before describing the system as production-ready.

## Verification performed

- Shared package build: passed.
- Shared Vitest: 14 files, 176 tests passed.
- Backend TypeScript check: passed.
- Focused backend Jest: 7 suites, 171 tests passed after the coverage check.
- Frontend TypeScript check: passed.
- Focused frontend Vitest: 3 files, 56 tests passed.
- Android TypeScript check: passed.
- Focused Android Jest: 3 suites, 218 tests passed.
- `git diff --check`: clean after this report update.

These results raise confidence in the audited paths. They do not replace database-backed, browser, device, or deployment verification.
