# Polycheck — System Plan and Implementation Reference

**Institution:** Polytechnic University of the Philippines (PUP)

**System name:** Polycheck

**Document type:** Living system plan and implementation reference

**Repository verification date:** August 14, 2026

---

## 1. Purpose and Current Status

Polycheck is a unified web and mobile attendance-management system for PUP. It replaces paper attendance and class-monitoring forms with authenticated accounts, short-lived signed QR codes, geolocation evidence, section rosters, attendance review, disputes, proof-of-class uploads, reporting, and an audit trail.

This document describes the system that currently exists in the repository. A capability labeled **implemented** has application code and supporting contracts in the monorepo. A capability labeled **deployment-dependent** is implemented but still requires institution-owned infrastructure, credentials, policies, or store approval. Items under **Future Scope** are not part of the current v1 implementation.

The current repository contains:

- a Next.js web application for students, teachers, and Super Admins;
- an Expo React Native application for students and faculty, stored in `android/`;
- a NestJS REST and Socket.IO backend with Better Auth, Prisma, PostgreSQL, Redis, and BullMQ;
- shared TypeScript domain types, Zod validation, QR signing, geofence, and calendar utilities;
- local and production Docker topologies, monitoring, backup and recovery tooling;
- unit, integration, web end-to-end, Android end-to-end, security, container, and load-test checks.

---

## 2. Problem Being Solved

Paper attendance allows proxy signing, can be lost or altered, provides limited audit evidence, and makes department-level reporting slow and error-prone. Polycheck creates a traceable attendance workflow in which the system records the student, class session, time, location evidence, installation identifier, QR input channel, validation outcome, and later administrative changes.

The system is designed for classrooms with unreliable connectivity. The Expo mobile app can use pre-synced data to activate sessions and record check-ins offline, then reconcile them with the server when connectivity returns. PostgreSQL remains the authoritative cloud record after synchronization.

---

## 3. Roles and Authorization Boundaries

### 3.1 Super Admin

Super Admins are department heads, program chairs, or authorized institutional officials. Their scope is either a department or the institution.

Implemented capabilities:

- view scoped subjects, sections, sessions, attendance, disputes, proofs, dashboards, and reports;
- use global search and export attendance data;
- create teacher and student accounts;
- activate or deactivate accounts and reset passwords;
- manage institution settings.

Super Admin access to classroom data is read-only. Super Admins cannot create, update, or delete subjects, sections, sessions, attendance, enrollment codes, rosters, section roles, session permissions, QR tokens, disputes, or proof-of-class records.

### 3.2 Teacher / Instructor

Teachers manage the classroom resources assigned to them. A teacher can:

- create parent subjects and manage subjects they created;
- create and manage their own sections, schedules, rooms, semesters, enrollment codes, and rosters;
- create individual or recurring sessions with a session-specific geofence;
- generate a locally signed QR token and activate or end a session;
- view live rosters, attendance summaries, reports, calendar views, and exports;
- manually set attendance and resolve student or system-generated disputes;
- assign President and QAC section roles;
- grant or revoke a 24-hour session permission for an enrolled student;
- upload proof of class and delete proof belonging to their sessions.

Teachers cannot manage sections owned by another teacher. Subject updates and deletion are limited to the teacher who created the parent subject; a subject with existing sections cannot be deleted.

### 3.3 Student

Students can use both the web portal and the Expo mobile app. A student can:

- view their dashboard, enrolled classes, monthly or weekly schedule, session details, attendance history, and digital ID;
- enroll in a section with an active enrollment code;
- scan an attendance QR code using the camera, with controlled image/manual fallbacks where enabled;
- view only their own attendance and submit a dispute against their own record;
- view proofs for sessions in sections where they are enrolled.

The mobile app is the primary offline-capable student client. The web portal supports online QR scanning through the browser camera and browser geolocation.

### 3.4 Student Officers and Temporary Permissions

Teachers may assign the following per-section roles:

- **President:** may create an individual session only when the student is enrolled, is assigned the President role, and has an active teacher-granted session permission. Bulk session creation, QR activation, and session ending remain teacher-only operations.
- **QAC:** may upload proof of class while a session is active.
- **Authorized student:** a student with an active session permission may also upload proof while the session is active.

Session permissions expire after 24 hours and can be revoked early. Scheduled maintenance marks expired permissions inactive.

---

## 4. Domain Model and Academic Hierarchy

The current academic hierarchy is:

```text
Subject (course catalog entry)
└── Section (teacher-owned class offering for a semester)
    ├── Schedule days and rooms
    ├── Enrollments and section officers
    └── Sessions (individual class meetings)
        ├── Signed QR activation and geofence
        ├── Scan attempts and attendance records
        └── Proof-of-class submissions
```

This distinction is important:

- A **Subject** contains the course name, code, and optional description.
- A **Section** connects a subject to a teacher, section name, semester, default room, weekly schedule, enrollment code, and roster.
- A **Session** represents one dated meeting. Its room, start/end time, QR rules, geofence, active state, and rescheduling metadata are session-specific.

Enrollment codes are generated per section, not per subject or session. New sections receive a seven-character alphanumeric code that expires after 14 days. A teacher may reset the code, which starts a new 14-day window, or disable it. Existing enrollments remain valid.

---

## 5. Core Functional Capabilities

### 5.1 Subject, Section, and Enrollment Management

Teachers create the subject first, then add one or more sections. A section supports Monday through Sunday schedules, per-schedule room overrides, a semester, manual enrollment, enrollment by code, roster removal, search, pagination, attendance summaries, and section-role assignment.

Student-facing section responses do not expose enrollment codes. Teachers can manage codes only for their own sections. Super Admin interfaces treat classroom resources as read-only and do not provide enrollment-code controls.

### 5.2 Calendar and Session Planning

Teachers can create one session or generate recurring sessions across a date range and selected days. A session records:

- section and teacher ownership;
- date, start time, end time, and room;
- geofence latitude, longitude, and radius;
- QR validity and grace-period defaults;
- active/end state and QR timestamps;
- optional rescheduling metadata.

The web and mobile applications provide month and week calendar views. Calendar entries are computed from section schedules and stored sessions; they are not a separate persisted calendar-event table.

### 5.3 Signed QR Attendance

QR tokens use an Ed25519 signature implemented with TweetNaCl. The payload contains the token version, session ID, section ID, teacher ID and name, signed `issuedAt`, validity minutes, and grace-period minutes.

Current policy limits are:

- QR validity: **1 to 15 minutes**;
- grace period: **0 to 60 minutes**;
- a scan within the validity period becomes **Present**;
- a scan after validity but within grace becomes **Late**;
- a scan after grace is rejected as **Absent** unless other evidence rules require dispute review.

Teacher private keys are created on the client. Mobile stores account-specific key material in Expo SecureStore. The web client encrypts the secret with a non-exportable AES-GCM wrapping key in IndexedDB. Only the public key is provisioned to the backend. Key provisioning and revocation are rate-limited, and replacing or revoking a key invalidates related active-session cache entries.

A session can be activated only once. Activation verifies the teacher signature and token/session ownership, creates a `pending` attendance row for every enrolled student, and makes the signed token active. Manual end or automatic expiry converts remaining `pending` rows to `absent`.

### 5.4 Geolocation and Scan Evidence

Each session has a circular geofence. The clients request a fresh high-accuracy location and submit:

- latitude and longitude;
- accuracy in meters;
- location capture time;
- mock-location signal when available;
- client-reported device-integrity signals (root/jailbreak, dynamic hooking, and emulator heuristics) when available;
- opaque installation ID;
- QR input channel (`camera`, `image`, or `manual`);
- stable client attempt ID and scan time.

The backend always re-validates the authoritative session, enrollment, teacher public key, token identity, token timing, location freshness, accuracy, geofence distance, and duplicate/replay state. PostgreSQL, not Redis, is authoritative for session state and teacher keys.

Current validation rules reject explicitly mocked locations, location fixes older than two minutes, accuracy worse than 50 meters, and coordinates outside the session radius. Root/jailbreak, dynamic-hooking, and emulator signals are treated as advisory security evidence: a flagged submission is retained as `disputed` for teacher review rather than silently accepted or discarded. Borderline or incomplete evidence can also be routed to dispute review.

### 5.5 Attendance Lifecycle

Attendance uses five statuses:

- `pending` — enrolled student has not yet produced an accepted scan while the session is active;
- `present` — valid scan inside the QR validity window;
- `late` — valid scan inside the grace period;
- `absent` — no accepted scan at session end, or a definitive eligibility/window/geofence failure;
- `disputed` — evidence requires teacher review.

Every scan attempt is stored separately from the canonical attendance record. Accepted records maintain a link to the accepted scan attempt. A unique session/student constraint prevents more than one canonical attendance record. Stable client attempt IDs make exact request retries idempotent and expose conflicting replays.

Teachers can manually create or update an attendance record. Manual changes are marked with `manuallySet`. Attendance views include session rosters, per-student histories, section summaries, filters, charts, pagination, CSV export, and live refresh.

### 5.6 Disputes

Students may dispute one of their own attendance records by selecting a supported reason and adding a description. System validation may also mark a record as disputed for conditions such as an invalid signature, stale or uncertain location, suspicious coordinates, incomplete evidence, or delayed offline synchronization.

Teachers can accept, reject, or override a disputed record. Resolution state and the reason/description are stored on the attendance record; the current Prisma schema does not use a separate `Dispute` table. Super Admins may monitor scoped disputes but cannot resolve them.

### 5.7 Digital Student ID

The student experience includes a flippable digital PUP ID showing the student's name, student number, program, year level, profile image, institutional styling, conditions, and a QR-style back face. The Expo app applies screen-capture prevention to the signed-in student experience where the operating system supports it.

The ID is an authenticated display feature. v1 does not cryptographically bind the ID or account to one physical device.

### 5.8 Proof of Class

While a session is active, the owning teacher, a section QAC, or an enrolled student with active permission can upload JPEG, PNG, or WebP proof. The backend validates the declared type, file signature, and size. Development can store files locally; production requires S3-compatible object storage. Only the session teacher can delete a proof. Super Admin access is read-only and scope-limited.

### 5.9 Search, Dashboards, Reports, and Settings

Implemented cross-system capabilities include:

- role-specific dashboards and recent activity;
- global search across students, sections, and sessions;
- teacher and Super Admin attendance reports with date, teacher, subject, section, and session filters;
- CSV export;
- user creation, account status control, and password reset for Super Admins;
- institution key/value settings for Super Admins;
- real-time session and attendance updates through Socket.IO, with periodic UI refresh as a fallback.

---

## 6. Offline-First Architecture

### 6.1 Scope of Offline Support

Offline-first behavior is implemented in the Expo mobile client. The Next.js web application is an online client and should not be described as a full offline classroom client.

The mobile SQLite store is account-partitioned and contains cached subjects, sections, sessions, attendance, sync metadata, and an operation queue. Payloads are authenticated and encrypted with TweetNaCl `secretbox`; the encryption key and installation ID are held in platform secure storage.

### 6.2 Pre-Sync

Before class, a signed-in mobile user should open the app while connected. Pre-sync:

1. reads server time and stores a calculated server-clock offset;
2. drains previously queued operations;
3. refreshes subjects, sections, sessions, and student attendance where applicable.

The stored clock offset is considered usable for up to seven days. A student must at least have the cached session, teacher public key, and geofence to validate an offline scan. Some offline validation paths require the stored clock offset; the scan-submission path uses it when available and otherwise falls back to device time, which the server later treats as untrusted evidence.

### 6.3 Offline Classroom Flow

A teacher with a cached session and stored signing key can sign and display a QR token offline. The client uses the stored server-clock offset when available, caches the activation locally, and queues it for the server. A student with the matching cached session can verify the signature, window, evidence quality, and geofence locally, store the provisional attendance record, and enqueue the scan.

Offline operations currently include attendance scans, legacy scan checks, session activation, and session end. Queue entries are processed in creation order in batches of up to 100. Exact client-attempt IDs prevent duplicate attendance queue entries.

### 6.4 Synchronization and Conflict Handling

Synchronization is opportunistic and app-driven when connectivity is available; the repository does not claim an operating-system-guaranteed background sync service.

The mobile client keeps an item queued until it receives an authoritative result. The backend submits attendance-sync work through a durable BullMQ queue when Redis is configured, waits for the per-record result, and then acknowledges the client. Development may run the same logic inline if Redis is not configured; Redis and BullMQ are required by the production readiness checks.

The server replays the full validation pipeline. Exact retries return the existing result. Reuse of a client attempt ID with different evidence is disputed. The unique session/student attendance constraint prevents duplicate canonical records. A valid offline check-in received after the QR/grace window or after session end is retained as `disputed` for teacher review rather than trusted automatically.

### 6.5 Time Handling

The signed `issuedAt` protects the token timestamp from alteration, but time validation still requires a trustworthy comparison clock. Mobile clients use the last measured server-clock offset when available; the current submission flow can fall back to device time when no offset exists. The server therefore treats client time as evidence rather than authority and uses its receive time, the signed token, and bounded clock-skew rules for the final decision. This replaces the older claim that a signed timestamp alone makes the device clock irrelevant.

---

## 7. Anti-Cheat and Security Controls

The implemented v1 controls are layered rather than dependent on one signal:

| Risk | Current control |
|---|---|
| Shared or replayed QR | Short signed validity, separate grace period, session/token identity checks, geofence, enrollment check, one canonical record per session/student |
| Credential sharing | Better Auth single-active-session generation; a new login replaces older sessions |
| QR tampering | Ed25519 signature verified against the teacher's current server-side public key |
| Device-clock manipulation | Pre-synced server-clock offset locally; authoritative server timing and bounded skew on sync |
| GPS spoofing and tampered clients | Mock-location signal rejection when explicitly reported, root/hook/emulator heuristics, freshness/accuracy checks, geofence distance, uncertainty and suspicious-coordinate review |
| Request replay | Stable client attempt IDs, exact replay acknowledgement, conflicting replay detection, idempotency support |
| Scan flooding | Redis-backed per-user API limits and stricter per-student/per-session scan limits |
| Unauthorized access | Better Auth session resolution, role guards, ownership checks, department/institution scope checks, privacy-consent guard |
| Stale active-session cache | PostgreSQL overwrites Redis metadata during every scan validation |

Additional backend hardening includes Helmet headers, restricted CORS, strict request validation, password policy enforcement, key-provision/revocation limits, structured exception handling, request auditing, and graceful shutdown.

Installation IDs and all device-integrity booleans are evidence, not hardware-backed proof; a modified client can omit or falsify client-reported signals. Hardware-backed device binding and OS attestation (Android Play Integrity or Apple App Attest/DeviceCheck) remain future controls for authoritative device-integrity decisions.

---

## 8. Technical Architecture

### 8.1 Monorepo

Polycheck uses pnpm workspaces and Turborepo:

| Package | Responsibility |
|---|---|
| `shared/` | Domain contracts, Zod schemas, Ed25519 token utilities, Haversine/geofence logic, map and calendar utilities |
| `frontend/` | Next.js 16, React 19, Tailwind CSS 4, shadcn/Radix-based web experience |
| `android/` | Expo SDK 57, React Native 0.86, Expo Router, NativeWind mobile experience |
| `backend/` | NestJS 11 REST/Socket.IO API, Better Auth, Prisma 7, PostgreSQL, Redis, BullMQ |

### 8.2 Backend Modules

The backend is organized into authentication, users, subjects, sections/enrollments, sessions, attendance, disputes, section roles, session permissions, proofs, dashboard/search/reporting, sync, realtime, settings, health, observability, infrastructure, Prisma, and scheduled maintenance modules.

REST endpoints use the `/api` prefix. Swagger/OpenAPI can be enabled explicitly and is disabled by default in production. Web authentication uses the Better Auth HttpOnly session cookie. Mobile login returns a bearer session token stored with Expo SecureStore.

### 8.3 Data Stores

- **PostgreSQL:** authoritative users, authentication, subjects, sections, schedules, enrollments, sessions, scan attempts, attendance, roles, permissions, proofs, settings, and audit records.
- **Prisma:** schema, generated client, migrations, transactions, constraints, and seed data.
- **SQLite on Expo:** encrypted, per-account cache and offline operation queue.
- **Redis:** Socket.IO coordination, active-session cache, rate limits, distributed locks, idempotency state, and BullMQ transport.
- **S3-compatible storage in production:** proof-of-class objects. Local filesystem storage is development-only.

The primary persistent models are `User`, Better Auth account/session/verification models, `InstitutionSetting`, `Subject`, `Section`, `ScheduleDay`, `Enrollment`, `Session`, `ScanAttempt`, `AttendanceRecord`, `SectionRole`, `SessionPermission`, `ProofOfClass`, and `AuditLog`.

### 8.4 Realtime and Resilience

Socket.IO publishes attendance and session changes to connected teacher dashboards. The Redis adapter supports multiple backend instances. Clients also refresh active-session data periodically so the UI can recover from a missed socket event.

Redis is a performance and coordination layer, not the academic source of truth. Security-sensitive validation falls back to or rechecks PostgreSQL. In production, unavailable distributed state fails readiness or rejects operations that cannot safely use a process-local fallback.

---

## 9. Web and Mobile Experiences

### 9.1 Web

The web application provides:

- separate student and faculty sign-in flows;
- student dashboard, enrollment, camera QR scanning, schedule, subjects, sessions, ID, attendance audit, and disputes;
- teacher dashboard, subjects, sections, rosters, student details, sessions, QR activation, proof review, attendance, disputes, calendar, search, and reports;
- Super Admin dashboard, read-only classroom directories/monitoring, users, reports, search, and settings.

### 9.2 Mobile

The Expo app provides role-specific tab layouts. Students receive Home, Schedule, Scan, and Audit flows plus enrollment, class details, officer session creation, proof upload, and digital ID. Faculty receive dashboard, subjects/sections, sessions, attendance, schedule, disputes, reports, search, user/settings access where authorized, and a session cockpit.

Android end-to-end journeys are automated with Maestro. iOS identifiers and permissions are configured and EAS can build both platforms, but App Store/TestFlight ownership, review, signing governance, and release validation remain deployment-dependent.

---

## 10. Design System

The visual foundation uses PUP maroon `#7B1113`, deep maroon `#4A0A0B`, golden yellow `#FFDF00`, white `#FFFFFF`, and near-black `#0A0A0A`. Lora is used for academic/display headings and DM Sans for body copy and controls.

The web uses Tailwind and shadcn/Radix primitives. Mobile uses NativeWind with reusable Polycheck `Campus*` components. Both support light and dark themes, responsive navigation, accessible labels, and consistent PUP branding. The student scanner uses a full-screen camera treatment with a maroon frame and golden guide; the digital ID uses a physical-card-inspired layout.

The core brand remains maroon and gold, while operational visualizations may use limited semantic colors such as green, blue, gray, or red where the current interfaces need fast status recognition. Attendance labels always include text and are not communicated by color alone.

---

## 11. Privacy, Audit, and Retention

Students must accept the configured privacy-notice version before location-bearing attendance or offline-sync endpoints are available. A notice-version change requires renewed consent. The system records the accepted version and time.

Attendance evidence can include account, session, timestamp, coordinates, accuracy, mock-location and device-integrity signals, installation ID, input channel, validation result, and risk signals. Mobile cached payloads are encrypted and separated by account. Students see their own records; teachers see their classes; Super Admins see read-only data within their scope.

Authenticated mutating API requests create audit records with actor, role, action, entity context, outcome, and timestamps. Current defaults retain unlinked denied scan attempts for 90 days and audit logs for seven years, subject to an institution-approved records schedule. Attendance-record retention and object-storage lifecycle require institutional policy; the application defaults are not a substitute for legal or PUP Data Protection Office approval.

Sentry integration exists for web and mobile error reporting, with event sanitization on web. Production transport must use HTTPS. Production proof storage must use S3-compatible storage.

---

## 12. Deployment, Operations, and Recovery

The repository includes:

- local Docker Compose for PostgreSQL, Redis, migrations, backend, frontend, and seed data;
- a production Compose topology with nginx, PgBouncer, PostgreSQL, Redis, backend, frontend, migrations, Prometheus, optional Alertmanager, backup, and recovery tools;
- health, readiness, and authenticated Prometheus metrics endpoints;
- immutable digest-pinned backend/frontend release images, SBOM/provenance generation, and container vulnerability scanning;
- logical backups, periodic physical base backups, WAL archiving, point-in-time-recovery verification, and isolated restore drills;
- reference RPO/RTO targets of five minutes and four hours;
- a k6 attendance-bell load profile for up to 1,000 pre-authenticated students.

These are implemented operational assets, but a live production service is deployment-dependent. PUP must supply domains, TLS, secrets, S3 storage, protected backup/WAL storage, alert delivery, off-host disaster-recovery storage if required, institutional app-store accounts, approved privacy text, and an operator-run release process.

---

## 13. Quality and Release Controls

Continuous integration currently checks dependency vulnerabilities, formatting, linting, Prisma migrations, shared tests, backend unit/integration/e2e tests and coverage, frontend tests/build/coverage, mobile tests/coverage, Playwright web journeys, Maestro Android journeys, Android release alignment, production Compose/recovery scripts, nginx/Prometheus/Alertmanager configuration, k6 script validity, Docker builds, and Trivy image scans.

A successful CI run on `main` can publish immutable GHCR images with provenance attestations and a digest-pinned deployment manifest. A separate staging smoke workflow validates public readiness, the privacy notice, frontend rendering, redirects, and required security headers.

Passing repository checks does not by itself certify production capacity, legal compliance, device compatibility, accessibility conformance, or institutional acceptance. Those require environment-specific validation and approval.

---

## 14. v1 Boundaries and Future Scope

The following are not implemented as v1 guarantees:

- hardware-backed account-to-device binding;
- Android Play Integrity or Apple App Attest/DeviceCheck enforcement;
- integration with the PUP Student Information System;
- automated excuse, leave, or medical-document workflows;
- push-notification infrastructure for schedule reminders;
- guaranteed OS background synchronization when the mobile app is closed;
- automatic off-host backup replication or multi-region disaster recovery;
- automatic fraud decisions based solely on anomaly scoring.

Future anti-cheat improvements should preserve an accessible teacher-assisted attendance path for students who replace, borrow, share, or do not own a compatible phone.

---

## 15. Source-of-Truth References

When this document and code differ, use these repository sources to reconcile the plan:

- `shared/src/types/` and `shared/src/validation/` for public domain contracts;
- `backend/prisma/schema.prisma` for persistent data models and constraints;
- `backend/src/app.module.ts` and module controllers/services for server behavior and authorization;
- `android/services/offline-store.ts` and `android/services/api-client.ts` for mobile offline behavior;
- `frontend/src/app/` and `android/app/` for current user-facing routes;
- `documentation/PRODUCTION_DEPLOYMENT.md` for deployment and recovery procedures;
- `.github/workflows/` for automated quality and release gates.

---

*Originally prepared from project discussions in June 2026; fully reconciled with the repository on August 14, 2026.*
