# Polycheck Master-List Import, Auto-Enrollment & Email Account Activation Plan

> **Status:** Proposed (2026-11-25). Nothing in this document has been implemented.
> Companion to `plan/bulk-import-plan.md` (the shipped CSV/paste import this plan extends),
> `plan/account-governance-plan.md` (forced password rotation, delegated resets),
> `plan/device-integrity-login-plan.md` (student login gate) and `plan/campus-designations-and-maintenance-plan.md`
> (registrar department scope).
>
> **Reader's ground rules:** claims marked **verified** were read from source in this repo while writing this
> plan. Unmarked items are design intent. Items marked **TO VERIFY** must be checked against the live
> dependency/docs before coding (notably Resend's current limits and webhook format).

---

## 0. Executive Summary

**Problem.** A super admin / registrar must currently create student accounts and enroll them by hand, or
prepare a CSV. PUP offices hand over *master lists* (usually exported PDFs, sometimes Excel). Typing 150 to
2,000+ students is the manual work this system exists to eliminate.

**Goal.** From one uploaded master list (**XLSX/CSV now, text PDF next**), an authorized admin can in one flow:

1. preview and correct the parsed rows,
2. create missing student accounts,
3. enroll every student into a chosen section (new or existing),
4. deliver credentials by **email activation link** (Resend) — with the existing **temporary password +
   forced rotation** path kept as the fallback for students without a usable email.

**Most of this already exists (verified):** column mapping, row normalization, checksum-bound
validate→execute, account creation with `mustChangePassword: true`, section enrollment import with a section
advisory lock, department-pinned registrar scope, 90-day import audit batches, and credentials-shown-once
reporting. This plan adds **four new capabilities** and deliberately changes **no existing contract**:

| # | Capability | New surface | Touches existing hot paths? |
|---|---|---|---|
| A | Email delivery (Resend) with an outbox | new `mail` module | No |
| B | Activation links (single-use, student-number confirmed) | new `activation` module + public page | No (own routes; login untouched) |
| C | XLSX and text-PDF → rows, saved column-mapping profiles | frontend upload step only | No (feeds the existing map step) |
| D | "Import master list" step for teachers in section creation/detail (enrollment only; accounts come from the registrar's import — roles stay separated) | frontend flow only | No (no new write endpoint required) |

**Everything ships behind switches that default to today's behavior** (§9). Merging code changes nothing
for students until an admin turns it on.

**Explicit non-goals** (§1.2): no model training, no LLM/OCR extraction in v1, no change to attendance,
scan, ingest, sync, hash-chain, device-integrity, session policy, maintenance mode or AI paths.

---

## 1. Scope

### 1.1 In scope
- Resend email sending behind a provider-agnostic `MailService` (drivers: `resend`, `log` (non-production
  only), `disabled`).
- `deliveryMode` on student import: default `temporary_password` (today); new `activation_email`
  (hybrid — see §4.3).
- Activation tokens, `/activate` web page, request-new-link self-service, admin resend, status visibility.
- XLSX and **text-based** PDF parsing in the browser, header-signature mapping profiles.
- Section-creation "Import master list" step (accounts + enrollment in one guided flow).
- Settings, env, audit, metrics, tests, rollout, rollback.

### 1.2 Out of scope (and why)
| Item | Reason |
|---|---|
| Training/ML models | Unnecessary: rows are anchored by the PUP student-number pattern + header mapping + human preview. |
| OCR for scanned PDFs | Slow/inaccurate on 2 cores of client hardware; defer until real samples prove it is needed. |
| LLM-assisted extraction | Would send names, student numbers and emails to a third party (RA 10173). Needs DPO sign-off; default off, not built here. |
| Server-side PDF parsing | Adds CPU and an attack surface (malformed PDFs) to the 2-core server. Parsing stays client-side. |
| Teacher-side provisioning changes | Existing `allow_teacher_student_provisioning` flow (inactive accounts + bulk activate) is unchanged. |
| Mobile (Flutter / RN) UI | Admin workflow is web-only by Feature Parity Gate justification ("super-admin/registrar-only"). The activation link opens in any mobile browser. `android/` stays untouched. |
| Web push / SMS delivery | Not requested. |

---

## 2. Verified baseline (what exists today)

| Fact | Evidence |
|---|---|
| Student import: validate → execute, execute bound to `rowChecksum`, account created with `mustChangePassword: true`, `password` + `AuthAccount(credential)` rows, synthetic `authEmail` `u-<uuid>@auth.polycheck.invalid`, temp passwords returned once. | `backend/src/users/student-import.service.ts` (`execute`, `importStudents`, `assertChecksum`) |
| Student `email` is already part of the import row and stored on `User.email` (unique). `contactEmail` is a separate optional profile field. | `shared/src/types/bulk-import.ts` (`StudentImportRow.email`), `schema.prisma` `User` |
| PUP student-number pattern `^\d{4}-\d{5}-[A-Z]{2}-\d$` is enforced at import. | `student-import.service.ts` `STUDENT_ID_PATTERN` |
| Import caps: 5,000 rows per file; 250 rows per server request (client chunks). | `shared/src/validation/bulk-import.ts` `IMPORT_MAX_ROWS`; `import-students.dto.ts` `@ArrayMaxSize(250)` |
| Section enrollment import exists with provisioning option for teachers (creates `isActive:false` accounts). | `backend/src/sections/enrollment-import.service.ts` |
| Import UI is a 5-step dialog (`upload → map → validate → confirm → report`); upload parses **CSV only** (`papaparse`). | `frontend/src/components/import/BulkImportDialog.tsx`, `shared/src/utils/import/parse.ts` |
| Registrar/department scope applies to imports through `accountAdminScope`. | `student-import.service.ts` imports from `common/designations/department-pin` |
| `ImportBatch` stores counts + checksum only (never PII rows). | `schema.prisma` `ImportBatch` |
| Login is rate limited per identity and per IP; defaults 10/30 per 60 s **if env unset**; production compose sets `LOGIN_RATE_LIMIT=200`, `LOGIN_IP_RATE_LIMIT=1000`, `TRUST_PROXY=true`, `TRUST_PROXY_HOPS=2`. | `backend/src/auth/auth.service.ts:32-34`, `docker-compose.coolify.yml:95-101` |
| `.env.example` ships `TRUST_PROXY=false`; local compose also false. | `backend/.env.example:13`, `docker-compose.local.yml:81` |
| Encrypted-secret helper exists (AES-256-GCM `enc:v1:`), used for the AI key. | `backend/src/common/utils/secret-box.ts` |
| Backend already has `pdfkit` + `docx` (document **generation**). No XLSX/PDF **parsing** dependency exists in frontend/backend/shared. | `backend/package.json`, `shared/package.json` |
| No email-sending code or dependency exists. | repo-wide grep for resend/nodemailer/smtp returned nothing in `backend/src` |
| Notification infra (in-app + Expo push) exists but is not email. | `backend/src/notifications/` |

**Operating context that shapes the design (from the owner):**
- Students reach the system over **their own mobile data**; there is **no campus Wi-Fi**.
  → per-IP limits are not a campus-NAT problem, but carrier-grade NAT means *some* students share an IP and
  phone IPs change. **Per-account limits are the real protection; per-IP limits stay generous.**
- Pages students open from email must be **light and retry-safe** (flaky connections, in-app email
  browsers, double taps).
- Server is **2 cores**; bcrypt cost 12 (~400 ms/hash) is a deliberate product decision and is kept.
- Timeline: data gathering this week (~150 students), delivery deadline Dec 4–5, 2026. Production domain is
  moving to `polycheck.live` before the gathering.

---

## 3. Guardrails — what must NOT change

These are invariants. Every phase's acceptance criteria re-checks them.

1. **Existing import contract stays byte-compatible.** `POST /users/students/import` and
   `POST /sections/:id/enrollments/import` accept today's bodies and return today's shapes. New request
   field `deliveryMode` is optional (default = today). New response fields are additive and optional.
2. **No new enum values on the wire.** Flutter models fail loud on unknown enum values (lesson from
   DD-C3). New states use booleans/strings the clients never switch on. No new `ImportIssueCode` values —
   reuse `INVALID_EMAIL` / `MISSING_REQUIRED_FIELD`.
3. **Login code path is not modified.** No pre-login "account pending" check (it would leak account
   existence and touch the auth hot path). A pending account simply has a password nobody knows.
4. **Forced password rotation stays exactly as is** (`mustChangePassword` guard, `POST /auth/change-password`).
   Activation is an *alternative way to set the first password*; it clears the flag the same way a
   successful change does.
5. **Device-integrity gate, session policy, privacy-consent gate apply unchanged** at the student's first login.
6. **Attendance, scan, ingest, sync, ledger, hash chain, sessions, disputes: zero changes.**
7. **Department scope is inherited, not reimplemented.** Registrars keep department-pinned scope through the
   existing `accountAdminScope`.
8. **Fail-open audit remains fail-open**; mail failures never fail an import (accounts are created; mail
   status reports the failure).
9. **Secrets never logged or persisted raw**: activation tokens (hash only), temp passwords (unchanged),
   Resend API key (env or sealed setting), no token in server access logs (fragment-based link, §5.2).
10. **No new always-on load on the hot server.** Mail work is I/O-bound, rate-limited, single-concurrency,
    and idle when there is nothing queued.

---

## 4. Design

### 4.1 Account lifecycle

```
                          ┌──────────────────────────────────────────────┐
 import (temporary_password)  →  active, mustChangePassword=true   ──login+forced change──►  active
 import (activation_email)    →  activationPending=true,
                                 mustChangePassword=true,
                                 password = random, never revealed
                                       │  email link (single-use)
                                       ▼
                                 /activate → set password
                                       ▼
                                 activationPending=false, mustChangePassword=false  ──►  active
 admin "reset password"       →  (existing) temp password + forced change; revokes pending activation tokens
 └──────────────────────────────────────────────┘
```

- `User.activationPending Boolean @default(false)` is the **only new state**. Default false means **every
  existing account is unaffected with no backfill**.
- Pending accounts are `isActive: true` (so "disabled by admin" keeps its own meaning and the existing
  inactive/provisioned flow is untouched). They cannot log in because nobody knows the random password.
- Final password is chosen by the student. Nobody, including admins, ever knows it.

### 4.2 Data model (one additive migration, idempotent, no backfill)

`backend/prisma/migrations/2026112x120000_account_activation/`

```prisma
// User: + activationPending Boolean @default(false)

model AccountActivationToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique           // sha256(raw token); raw is never stored
  expiresAt   DateTime
  usedAt      DateTime?
  revokedAt   DateTime?
  failedAttempts Int    @default(0)       // wrong student-number tries; 5 ⇒ revoke
  createdAt   DateTime  @default(now())
  @@index([userId, createdAt])
  @@index([expiresAt])
}

model AccountMail {                         // outbox + delivery status; no message body stored
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind          String                    // 'activation' (extensible: 'activation_reminder')
  status        String   @default("queued") // queued | sending | sent | failed | bounced
  attempts      Int      @default(0)
  providerId    String?                   // Resend message id
  errorCode     String?
  queuedAt      DateTime @default(now())
  sentAt        DateTime?
  batchId       String?                   // ImportBatch.id when created by an import
  @@index([status, queuedAt])
  @@index([userId, queuedAt])
  @@index([batchId])
}
```

Retention: activation tokens older than 30 days and `AccountMail` older than 90 days are pruned by the
existing maintenance cron pattern (`MaintenanceService`, batched deletes). `Section`, `Enrollment`,
`AttendanceRecord` etc. are untouched.

`status` columns are plain strings (not Prisma enums) per guardrail 2.

### 4.3 Delivery modes on student import (hybrid)

`deliveryMode?: 'temporary_password' | 'activation_email'` on `StudentImportRequest`
(shared type optional; `StudentImportRequestDto` gains `@IsOptional() @IsIn([...])`).

- **Default / omitted → exactly today's behavior.**
- **`activation_email`** (only honored when the master switch is on and the mail driver is usable, else 400
  `activation_email_unavailable` with a clear message):
  - Row **has a valid email** → account created `activationPending=true` with a random hashed password
    (generated by the existing `generateTemporaryPassword`, hashed, **discarded**); an `AccountMail` row
    (`queued`, `batchId`) is inserted **in the same transaction**. No credential returned for the row.
  - Row **has no valid email** → falls back to today's path (temp password returned once in `credentials`).
  - Rows that are updates/skips behave exactly as today (imports never touch passwords of existing accounts).
- `deliveryMode` is part of the row checksum input so an execute cannot silently switch modes after validate.
- Result gains optional `activation?: { queued: number; fallbackTemporary: number }` (additive).

**Why an outbox instead of sending inside the request:** the import transaction must stay short and
deterministic; emails are sent by a worker. A crash after commit cannot lose mail — the `queued` rows are the
source of truth and a sweeper re-queues stuck rows (§4.5). The raw activation token is generated **at send
time by the worker**, so no raw token is ever persisted and the link lifetime starts when the mail is sent.

### 4.4 Activation module (`backend/src/account-activation/`)

Public routes (own controller; `auth.controller.ts` is not modified):

| Route | Purpose |
|---|---|
| `POST /activation/validate` | `{ token }` → `{ valid: true, expiresAt }` or generic invalid. Does **not** consume the token. |
| `POST /activation/complete` | `{ token, studentId, password }` → sets password, activates, returns `{ ok: true }` (no session; student logs in normally so the device-integrity/consent gates apply). |
| `POST /activation/request-link` | `{ studentId, email }` → always `202 { ok: true }`. |

**Token:** 32 random bytes (`randomBytes`), base64url; only `sha256` stored. TTL from setting
`activation_link_ttl_hours` (default **168 = 7 days**, clamp 24–336) — long because students are on mobile
data and may open mail late; the self-service resend (§4.6) is the safety net.

**Complete flow (single transaction):**
1. Look up by `tokenHash`; require `usedAt IS NULL AND revokedAt IS NULL AND expiresAt > now()`.
2. Require submitted `studentId` (normalized like import) equals the token owner's student number
   (second factor — master-list emails can be wrong or shared). Mismatch → increment `failedAttempts`;
   at 5, set `revokedAt`.
3. Enforce the existing password policy (shared validator, 12+ chars) and hash with the existing native
   bcrypt util.
4. Update `User.password` **and** the `AuthAccount(credential)` password hash (both exist — verified in the
   import code), set `mustChangePassword=false`, `activationPending=false`, bump `authVersion` (kills any
   stale sessions; there should be none).
5. Claim the token with `UPDATE … WHERE usedAt IS NULL` (atomic; a concurrent double-tap loses cleanly),
   revoke all other tokens for the user.
6. Audit `account.activation_completed` (fail-open). Never log the token.

**Retry-safety (flaky mobile data):** a repeated submit finds `usedAt` set and returns
`{ ok: true, alreadyActivated: true }` ("already activated, please log in"). That reveals only that *this
token* was used.

**Error discipline:** invalid / expired / revoked / unknown tokens return the **same** generic response
and status. No account-existence leakage.

**Link design:** `https://<FRONTEND_URL host>/activate#token=<raw>` — the token lives in the URL
**fragment**, so it never reaches the proxy access logs, and mail-security link scanners (which `GET`
links) cannot consume it (validation is a JS `POST`). The page sets `Referrer-Policy: no-referrer`, loads
no third-party scripts, and is lightweight.

### 4.5 Mail module (`backend/src/mail/`)

- `MailService` interface: `send({ to, subject, html, text, idempotencyKey })`.
- Drivers via `MAIL_DRIVER`: `resend` (plain `fetch` to Resend's HTTP API — **no SDK dependency**),
  `log` (writes the link to the server log for dev/E2E; **env validation rejects it when
  `NODE_ENV=production`**), `disabled` (default when no key).
- **Outbox worker:** BullMQ queue `account-mail` (own queue; never shares the attendance-sync queue),
  concurrency 1, limiter `MAIL_RATE_PER_SECOND` (default 2; **TO VERIFY** Resend's current rate limit and
  whether to use its batch endpoint). Job = one `AccountMail.id`. Worker: claim row (`queued→sending`),
  create the token, send, mark `sent`/`failed`, exponential backoff, max 5 attempts, `errorCode` only (no
  provider body).
- **Sweeper:** `@Cron` every 5 min re-enqueues `queued` rows older than 2 minutes and `sending` rows older
  than 10 minutes (crash recovery). Idle when nothing matches.
- **Daily budget guard:** `MAIL_DAILY_CAP` (default conservative, e.g. 500) — when reached, rows stay
  `queued` and an audit/metric fires; prevents burning the provider quota (**TO VERIFY** the Resend plan's
  daily cap; the free tier has historically had a small daily limit, which matters for 2,000-student
  imports — plan to use a paid tier or spread sends over days).
- **Bounce/complaint webhooks (phase A2, optional):** `POST /webhooks/resend` with Svix-style HMAC
  signature verification and timestamp tolerance (**TO VERIFY** header names/format against Resend docs
  before implementing). Updates `AccountMail.status` to `bounced`. Until then, "sent" means accepted by
  Resend, and the UI says so.
- **Email content:** minimal. Greeting with first name, "Activate your Polycheck account", the link, expiry,
  "if you did not expect this, ignore it". **No student number, grades, attendance, or temp password.**
  Plain-text alternative included. Sender `MAIL_FROM` on the verified `polycheck.live` domain.
- **Privacy:** Resend is a third-party processor (possibly cross-border). Add one line to the privacy notice
  and brief the DPO. Update the notice version only if the DPO requires re-consent (the notice-version bump
  mechanism already exists; remember the DD-F4 lesson — a bump must never destroy queued offline scans, and
  that is already fixed).

### 4.6 Expired link: self-service + admin backup

**Self-service (primary).** The expired/invalid page shows "This link is no longer valid" and a short form:
**student number + the email on the master list**. Server rules:
- Always responds `202` with identical copy: "If the details match a pending account, we sent a new link."
- Sends only if `activationPending=true` **and** the email matches `User.email` (case-insensitive). The link
  goes to the **stored** address, never to the typed one.
- Issuing a new link revokes older ones (one live token per account).
- Limits (Redis `consumeRateLimit`, existing pattern): per account **1 per 3 min and 5 per day**; per IP
  **generous (e.g. 60/hour)** because carrier-grade NAT can put many students behind one address; plus
  the global `MAIL_DAILY_CAP`.

**Admin (backup, for wrong/missing/bounced emails):**
- `POST /users/:id/activation/resend` and `POST /users/activation/resend-pending` (queue all pending in the
  caller's scope). Guarded by the same account-admin scope as other user-administration routes
  (super admin institution/department scope, registrar department-pinned).
- Existing `PATCH /users/:id` already edits `email`; fixing the address then resending is the supported path.
- Existing "reset password" remains the escape hatch (temp password + forced rotation) and **revokes pending
  activation tokens** (small additive change inside `resetPassword`, covered by a test).
- `GET /users` gains an optional `activation=pending` filter (DTO whitelist updated). User payload gains
  optional `activationPending?: boolean` and `activationMail?: { status: string; sentAt?: string }` (strings
  only — no enum).

### 4.7 Master-list parsing (frontend only)

All parsing runs **in the admin's browser** (no server CPU, no PII to third parties), loaded with dynamic
`import()` so the main bundle does not grow. The output is the same `{ headers, rows }` shape
`parseCsv` produces, so the existing **map → validate → confirm → report** steps are unchanged.

| Format | v1? | Approach |
|---|---|---|
| CSV / pasted text | exists | unchanged |
| **XLSX** | **yes** | a maintained browser-safe reader (candidates: `read-excel-file`, `exceljs`; **pick after a bundle-size and advisory check — avoid the npm-published SheetJS `xlsx`, which has open advisories**). First non-empty sheet by default, sheet picker if several. Cell values coerced to text; existing `EXCEL_MANGLED_STUDENT_NUMBER` detection stays. |
| **Text-based PDF** | **yes (after XLSX)** | `pdfjs-dist` (pinned). Extract text items with coordinates → cluster into lines by Y → **anchor each record on the PUP student-number regex** (a very strong signal) → assign cells to columns using header X-ranges; merge wrapped name lines that lack a student number into the previous row; strip page headers/footers repeated per page. |
| Scanned PDF (image only) | **no** | detect "no text layer" and show: "This PDF is a scan. Please upload the Excel/CSV version or contact the registrar." |

**Limits:** 10 MB file, 50 pages, 5,000 rows (existing `IMPORT_MAX_ROWS`). Magic-byte check, not just
extension/MIME. Parser errors never crash the dialog (error state + retry, per the DD-W lesson).

**Mapping profiles ("learning" without training).** After an admin confirms a mapping once, store
`headerFingerprint → column mapping` (headers only; **no student data**). v1 stores it in `localStorage`
(per admin device); a shared server table is a later option. Next upload with the same header set maps
automatically (still previewed). Synonym matching for headers already exists in `import/map.ts`; extend the
synonym list for observed PUP wording.

**Test fixtures:** synthetic master lists only (regenerated from the *structure* of real samples). **Never
commit real student PII.** Also a round-trip test using Polycheck's own master-list PDF (fixed
`MASTER_LIST_COLUMNS`), which is the one format guaranteed to be parseable.

CSP note: pdf.js needs a worker. Verify the frontend CSP (`worker-src`) before shipping; prefer a same-origin
worker file over blob workers.

### 4.8 Section creation + master list ("import and enroll")

**Role constraint (verified, and it shapes this whole section):** `POST /sections/:id/enrollments/import` is
`@Roles('teacher')` and owner-only (`loadOwnedSection`). Super admins and registrars **cannot enroll**
(classroom resources are read-only for admins by product policy), and teachers **cannot create accounts**
unless `allow_teacher_student_provisioning` is on. So no single actor can do "create + enroll" with today's
rules, and this plan does **not** relax that separation. The flow is therefore two hand-offs that share one
parser and one dialog:

| Actor | Where | What the master list does |
|---|---|---|
| **Super admin / registrar** (department-pinned) | Users console → Import | Creates the **accounts** (activation email or temp password, §4.3). Enrollment is not offered to them. |
| **Teacher** (section owner) | Section create / section detail → **"Import master list"** | **Enrolls** students into their own section. Rows whose account does not exist are reported as `STUDENT_NOT_FOUND` with a clear line: "N students have no account yet — ask the registrar to import them first, then re-run." |

Recommended operating procedure for a term: (1) registrar imports the program/year master lists once
(accounts + activation emails); (2) each teacher imports the section roster into their section. Because
the accounts already exist, step 2 never needs provisioning.

**Optional teacher provisioning (existing behavior, unchanged by default):** when the institution turns on
`allow_teacher_student_provisioning`, a teacher's enrollment import already creates inactive accounts and
enrolls them (verified). v1 leaves that untouched (no activation mode for teachers); a follow-up can let
those provisioned accounts receive an activation email instead of waiting for an admin to bulk-activate.

Both steps are idempotent (existing students skipped; already-enrolled skipped), so either can be re-run
safely and a half-finished term setup is fixed by running the import again. A multi-section program list
with a `section` column is a follow-up; v1 handles one section per import and reports "N rows ignored:
different section" rather than guessing.

### 4.10 Irregular and cross-program students

Students may legitimately take a subject in a section of a different course (irregular load, retaking a
failed subject, shifting). Verified current behavior: enrollment import compares the list's program/year to
the account only to emit a **warning** (`PROGRAM_YEAR_MISMATCH`); it never blocks, and `Section.course` is
not matched against `User.program`. This plan **keeps it that way**:

- A student's own program never restricts which sections they can be enrolled in.
- In the report, program/year mismatches are labelled as informational ("different program — irregular or
  cross-enrolled?"), grouped and counted, so a teacher does not mistake a normal cross-course enrollment for
  an error. No new `ImportIssueCode` is added (guardrail 2); only the existing message copy changes.
- Department scope applies to **account administration only**: a registrar importing an existing account
  from another department gets `DEPARTMENT_MISMATCH` and that row is skipped at the *account* step — the
  student still exists and the owning teacher can still enroll them into any section.
- Master lists may therefore contain students whose program differs from the section's course; the parser
  never filters rows by program.
- **TO VERIFY before implementation:** how department-head oversight scoping treats a cross-department
  student (scoped by the student's department or by the section's teacher department). The import itself
  does not depend on the answer, but at-risk/report visibility for cross-program students does; if scoping
  follows the student's department, a head would not see an irregular student in another department's
  section — decide whether that is acceptable before relying on it for oversight.

### 4.9 Frontend surfaces

- `/activate` public page (inside the auth-landing route group): token from fragment → validate → student
  number + new password (live policy hints) → success → "Go to login". Expired/invalid → request-link form.
  Idempotent submit, disabled-while-pending button, 8 s+ tolerant timeouts and an inline retry for flaky
  data, fully usable in in-app email browsers, no dependency on the Polycheck mobile app.
- Login page: a quiet "First time? Activate your account" link → request-link form.
- Users console: **Invited** status chip, `activation=pending` filter, row "Resend activation email", bulk
  "Resend to all pending (N)", "email failed/bounced" indicator.
- Import dialog: file-type picker adds `.xlsx`/`.pdf`; confirm step shows the delivery mode choice
  (default = "Temporary passwords (current)"; "Email activation links" appears only when enabled); report
  step shows queued / fallback / failed counts, with the existing credentials CSV for fallback rows.
- Institution Settings → Accounts & access (web): `activation_email_enabled` (master switch),
  `activation_link_ttl_hours`. Mail provider status line ("Resend configured / not configured") read-only.

---

## 5. Configuration

New env (all optional; feature is inert when unset):

| Variable | Default | Purpose |
|---|---|---|
| `MAIL_DRIVER` | `disabled` | `resend` \| `log` (non-production only) \| `disabled` |
| `RESEND_API_KEY` | — | Provider key (secret; never logged) |
| `MAIL_FROM` | — | e.g. `Polycheck <no-reply@polycheck.live>` |
| `MAIL_REPLY_TO` | — | Optional help mailbox |
| `MAIL_RATE_PER_SECOND` | `2` | Worker limiter (**TO VERIFY** vs Resend limit) |
| `MAIL_DAILY_CAP` | `500` | Safety budget |
| `ACTIVATION_REQUEST_ACCOUNT_LIMIT` / `_WINDOW` | `5` / `86400` | Per-account resend cap |
| `ACTIVATION_REQUEST_IP_LIMIT` / `_WINDOW` | `60` / `3600` | Per-IP resend cap (generous for CGNAT) |

Wiring: `backend/.env.example`, `.env.production.example`, `docker-compose.local.yml`,
`docker-compose.coolify.yml`, and `env-validation.ts` (all optional; reject `MAIL_DRIVER=log` in
production; require key + from when driver is `resend`).

New settings keys (migration seeds, idempotent, same pattern as `ai_assistant_enabled`):
`activation_email_enabled` (default **false**), `activation_link_ttl_hours` (default 168).

**Domain prerequisites (do first — DNS propagation takes time):** verify `polycheck.live` in Resend
(SPF, DKIM, DMARC). Activation links are built from `FRONTEND_URL`, so they follow the domain cutover
automatically. **Do not send from `addtokart.tech`.**

---

## 6. Security & privacy review

| Risk | Mitigation |
|---|---|
| Token theft from mailbox | Single-use, 7-day default TTL, student-number second factor, revoke-on-5-failures, resend revokes older links, hash-only storage. |
| Token in logs/referrers | Fragment-based link, `Referrer-Policy: no-referrer`, no third-party scripts, never logged. |
| Link scanners consuming links | `GET` does nothing; consumption requires a JS `POST` with the fragment token. |
| Account enumeration | Uniform responses for validate/complete failures and request-link; stored-address-only sending. |
| Email bombing a student | Per-account cooldown + daily cap + global daily mail cap. |
| Brute force on `complete` | Per-token attempt cap + per-IP and per-token Redis limits; bcrypt hashing only after cheap checks pass. |
| Admin impersonation / scope escape | Resend/import routes reuse `accountAdminScope`; registrar stays department-pinned. |
| Wrong email on master list | Student-number factor; admin edit + resend; temp-password fallback. |
| Third-party processor (Resend) | DPO briefing + privacy-notice line; minimal email content; no PII beyond first name and the recipient address. |
| PDF parser abuse | Client-side only; size/page limits; magic-byte check; pinned `pdfjs-dist`; no server parsing. |
| Bulk activation burst (2,000 bcrypt hashes) | Completions arrive spread over days via email; per-IP/token limits protect the 2 cores; bcrypt cost unchanged. |
| Real PII in repo/tests | Synthetic fixtures only. |

---

## 7. Performance & capacity (2 cores, mobile-data users)

- Parsing: browser-side; zero server load.
- Import: unchanged chunked transactions; additional work per activation row is one small insert
  (`AccountMail`) in the same transaction.
- Mail worker: concurrency 1, ~2 mails/s, network-bound. 2,000 mails ≈ 17 minutes of trickle, negligible CPU.
- `/activation/complete`: one bcrypt hash (~400 ms CPU) per student; naturally spread out; rate limited.
- `/activation/validate` and `request-link`: a couple of indexed lookups and Redis calls.
- No new always-on polling; the sweeper query is indexed (`status, queuedAt`) and runs every 5 minutes.
- Activation page payload small; works on weak mobile data; submit is idempotent so retries are safe.

**Related config check (not part of this feature, but it decides whether it works in production):**
confirm `TRUST_PROXY=true` with the correct hop count on the production backend (verified in
`docker-compose.coolify.yml`; `.env.example` and local compose default to `false`). Without it every client
appears as the proxy's IP and any per-IP limit would apply to **all** users at once.

---

## 8. Test plan

**Unit / service (backend):**
- Token: generation entropy/shape, hash-only storage, expiry, single-use claim under concurrent calls.
- `activation/complete`: wrong student number counter + revoke at 5, policy failure, success updates
  `User.password`, `AuthAccount` password, flags, `authVersion`, revokes siblings; idempotent replay returns
  `alreadyActivated`; uniform errors for unknown/expired/revoked.
- `request-link`: uniform response; only-pending + email-match sends; stored address used; per-account/IP
  limits; global cap.
- Import: `deliveryMode` omitted ⇒ **all existing specs pass unchanged**; `activation_email` ⇒ pending
  accounts + `AccountMail` rows in-transaction, no credential for emailed rows, fallback credentials for
  no-email rows, checksum includes mode, unavailable-mode 400, registrar scope preserved, skips/updates
  unchanged.
- `resetPassword` revokes pending tokens; existing reset behavior otherwise identical.
- Mail: driver selection, env validation (`log` rejected in production), Resend request shape, error mapping
  without leaking provider body, rate limiter, sweeper recovery, daily cap.
- DTO whitelist tests (`forbidNonWhitelisted` stays on).

**Shared / frontend:**
- XLSX/PDF parsers against synthetic fixtures (single page, multi-page with repeated headers, wrapped names,
  extra columns, scan-only PDF rejection, oversize), profile fingerprint reuse, round-trip with Polycheck's
  own master-list PDF.
- Dialog steps with new file types; delivery-mode UI gating; `/activate` page states (valid, invalid,
  expired→request, replay, offline/timeouts); Users console chips/filters/actions.

**E2E (Playwright, Chromium first; Firefox/WebKit after):**
- Import XLSX → activation mode (`MAIL_DRIVER=log` capturing the link) → open link → set password → login →
  forced-rotation gate **not** shown (already set) → privacy consent → dashboard.
- Expired link → self-service request → new link works, old link dead.
- No-email row → temp-password fallback → login → forced change (existing journey).
- Section "Import master list" chain: accounts created + enrolled; re-run is a no-op.
- Registrar department-pinned import; teacher cannot use activation mode.

**Regression gates (must stay green before merge):** shared, backend (incl. device-binding, auth, import,
sections, users specs), frontend, `pnpm build`, Prisma validate, migration applies on a fresh volume and on
the current dev database. Flutter `flutter test` + `analyze` unchanged (no Dart changes; run to prove it).

**Load check:** after implementation, re-run the planned 150-student and campus-morning scenarios (activation
complete + login) to confirm bcrypt/limits behave on the 2-core profile.

---

## 9. Rollout, flags and rollback

**Flags (all default to current behavior):**
1. `MAIL_DRIVER=disabled` and `activation_email_enabled=false` ⇒ import UI and API behave exactly as today.
2. `deliveryMode` omitted ⇒ legacy path.
3. XLSX/PDF upload is additive to the upload step; CSV path untouched.

**Rollback:** turn off `activation_email_enabled` (new imports revert to temp passwords). Pending accounts
remain activatable via their links or an admin reset (temp password + forced rotation). The migration is
additive; no down-migration is required for safety. Mail worker and sweeper are inert without queued rows.

**Suggested order (each step independently shippable and revertible):**

| Step | Content | Size | Gate |
|---|---|---|---|
| M0 | DNS/domain: verify `polycheck.live` at Resend; decide plan tier; DPO note | S (calendar time) | none |
| M1 | Migration + `account-activation` module + public routes + token tests (no mail yet; `log` driver) | M | backend specs |
| M2 | `mail` module (outbox, worker, sweeper, Resend driver, env/settings, metrics) | M | backend specs |
| M3 | Import `deliveryMode` + admin resend/filters + `resetPassword` revoke | M | import/users specs unchanged-green |
| M4 | `/activate` page + login link + Users console chips + import dialog/report copy | M | frontend + E2E |
| M5 | XLSX parsing + upload step + mapping profiles | M | parser tests |
| M6 | Section "Import master list" chain | S | E2E |
| M7 | Text-PDF parsing | M–L | fixtures + round-trip |
| M8 (optional) | Resend webhooks for bounces | S–M | signature tests |
| M9 (optional) | Shared server-side mapping profiles | S | — |

**Timeline guidance (deadline Dec 4–5; gathering this week):** do **M0 now** (calendar-bound), and treat
**M1–M4 as the minimum viable slice**; ship them only after the gathering stabilizes and the full
Chromium suite is green. **M5–M7 are demo-value extras** and may slip past the deadline without hurting the
core system. Until then the current CSV import + temp-password flow remains fully supported, so nothing here
blocks the gathering.

---

## 10. Files expected to change

**New:** `backend/src/account-activation/**`, `backend/src/mail/**`,
`backend/prisma/migrations/2026112x120000_account_activation/`, `frontend/src/app/(auth-landing)/activate/**`,
`frontend/src/lib/import/{xlsx,pdf}-parser.ts` (+ tests), `shared/src/types/activation.ts`,
`shared/src/validation/activation.ts`.

**Modified (additive):** `backend/prisma/schema.prisma`, `backend/src/users/{student-import.service.ts,
users.service.ts,users.controller.ts,dto/import-students.dto.ts,dto/*list-query*}`,
`backend/src/settings/settings.service.ts` (+ migration seeds), `backend/src/common/config/env-validation.ts`,
`backend/src/common/services/maintenance.service.ts` (pruning), `backend/src/app.module.ts`,
`.env*.example`, both compose files, `shared/src/types/bulk-import.ts` (optional fields),
`shared/src/validation/bulk-import.ts`, `shared/src/utils/import/{parse,map}.ts`,
`frontend/src/components/import/BulkImportDialog.tsx`, `frontend/src/app/faculty/users/page.tsx`,
`frontend/src/app/faculty/sections/create/page.tsx`, `frontend/src/app/faculty/settings/**`,
login page link, privacy notice text, `frontend/src/lib/api-client.ts`, `AGENTS.md` (docs).

**Explicitly untouched:** `services/ingest/**`, attendance/scan/sync/ledger/sessions/disputes/ai/standing
modules, `auth.controller.ts` login routes, `session-policy.ts`, `device-binding.service.ts`,
`polycheck_mobile/**`, `android/**`.

---

## 11. Open questions (answer before M3/M4)

1. **Resend plan & limits** — which tier, what daily/second caps? (**TO VERIFY**; determines
   `MAIL_DAILY_CAP`, rate, and whether 2,000-student sends must be spread over days.)
2. **Whose emails are on the master list** — personal Gmail or `@iskolarngbayan.pup.edu.ph`? Institutional
   addresses may filter unknown senders; plan a "check spam" line and a DMARC-aligned sender.
3. **Sample master lists** — 3–5 real examples (PDF + the Excel source if it exists) to derive synthetic
   fixtures and header synonyms. PII must be redacted before sharing.
4. **Link lifetime** — is 7 days right for the campus?
5. **Who may use activation mode** — super admin and registrar only (default here), or teachers too?
   (Admins create accounts, teachers enroll — see §4.8; this question only concerns account creation.)
5b. **Department-head visibility of cross-program students** — see the TO VERIFY in §4.10.
6. **Privacy notice** — does the DPO require a notice-version bump for the email processor?
7. **Multi-section master lists** — needed now, or is one list per section enough for v1?

---

## 12. Acceptance criteria

- With every new switch off, the full existing test suites pass **unmodified** and the import UI/API behave
  as before.
- With activation mode on: a validated XLSX import of 150 rows creates accounts, enrolls them in the chosen
  section, queues mail for every row with an email, returns temp-password credentials only for rows without
  one, and a student can activate and log in on a phone browser on mobile data.
- An expired link leads to self-service resend without admin help; the old link no longer works; all
  responses are uniform; limits hold.
- An admin can see who is still pending, fix an email, and resend individually or in bulk.
- No raw token, password, or provider payload appears in logs, audit rows, or `AccountMail`.
- Attendance, ingest, sync, ledger and login behavior are byte-for-byte unchanged (verified by the unchanged
  suites and a before/after smoke).
