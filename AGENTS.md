# Polycheck — Unified Development Guide

## Project Overview

Polycheck is a unified web and mobile attendance management system for the Polytechnic University of the Philippines (PUP). It digitizes attendance through QR code scanning and geolocation verification. It is built as an offline-first system, working fully without internet and syncing to the cloud when connectivity is available.

**System name:** Polycheck
**Roles:** Super Admin, Admin (Teacher/Instructor), Student

## Directory Structure

```
polycheck/
├── AGENTS.md               # This file — project knowledge base
├── package.json            # pnpm workspace root
├── pnpm-workspace.yaml     # workspace member definitions
├── turbo.json              # Turborepo pipeline config
├── shared/                 # Shared TypeScript package
│   ├── package.json
│   └── src/
│       ├── types/          # Domain type definitions
│       ├── validation/     # Zod validation schemas
│       └── utils/          # Utility functions (Haversine, token helpers)
├── frontend/               # Next.js web dashboard
│   ├── package.json
│   └── src/
│       ├── app/            # Next.js App Router pages
│       ├── components/     # React components
│       └── lib/            # API client, hooks
├── android/                # Expo React Native mobile app
│   ├── package.json
│   └── src/
│       ├── app/            # Expo Router screens
│       ├── components/     # React Native components
│       └── services/       # API client, local DB, sync engine
├── backend/                # NestJS API (30+ modules, Prisma, Swagger)
│   ├── src/
│   │   ├── main.ts         # Bootstrap, Swagger, CORS, health checks
│   │   ├── app.module.ts   # Root module
│   │   ├── auth/           # Better Auth strategies, JWT guards
│   │   ├── attendance/     # Check-in logic, validation, geofencing
│   │   ├── sessions/       # QR generation, activation, permissions
│   │   ├── sections/       # CRUD, enrollment, student management
│   │   ├── subjects/       # Course-level CRUD
│   │   ├── disputes/       # Dispute review and resolution
│   │   ├── dashboard/      # Aggregated stats for teachers & students
│   │   ├── sync/           # Offline sync engine
│   │   ├── prisma/         # Schema, migrations, seed data
│   │   ├── realtime/       # WebSocket gateway, Redis adapter
│   │   ├── proofs/         # Proof-of-class photo uploads
│   │   ├── settings/       # Institution-level configuration
│   │   ├── users/          # User management, roles
│   │   ├── section-roles/  # Per-section role assignments
│   │   ├── session-permissions/ # Per-session access control
│   │   ├── health/         # Readiness/liveness probes
│   │   ├── observability/  # Logging, metrics, tracing
│   │   └── common/         # Config, env validation, shared providers
│   ├── prisma/             # Schema & seed scripts
│   └── dist/               # Compiled output
└── documentation/
    └── PUP_Attendance_System_Plan.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| Web dashboard | Next.js 15 (App Router), shadcn/ui, Tailwind CSS |
| Mobile app | Expo SDK 52+, Expo Router, NativeWind, react-native-reusables |
| Backend API | NestJS (Node.js) |
| Database | PostgreSQL (via Prisma ORM) |
| Local database | SQLite via expo-sqlite |
| Real-time Updates | WebSockets (Socket.IO) |
| Caching & Queues | Redis (WebSocket Adapter, Cache Store, BullMQ) |
| Authentication | Better Auth (HttpOnly web cookie + signed mobile bearer) |
| Monorepo | pnpm workspaces + Turborepo |
| Shared code | `@polycheck/shared` package |

## User Roles

### Super Admin
Department heads, program chairs, PUP officials. Highest access — sees data across all teachers and subjects. Manages teacher accounts, configures institution settings, generates reports. Does not manage day-to-day attendance.

Super Admin capabilities are limited to scoped oversight, reports/exports, global lookup, audit, user account administration (including teacher/student creation, role changes, super-admin provisioning, status changes, and password resets), and institution settings. Super Admins have read-only access to classroom resources, reachable only through explicit lookup (Global Search or a direct deep link) — never through dashboard feeds or proactive navigation. They must not create/update/delete subjects, sections, sessions, attendance, disputes, enrollment codes/rosters, section roles, QR tokens, or proof-of-class records.

### Teacher / Instructor
Creates subjects, configures class schedules, generates QR codes per session, sets geofences, defines check-in time windows. Views attendance records for their classes. Flags anomalies.

### Student
Primary interface is the mobile app, with a web dashboard for schedule and subject views. Has a digital student ID. Views class schedules. Checks in by scanning teacher's QR code. Views own attendance history. Can submit disputes and enroll via enrollment code. Student officers (President, QAC) can create sessions and upload proof of class.

## Core Features (v1)

### QR Code Attendance
- QR codes are cryptographically signed tokens, not static images
- Unique per session, expires in 2–5 minutes (teacher-configured)
- Signed locally on teacher's device using provisioned private key pair
- Server retains public key, verifies on sync
- Token carries signed `issuedAt` — device clock is irrelevant to expiry

### Geolocation Attendance Gating
- Teacher configures a circular geofence (GPS coords + 30–50m radius)
- Geofence cached on student's device during pre-session sync
- Haversine distance calculated locally on student's device at scan time
- Rejected immediately if outside geofence
- Server re-validates coordinates on sync

### Digital Student ID
- Full name, student number, program, year level, profile photo
- Bound to verified account and device installation
- Cannot be transferred or screenshotted for proxy use

### Subject and Schedule Management
- Teachers create subjects with name, section, room, schedule (days/time), semester
- Enrollment via teacher-manual or per-subject enrollment code
- Codes: 6–8 alphanumeric chars, teacher-set expiry (typically first 2 weeks), can be regenerated if leaked

### Attendance Records and Reporting
- Every check-in logged with: timestamp, GPS, device ID, outcome
- Categorized as: Present, Late (past grace period), Absent
- Teachers see per-session and per-student summaries
- Super Admins see department-wide / institution-wide reports
- Filters: subject, teacher, date range, student
- Exportable records

### Section Roles (President / QAC)
- Teachers assign student officers per section: President and QAC (Quality Assurance Coordinator)
- Presidents can create sessions and set geofences
- QAC members can upload proof of class photos during sessions
- Session permissions can be granted/revoked with 24-hour expiry

### Proof of Class
- QAC members and authorized students can upload classroom photos during a session
- Photos timestamped and associated with the session for audit
- Teachers can delete proof-of-class submissions
- Serves as verification that a class meeting actually occurred

## Anti-Cheat System (v1)

| Cheat Scenario | v1 Solution | v2 Solution |
|---|---|---|
| Sending QR to absent friend | Short expiry + geolocation check + server re-validation | — |
| Logging into absent student's account | Single active session per student account (Better Auth, `auth.session-policy`); staff may keep concurrent devices | Optional device binding |
| GPS spoofing | Coordinate plausibility monitoring | SafetyNet / DeviceCheck attestation |
| Screenshot replay of QR | Signed `issuedAt` + server expiry check + reject-on-duplicate | — |

## Offline-First Architecture

### Key Principles
- Every critical in-class action works without internet
- Internet needed only for sync, not for operation
- Local SQLite DB is source of truth during class

### Session Configuration vs Activation
- **Session configuration** (create subject, set geofence, schedule): Requires internet. One-time per subject per semester.
- **Session activation** (generate QR code for class meeting): Works offline. Uses pre-configured cached data.

### Pre-Session Sync
- Students must open Polycheck while connected at least once before class day
- Syncs geofence configs and subject data to local device
- Without pre-sync, student cannot scan (acceptable constraint)

### Sync Conflict Resolution
- Reject-on-duplicate: first arrival for token+student pair wins
- Duplicates flagged for teacher review
- Non-conflicting records from different students insert normally regardless of arrival order

### Clock Drift Prevention
- `issuedAt` timestamp signed into token payload
- Local expiry check reads signed timestamp, not device clock
- Server uses its own clock for authoritative expiry check on sync

### Server-Side Re-Validation
Every synced record checked for:
1. Token signature validity (via teacher's public key)
2. Timestamp within session window
3. GPS coordinates within geofence
4. No duplicate token+student pair
Any failure → marked as `disputed`, surfaced to teacher

### Real-Time Updates & Caching
For real-time updates and low-latency validation during peak attendance check-in windows, the system utilizes WebSockets (via Socket.IO) and Redis:
* **WebSockets**: Established between the NestJS backend and the teacher's dashboard (web/mobile). As students sync their locally generated attendance records to the backend, the backend pushes these successful check-ins instantly to the active session view.
* **Redis**: Acts as an in-memory data store and event broker:
  * *WebSocket Adapter*: Enables horizontal scaling of WebSocket connections. If multiple server instances are running behind a load balancer, Redis Pub/Sub coordinates and broadcasts WebSocket events across Server instances.
  * *Active Session Caching*: Active geofence coordinates and QR token metadata are cached in Redis with a TTL matching the session's duration. The backend validates coordinates against the cache in microseconds without hitting the PostgreSQL database.
  * *Rate Limiting*: Limits scan submission attempts per student/device ID using a Redis-backed rate limiter to prevent geofence-spoofing brute-force attacks.
  * *Job Queues (BullMQ)*: Manages batch processing of offline sync payloads asynchronously, ensuring the main HTTP server thread remains unblocked.

## Design System

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| Maroon (Primary) | `#7B1113` | Buttons, nav bars, headers, active states |
| Deep Maroon (Dark) | `#4A0A0B` | Hover/pressed states, sidebar, dark mode surfaces |
| Golden Yellow (Accent) | `#FFDF00` | Highlights, badges, CTA emphasis, icons |
| White (Light base) | `#FFFFFF` | Background, cards, text (light mode) |
| Black (Dark base) | `#0A0A0A` | Background (dark mode) |

### Semantic Status Badges
- **Present**: Golden yellow bg + deep maroon text
- **Late**: Maroon bg + white text
- **Absent**: Deep maroon bg + golden yellow border
- **Pending**: White bg + maroon text
- **Disputed**: Deep maroon bg + golden yellow icon

### Typography
- Headings / app name: Lora (warm, rounder serif — readable, academic character)
- Body text / labels / forms / tables: DM Sans (clean sans-serif)
- Same fonts via Google Fonts on web and mobile

### Components
- Web: shadcn/ui configured with PUP color tokens
- Mobile: react-native-reusables (shadcn port) with same tokens via NativeWind
- Consistent visual language across both platforms

### Dark Mode
- Base: `#0A0A0A` black
- Surfaces/cards: Deep maroon `#4A0A0B`
- Accent: Golden yellow (same as light mode)
- Text: White
- Interactive elements: Maroon

### Mobile-Specific
- NativeWind for Tailwind-compatible classes on React Native
- QR scanner: full-screen camera + maroon overlay frame + gold alignment guide
- Digital ID card: physical ID card style with PUP maroon header

## Data & Privacy

- Full audit trail: who, which device, GPS, timestamp, outcome
- NestJS guards enforce role-based access (via Casl / custom RBAC):
  - Students: own records only
  - Teachers: their subjects only
  - Super Admins: all records in scope
- GPS stored for audit + anomaly detection (student consent at onboarding)
- Device fingerprints for session binding only

## v1 Exclusions (Future)
- Device binding via fingerprint
- OS-level attestation (SafetyNet / DeviceCheck)
- SIS integration
- Auto excuse / leave request workflows
- Push notifications for schedule reminders

## Development Conventions

### Package naming
- `@polycheck/shared` — shared types, validation, and utilities
- `@polycheck/frontend` — web dashboard
- `@polycheck/android` — mobile app

### NPM Scripts (root)
- `pnpm dev` — run all apps in dev mode
- `pnpm build` — build all packages
- `pnpm lint` — lint all packages

### Mobile styling
- **Use NativeWind classNames for all new mobile UI** (e.g. `className="flex-1 bg-white dark:bg-black"`)
- Use `StyleSheet.create()` only when NativeWind cannot express the style (dynamic values, complex transforms)
- Color tokens are defined in Tailwind config; reference them by name (`text-maroon`, `bg-golden`, etc.)
- Never mix `className` and `style` props on the same element
- Prefer `gap` over margin/padding for spacing between siblings

### Shared package imports
```typescript
import { User, Subject, Session } from '@polycheck/shared'
import { haversineDistance } from '@polycheck/shared/utils'
```

### API Client Pattern (both apps)
```typescript
// Web: NEXT_PUBLIC_API_URL=http://localhost:4000/api
// Mobile: EXPO_PUBLIC_API_URL must be reachable from the device.
// Both clients always call the NestJS API; offline mobile reads use SQLite cache.
```

### Git commit style
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Imperative mood, no period
- Max 72 chars subject line

### Feature Parity Gate (both platforms)
- **Shared contract first:** any new capability starts as types/schemas/validation in `@polycheck/shared` (and `ApiClient` methods) before either UI exists.
- **Every UI feature ships on web *and* mobile** — or the PR states a one-line justification ("super-admin-only", "native-only", "PWA follow-up") in the PR body. A web-only wizard is not complete until `BM6`-style mobile adoption lands.
- **Paired E2E:** role journeys get both a Playwright spec (web) and a Maestro flow (mobile). Shared journeys: login, schedule, section roster, session cockpit, scan, disputes, import.
- **Quarterly parity audit:** re-run the full capability matrix (web vs mobile vs PWA) and append results to `plan/mobile-improvement-plan.md`'s addendum.
- **Shared behavior changes require both clients:** when `ApiClient` or shared validation changes, update frontend + android consumers and their tests in the same change.

### Offline-first contract (web + mobile)
- Reads: network-first, fall back to the local cache (IndexedDB on web, SQLite on mobile).
- Writes: authoritative-first; on connectivity failure enqueue and show "saved on device" (never fake success).
- Sync: the existing backend contract (`/sync/attendance/batches` + receipt polling) is the only replay path; terminal evidence is retained for review and removed from optimistic views.
- Time: validity decisions read the signed `issuedAt` plus the cached `/health` clock offset, never the raw device clock.
- Web queue lives in `frontend/src/lib/offline/*`; SW caching is an app-shell optimization only and never touches credentials.

## Progress

### Done
- Replaced Expo default icon with PUP logo in relevant mobile files.
- Redesigned student and faculty tab bars as floating detached rounded bars with `useSafeAreaInsets`.
- Fixed sessions tab icon hiding on sub-screens via `display: none`.
- Added full-screen map mode, pin-drag (toggle `scrollEnabled` on parent ScrollView), and radius slider using `pageX` + `measureInWindow`.
- Created `CreateSubjectScreen` with form fields, schedule builder, auto-generated enrollment code.
- Added `createSubject` method to both mobile and web mock APIs.
- Made subject cards tappable on both mobile (`Pressable`) and web (`<Link>` wrapping the card).
- Created subject detail page `(faculty)/subjects/[id].tsx` (mobile) with student list, 10‑per‑page pagination, search, attendance stats overview (P/L/A badges + rate bar), enrollment code reset/disable.
- Created student detail page `(faculty)/student/[id].tsx` (mobile) with flippable PUP ID card (front: maroon header + logo, photo, student details; back: magnetic stripe, conditions, emergency contact, QR), remove-from-subject with confirm, attendance-per-session list with 5‑per‑page pagination and tap-to-cycle status.
- Created `/faculty/subjects/[id]` web page (subject detail: info card, enrollment code, stats, search, student list with pagination).
- Created `/faculty/students/[id]` web page (student detail: PUP ID card, remove from subject, attendance-per-session with 5‑per‑page pagination and cycle buttons).
- Mock student data contains 8 entries (s-001 to s-008) with 19 sessions and 55 attendance records.
- Added 10 mock API methods to both mobile and web: `getSubjectStudents`, `getStudent`, `getSubjectSessions`, `getStudentAttendanceForSubject`, `updateAttendanceStatus`, `addAttendanceRecord`, `removeStudentFromSubject`, `resetEnrollmentCode`, `disableEnrollmentCode`, `createSubject`.
- Fixed nested `<a>` hydration error on web subjects page (outer card changed from `<Link>` to `<div onClick={router.push(...)}>`, inner "View Sessions" changed from `<button onClick={router.push(...)}>` back to `<Link>` with `stopPropagation`).
- Fixed hooks-order violation in web `StudentDetailPage` (moved `useMemo` calls above early return).
- Added font weight utility classes to `global.css` (`--font-sans-medium`, `--font-sans-semibold`, `--font-sans-bold`).
- Registered `subjects/[id]` and `student/[id]` routes in faculty layout with `href: null` and tab bar hidden.
- Added full week (Mon–Sun) to `DayOfWeek` type, zod enum, and both create forms (previously Mon–Fri only).
- Added optional `room` field to `ScheduleDay` type, validation, mock subjects, both create forms, and all display pages (subject detail, subject list).
- Added optional `room` field to `Session` type, mock API `createSession`, both session create forms, and session list display.
- **Web**: Fixed `AttendanceOverview` duplicate "Absent" column bug (removed 6th duplicated column + updated colSpan).
- **Web**: Wired report filters (teacher dropdown + date range) — now recalculates summaries from filtered attendance records.
- **Web**: Made faculty student detail ID card flippable (tap to flip; back face shows magnetic stripe, conditions of use, emergency contact lines, QR code placeholder).
- **Web**: Created read-only student subject detail page at `/student/subjects/[id]`.
- **Web**: Made student subject cards in "My Subjects" tab tappable — wraps each in `<Link>` navigating to the new detail page.
- **Android**: Added "View Sessions" button + copy enrollment code (via `expo-clipboard`) to faculty subject cards.
- **Android**: Created read-only student subject detail page at `(tabs)/subject-info/[id]` registered with `href: null`.
- **Android**: Made student dashboard cards tappable (both Today's Schedule and new "My Subjects" section) — navigates to `subject-info/[id]`.
- Installed `expo-clipboard` in mobile project.
- **Types**: Removed `tokenWindowSeconds` from `Session`, replaced with `qrValidityMinutes: number`. Added `qrGeneratedAt?: string`. Added `'disputed'` to `AttendanceStatus`. Added `manuallySet?: boolean` to `AttendanceRecord`. Added `disputed: number` to `AttendanceSummary`. Updated `QRTokenPayload`: `windowDurationSeconds` → `validityMinutes`, added `gracePeriodMinutes`.
- **Validation**: `SessionCreateSchema` — removed `tokenWindowSeconds`, added `qrValidityMinutes` (min 1, current max 15), added optional `endTime`, `room`, and a grace period capped at 60 minutes.
- **Token utils**: `isTokenExpired` replaced with `isTokenInValidityWindow(payload)` returning `{ valid, inGrace }`. `createQRTokenData` now takes `validityMinutes` + `gracePeriodMinutes`.
- **Mock data**: Updated all 14 sessions to use `qrValidityMinutes`. Added 3 attendance records (2 disputed + 1 manuallySet). Updated all summaries with `disputed: number`.
- **Mock APIs (both)**: Added `generateQrCode(sessionId, validityMinutes)`, `submitScan(...)`, `endSession(sessionId)`, `getDisputedRecords(sessionId?)`, `resolveDispute(recordId, resolution, newStatus?)`. Updated `checkAttendance` with timeline logic (QR validity → Present, grace period → Late, expired → Absent). Updated `createSession` to accept `qrValidityMinutes`.
- **Dependencies**: Installed `react-native-qrcode-svg`, `expo-sharing`, `react-native-svg` (mobile). Installed `qrcode`, `@types/qrcode` (web).
- **Mobile session activation** (`sessions/[id].tsx`): Full overhaul — real QR rendering via `react-native-qrcode-svg`, QR validity prompt modal (teacher enters minutes), countdown timer, student roster with all enrolled students, summary stats (P/L/A counts), filter tabs, tap-to-cycle status per student, manual-set indicator icon, full-screen QR modal, share button (copies token to clipboard), End Session button with confirmation, refresh button.
- **Mobile student scan** (`scan.tsx`): Wired `CameraView` with `onBarcodeScanned` for real QR scanning, decodes token payload via `decodeTokenPayload`, gets GPS via `expo-location`, calls `submitScan` with Present/Late based on QR window, manual code entry fallback, gold corner frame overlay retained.
- **Mobile disputed records page** (`(faculty)/disputes.tsx`): Lists all disputed records grouped by session, shows dispute reason with icon, tap to open review modal with Accept (→Present), Reject (→Absent), Override to any status.
- **Mobile faculty layout** (`_layout.tsx`): Added disputes tab with `gavel` icon.
- **Mobile faculty dashboard** (`dashboard.tsx`): Fixed subject cards → navigate to `subjects/[id]` (was incorrectly navigating to sessions).
- **Mobile create session** (`create.tsx`): `qrValidity` replaces `tokenWindow` in form; `VALIDITY_OPTIONS` (5..60 min) replaces `TOKEN_OPTIONS`.
- **Web session activation** (new `faculty/sessions/[id]/page.tsx`): Same features as mobile — QR generation via `qrcode` library, student roster, manual override, End Session, full-screen QR modal, share/download.
- **Web disputed records** (new `faculty/disputes/page.tsx`): Same as mobile — dispute cards, review modal with Accept/Reject/Override.
- **Web sidebar** (`sidebar.tsx`): Added `Gavel` icon import and "Disputes" nav item to teacher navigation.
- **Web create session** (`sessions/create/page.tsx`): `qrValidity` replaces `tokenWindow` slider (displayed in minutes).
- **Web dashboard** (`faculty/page.tsx`): Disputes stat card now uses `api.getDisputedRecords().length` instead of hardcoded 0.
- **Bug fixes (type-check)**: Fixed missing `disputed` in status color maps (`StatusBadge.tsx`, web + mobile student detail pages). Replaced `activateSession()` calls with navigation to session detail pages in both sessions lists. Removed unused imports/variables in session activation page. Fixed broken `isTokenInValidityWindow` import in web mock-api.ts.
- **Subject→Section refactor**: Split `Subject` type into `Subject` (parent/course: id, name, code, description) and `Section` (child/class instance: id, subjectId, section, room, schedule, semester, teacherId, teacherName, enrollmentCode, enrollmentCodeExpiry, studentCount). Updated `Session.sectionId`, `AttendanceRecord.sectionId`, `AttendanceSummary.sectionId`, `Enrollment.sectionId`, `Student.enrolledSectionIds`. Updated validation schemas with `SubjectCreateSchema` and `SectionCreateSchema`. Restructured mock data: 4 parent subjects + 5 sections with updated enrollments, sessions, attendance. Rewrote both mock APIs: `getSubjects()` (no args) + CRUD for parent Subject, `getSections()` + CRUD for child Section. Renamed methods: `getSubjectStudents` → `getSectionStudents`, `getSubjectSessions` → `getSectionSessions`, `getStudentAttendanceForSubject` → `getStudentAttendanceForSection`, `removeStudentFromSubject` → `removeStudentFromSection`. A deterministic QR placeholder was used temporarily during this refactor; scanner-compatible QR libraries were restored later. Fixed all 25 UI files across mobile and web for the new data model.
- **Navigation hierarchy**: Fixed route structure to match the Subject→Section data model. `/faculty/subjects` now lists parent Subjects (courses) instead of Sections. `/faculty/subjects/[id]` shows a Subject's sections in a grid. New `/faculty/sections/[id]` route created for section detail (students, enrollment code, attendance). Updated all navigation links across faculty dashboard, subject/section pages, and student detail pages on both platforms. Mobile: same restructure with new `(faculty)/sections/[id]` route registered in tab layout.
- **Create Subject simplified**: Removed section-level fields (section, room, schedule, semester, geofence) from both web and mobile create subject forms. Now only creates parent Subject (name, code, optional description). Calls `api.createSubject()` only — no more `api.createSection()` in the same form.
- **Create Section (new)**: Created new `/faculty/sections/create` (web) and `(faculty)/sections/create` (mobile) forms. Accepts section, room, schedule, semester — no geofence. Calls `api.createSection()` only. Accessible via "Add Section" button on Subject detail page.
- **Validation**: Removed `latitude`, `longitude`, `geofenceRadiusMeters` from `SectionCreateSchema`. Geofence stays exclusively on `Session` type and `SessionCreateSchema`.
- **Mock APIs**: `createSection` already accepted no geofence params — no changes needed. `createSubject` already accepted name/code/description — no changes needed.

### Done (cont.)
- **API client interface** (`shared/src/types/api.ts`): Defined complete `ApiClient` interface with 30+ methods covering auth, subjects, sections, sessions, attendance, disputes, enrollment, calendar, export, and bulk operations. Added `CalendarEvent`, `BulkSessionInput`, `DisputeInput`, `EnrollStudentInput` types.
- **Mock API methods (both)**: Added `enrollStudent`, `getCalendarEvents`, `createBulkSessions`, `exportAttendanceCsv`, `submitDispute`. Fixed `getSections()` signature to accept optional `sectionId`.
- **Web calendar view** (`frontend/src/app/faculty/schedule/page.tsx`): Full Month/Week toggle calendar with Prev/Next/Today navigation. Month view: 7-column date grid with event dots and popover details. Week view: time-slot columns with positioned event blocks. Color-coded: blue=scheduled, green=active, gray=completed. Legend at bottom.
- **Student web schedule** (`frontend/src/app/student/schedule/page.tsx`): Weekly timetable based on enrolled sections, current day highlighted, class cards with subject/room/time/instructor.
- **Mobile faculty schedule** (`android/app/(faculty)/schedule.tsx`): Month grid with event dots, week columns, tap-to-view event detail modal with View Session navigation. Added as tab in faculty layout.
- **Mobile student schedule** (`android/app/(tabs)/schedule.tsx`): Weekly class schedule from enrolled sections, detail modal. Added as tab in student tab layout between Dashboard and Scan.
- **Calendar utility** (`shared/src/utils/calendar.ts`): `getWeekDays`, `getMonthDays`, `formatDate`, `formatTime`, `getDayName`, `getMonthName`, `isSameDay`, `generateCalendarEvents`, `getDateRangeForMonth`, `getWeeksInMonth`.
- **Student self-enrollment** (both): New `/student/enroll` page (web) and `enroll.tsx` screen (mobile) — enter enrollment code, validates against section data, calls `api.enrollStudent()`. Added "Enroll in Subject" button on both student dashboards.
- **Teacher manual enrollment** (both): Added collapsible "Enroll Student" section to section detail pages (both platforms). Search input filters all students by name/ID, tap-to-enroll with instant feedback, auto-refreshes student roster.
- **Student dispute submission** (both): Web — added "Report Issue" button to attendance records with full dispute modal (reason dropdown, description textarea). Mobile — made records tappable with dispute detail modal and reason picker. Calls `api.submitDispute()`.
- **Attendance CSV export** (both): Web Export button on Reports and Attendance pages now generates downloadable CSV file. Mobile copies CSV to clipboard via expo-clipboard with confirmation Alert.
- **Charts/analytics** (both): Web Reports page — SVG donut chart (Present/Late/Absent colored arcs) and attendance rate bar. Mobile Reports — View-based segmented donut chart and rate bar.
- **Loading states & error handling** (web): Created `frontend/src/lib/hooks/use-api.tsx` with `useApi` hook, `LoadingSpinner`, `ErrorDisplay` components. Applied loading states to faculty dashboard, section detail, and session activation pages.
- **Real-time polling**: Added 10s auto-refresh interval to session activation pages (both platforms) when session is active. Shows "Updated Xs ago" label with live countdown timer.
- **In-app notifications** (web): Created `NotificationProvider` context with auto-dismiss toasts (success/error/info/warning) at top-right. Wrapped root layout. Added notifications for QR generation, session end, manual overrides, dispute resolution.
- **Bulk session creation** (both): Added "Create recurring sessions" toggle to session create forms. Shows start/end date, day-of-week checkboxes (pre-selected from section schedule), session count calculation. Calls `api.createBulkSessions()`.
- **Fixed disputed badge** (both): Web student dashboard — added 4th "Disputed" stat card. Mobile history — added 'disputed' to filter tabs, badge config map (deep maroon bg + golden text/border), and stats row.
- **Fixed `enrolledSubjectIds` → `enrolledSectionIds`** in mock student data (`shared/src/mock/users.ts`).
- **Added 5 future sessions** (sess-015 to sess-019, July 8-20) for calendar view demo data.

### Done (cont.)
- **Login pages** (web): Created `/login`, `/login/faculty`, `/login/student` role selection pages with maroon branding and role cards. Created `/student` redirect page that routes to student dashboard.
- **Calendar events enhancement**: Added `CalendarEvent` with `sectionId`, `location`, `type` fields to shared types. Updated both mock APIs and calendar pages on both platforms to include room/location.
- **Map exports fix**: Changed shared package `map/index.ts` exports from `export { ... }` (type-only) to `export { ... } from ...` (re-exports) to fix `ERR_PACKAGE_PATH_NOT_EXPORTED` build errors.
- **Web ID card flippable**: Made faculty student detail PUP ID card tap-to-flip on web (back face shows magnetic stripe, conditions of use, emergency contact, QR placeholder).
- **Web Create Session page**: Created `/faculty/sessions/create/page.tsx` — form with qrValidity slider, section selector, geofence map. Wired to `api.createSession()`.
- **Geofence module**: Created full-screen map mode, pin-drag (toggles `scrollEnabled` on parent ScrollView via measure), radius slider using `pageX` + `measureInWindow`. Geofence is included in `CreateSessionInput` and `BulkSessionInput`. Fixed `tsconfig.json` baseUrl/paths for module resolution.
- **ScheduleDay.room on Session**: Extended `Session` type with optional `room` field. Updated validation, mock data, mock API `createSession`, and all display pages (session list, session detail) on both platforms to show session room.
- **Backend Prisma schema section**: Added backend Prisma schema with User, Subject, Section, Session, AttendanceRecord, Enrollment, Dispute, ProofOfClass, CalendarEvent models and documentation to AGENTS.md.
- **Backend plan**: Created `/documentation/BACKEND_PLAN.md` as a scaffold for NestJS backend implementation planning.
- **Build fixes**: Fixed `ScheduleMap.tsx` naming (was `ScheduleMap.ts`), missing `EditGeofenceScreen` export in mobile `index.ts`, and `disputeReason` type cast in web student dashboard.
- **Section Roles & Proof of Class docs**: Added documentation for student officer roles (President, QAC) and proof of class feature to AGENTS.md Core Features. Updated PUP_Attendance_System_Plan.md: `admin`→`teacher` role rename, student web portal description, student officer capabilities.

### Done (cont.)
- **Data audit & cleanup**: Fixed `enrolledSectionIds` from subject IDs (`subj-*`) to correct section IDs (`sec-*`) for all 8 mock students. Removed 5 phantom enrollment records referencing non-existent students (s-009 to s-013). Fixed section role names to match actual student names. Stale attendance summaries corrected (sec-001: 6→9, sec-003: 3→1, sec-004: 6→8, sec-005: 2→1).
- **Mock API parity**: Added missing methods to both web and mobile mocks: `submitScan`, `getMyAttendance`, `getStudentsForSection`, `getEnrollments`, `submitAttendance`, `getAttendanceForStudent`. Renamed `getStudentSubjects`→`getMySubjects` in web mock.
- **Return type consistency**: Fixed `submitAttendance`/`checkAttendance` return types to include both `reason` and `message` fields on both platforms.
- **Validation cleanup**: Removed orphaned `tokenPayload` field from `AttendanceRecordSchema` (had no corresponding type definition).
- **Route param cleanup**: Normalized `sectionId` query parameter (was mixed `subjectId`/`sectionId`) in student detail pages on both platforms.
- **Docs cleanup**: Removed false claim about `addGeofence`/`editGeofence` methods from AGENTS.md (geofence is configured via `CreateSessionInput`/`BulkSessionInput`). Updated mock data counts.
- **ApiClient interface**: Added `search()` method that was mock-only. Validation schemas brought in sync with input types (`SessionCreateSchema` gains `geofence`, `subjectName`, `teacherId`, `isRescheduled`; `SectionCreateSchema` gains `teacherId`, `teacherName`; `endTime` no longer optional; `GeofenceConfigSchema` is now used by `SessionCreateSchema`).
- **Return type consistency**: Fixed web mock `submitAttendance` to include `message` field. Both mocks' `submitDispute` now writes `disputeDescription` instead of `notes`.
- **Import cleanup**: Removed unused `isTokenInValidityWindow` and `decodeTokenPayload` from mobile mock imports. Added missing `DisputeReason`, `SubmitAttendanceResult` type imports to both mocks.
- **Lint errors cleared**: Fixed unescaped quotes/apostrophes in frontend pages (faculty dashboard, session create, session detail, student dashboard, student session detail). Fixed `checkAttendance` return type in web mock to `SubmitAttendanceResult`. Made `loginStudent`/`loginFaculty` password param optional in both mocks (matches interface).
- **Real API cutover**: Removed the shared runtime mock dataset and `@polycheck/shared/mock` package export. Renamed both application clients to `api-client.ts`; web and mobile now always call NestJS, with SQLite retained only as the mobile offline cache.
- **Login routing**: Consolidated `/login/student` and `/login/faculty` under the root login route tree to eliminate Next.js development 404s. Both routes use the real NestJS authentication endpoints.
- **Deployment API configuration**: Added documented web/mobile API environment variables. Android derives the Expo development host and uses `10.0.2.2` for an emulator fallback; non-development builds require `EXPO_PUBLIC_API_URL`.

### Done (cont.)
- **QR flow redesign**: Made `qrValidityMinutes` and `gracePeriodMinutes` optional in `CreateSessionInput`/`BulkSessionInput` shared types. Removed QR validity and grace period sliders from all create-session forms (web faculty, web student, mobile faculty, mobile student). Backend applies defaults (20/15) when omitted. `ActivateSessionDto` accepts optional `gracePeriodMinutes`; both online activate and offline `ensureOfflineActivation` store generation-time grace on the session record.
- **Default campus coordinates**: Changed all default geofence coordinates from PUP Sta. Mesa (14.5863, 120.9777) to PUP Santa Maria, Bulacan (14.8697, 120.9991) across web MapPicker, mobile create screens, and mobile subject-info create-session.
- **Use My Location button**: Added "Use My Location" button to web MapPicker (`navigator.geolocation`) and mobile faculty create session screen (`expo-location`).
- **MapView recenterSignal**: Added `recenterSignal` prop to mobile `MapView` component — programmatically pans the map viewport on location acquisition. Two effects: one updates marker on lat/lng/radius change, the other recenters viewport on signal.
- **Faculty student ID flip card**: Rewrote the faculty student detail flip card on web to use the same CSS 3D flip animation (`perspective-[2000px]`, `[transform-style:preserve-3d]`, `[backface-visibility:hidden]`) as the student dashboard, replacing the previous implementation.
- **Auto-expiry cron**: Backend `@Cron(CronExpression.EVERY_MINUTE)` marks stale pending attendance records as absent and ends expired sessions automatically.
- **Web student QR scan**: Built `ScanQrModal` component (camera via `@zxing/browser` + image upload + manual code entry) wired to student dashboard for QR-based attendance check-in with geolocation validation.
- **Map camera stability**: Removed recurring web `fitBounds`/controlled viewport resets, stopped mobile WebView map reloads on overlay changes, and made explicit location recentering preserve the user's current zoom.
- **Web/mobile session parity**: Mobile student officers now configure the same geofence and current-location flow as web; offline QR activation uses cached sessions; mobile scanning requests location permission and handles network errors; web fallback polling refreshes full session state.
- **Mobile QR image upload**: Student scanning now supports selecting a QR image from the photo library, decoding it with Expo Camera, and passing the token through the same live-GPS and server validation flow as camera/manual scans.
- **Mobile scan UX and geofence diagnostics**: Rebuilt the scan screen as a stable camera viewport with compact fallback controls and modal manual entry. Mobile now requests best-navigation GPS, rejects low-accuracy fixes, and reports measured distance/radius plus emulator setup coordinates when outside the geofence.
- **Mobile hooks-order fix**: Moved session map pin memoization above the faculty session detail early return to eliminate the `Rendered more hooks than during the previous render` crash.
- **2026-07 audit remediation**: Enforced account-scoped, encrypted mobile offline storage and signing keys; fixed student session scoping and proof deletion authorization; capped QR timing at 15 minutes plus 60 minutes grace; made session creation concurrency-safe; hardened Swagger and frontend CSP access; aligned the shared API contract; fixed scanner teardown, campus dates, dashboard waterfalls, accessible dialogs, and large mobile lists; and added Android tests to CI.

### Done (cont.)
- **Codebase hygiene sweep (8 audit items)**:
  - **Dead code**: removed `@maplibre/maplibre-react-native` (android), `leaflet`/`react-leaflet`/`@types/leaflet` (frontend), deleted legacy `MapPickerInner.tsx`/`MapViewInner.tsx` and unused `shared/src/api/auth-client.ts`.
  - **Styling drift**: added `maroon-deep` (#2A0E11) and `maroon-ink` (#1F0B0E) tokens to `android/global.css` + `pupColors`; replaced all hard-coded dark-maroon hexes (bottom sheets consolidated to `surface-dark`).
  - **Super-admin scope centralized**: new `backend/src/common/admin-scope.ts` (adminScope/adminSectionWhere/adminSessionWhere/adminRecordWhere/adminEnrollmentWhere/adminSubjectWhere/adminUserWhere/adminCanAccessUser/adminCanAccessSection/adminSectionInScope/assertSectionInAdminScope/assertStudentInAdminScope/adminDepartmentSectionIds) replaces duplicated scope fragments across 12 files (attendance, dashboard, disputes, proofs, realtime gateway, section-roles, sections, session-permissions, sessions, subjects, users). Exact same where shapes / messages — zero behavior change.
  - **N+1 cockpit**: web session cockpit now uses `api.getSession(id)` + `api.getSection(session.sectionId)` instead of looping all sections.
  - **Client IDs**: manual attendance records use `crypto.randomUUID()` (web) / `Crypto.randomUUID()` from expo-crypto (mobile) instead of `a-manual-${Date.now()}` / `a-manual-${records.length}`.
  - **Security**: new `POST /auth/revoke-key` (rate-limited, nulls `teacherPublicKey`, emits `auth.key-revoked` audit event with key fingerprint); idempotency interceptor caps cached response bodies at 64 KB and stores a compact terminal marker for oversized responses so retries cannot repeat completed mutations; `SessionAuthenticator` now does a single Better Auth `getSession` round-trip (user `additionalFields` added to better-auth config) instead of a second Prisma query.
  - **Mobile auth gates**: new `android/hooks/use-auth-gate.ts` — 8 screens (disputes, reports, schedule, enroll, session detail, section detail, student create-session, student session detail) now use the shared hook instead of per-screen `router.replace` checks; root layout remains the group-level gate.
  - **ESLint**: re-enabled `react-hooks/rules-of-hooks`, `react-hooks/static-components`, `react-hooks/purity` (0 violations after fixes; permission expiry badge now computed at data-load); `set-state-in-effect` stays off with a comment (intentional camera/theme sync). Frontend tsconfig gains explicit `"types"` (TS 6 no longer auto-includes `@types`; `@types/geojson` added as direct dep since `@types/leaflet` used to pull it transitively).

### Done (cont.)
- **Hex-drift sweep (follow-up audit)**: zero PUP hex literals remain outside token definitions.
  - **Android**: `pupColors` gains `lineDark` (#30272A), `surfaceDark` (#171316), `campus`/`campusDark` (#F7F6F6/#0B0B0E), `muted`/`mutedLight` (#777177/#A39B9D). All inline `isDark ? '#FFDF00' : '#7B1113'` icon/loader/placeholder/background style props now reference constants; 16 screen `SafeAreaView`s converted from inline `backgroundColor` to `className="flex-1 bg-campus dark:bg-campus-dark"`; modal cards (scan manual entry, StudentCalendarViews, IdCardModal) converted to NativeWind classes or constants; MapView Leaflet WebView CSS + fullscreen StyleSheet interpolate `pupColors`.
  - **Web**: new tokens `surface-dark` (#121215), `golden-dark` (#E09A00) in `globals.css`; new `frontend/src/lib/colors.ts` (single source for raw JS values — maplibre paint, SVG strokes, chart configs). All `bg-[#7B1113]`/`text-[#FFDF00]`/`dark:bg-[#121215]`/`dark:border-[rgba(245,168,0,0.15)]` classNames replaced with `maroon`/`golden`/`surface-dark`/`golden/15` tokens across disputes, session cockpit, CampusMap, GeofenceCircle, ScanQrModal, reports, student dashboard; the two outlier pages' custom dark neutrals (#1C1C21/#2C2C35/#222/#F5F5F5) aligned to the app-wide zinc convention.

### Done (cont.)
- **2026-08 audit remediation (12 findings fixed)**:
  - **Backend authorization**: `removeStudent` now atomically deletes `SectionRole` and deactivates `SessionPermission` alongside the enrollment; student-president session creation requires a current enrollment (checked inside the same transaction as the insert) so stale role/permission rows cannot authorize a removed student.
  - **Session activation integrity**: `activate` uses an atomic `updateMany` claim (`id + isActive:false + endedAt:null + qrToken:null`) and rejects double activation/reactivation with `ConflictException`; a pre-claim guard rejects already-active/ended sessions before the token checks.
  - **Swagger gating**: new `common/swagger.ts` — production registers no Swagger routes unless `ENABLE_API_DOCS=true`; when enabled, the UI, `-json`, and `-yaml` routes are all token-gated via an array mount on `SWAGGER_PATHS`.
  - **Offline activation race**: a scan that loses the activation lock now waits (bounded) for the winner and re-checks the DB before proceeding; the DB claim remains authoritative.
  - **Late-enrollment roster**: a currently enrolled student whose roster row is missing gets the row upserted transactionally; the transaction also re-checks enrollment for existing rows so a mid-scan removal cannot write a record.
  - **Key rotation cache hygiene**: `provisionKey`/`revokeKey` hold a per-teacher `key-rotation:<id>` Redis lock across the DB write + cache invalidation; both activation cache publish paths acquire the same lock, re-read the current key at publish time, and skip publishing (DB fallback) when rotation is in flight — a rotated-out key can never be re-published.
  - **Cache failure resilience**: activation/end/auto-end treat cache writes as best-effort; `end` republishes the authoritative ended state (TTL 300s) if the cache delete fails so a stale `isActive:true` snapshot can never validate post-end scans.
  - **Audit availability**: `beginAudit` failures are logged with full request context (method, path, actor) and no longer block the business mutation; `failAudit` merges rather than replaces captured metadata. Trade-off documented in Key Decisions.
  - **Web session restoration**: `restoreSession` only clears the cached user on authoritative `401/403` (typed `ApiHttpError`); network/timeout/server failures preserve the profile and rethrow. New `SessionGuard` renders accessible loading/retry states and immediately redirects when `polycheck-auth-changed` fires with a cleared user (post-ready 401s can no longer leave protected content — including a rendered QR — visible).
  - **Session cockpit hardening**: initialization/refresh errors render accessible error + retry UI; independent fetches run in parallel (no duplicate `getSession`); polling and realtime refreshes are serialized with an in-flight guard and a trailing queued refresh; the 1024px QR is regenerated only when the token changes; countdown uses primitive deps; Generate/End buttons are disabled while in flight, apply the authoritative returned session immediately, and surface failures via notifications; ownership redirects use `replace` with a spinner state.
  - **Mobile scanner lifecycle**: `CameraView` mounts only while the Scan tab is focused; blur resets torch/result/manual state and increments a generation counter so in-flight scans are checked after every cancellable await. A blur prevents any not-yet-started submission and suppresses stale results after refocus; an HTTP submission already sent remains server-authoritative.
  - **Production image policy**: production Compose requires digest-pinned `BACKEND_IMAGE`/`FRONTEND_IMAGE` (no build contexts); `validate-production-images.sh` accepts only `@sha256:` digests; the release workflow uploads a checksummed `deployment-images-<SHA>` artifact.
  - **Backup/PITR automation**: scheduled `backup` service (logical dumps + `pg_basebackup` physical bases with `pg_verifybackup`, checksums, retention that can never orphan `latest-base.tar.gz`, and WAL pruning bounded by the oldest retained base); `archive_mode=on` WAL archiving with atomic verified copies and a free-space guard; postgres health accepts a fresh archive while requiring the latest archive attempt to be successful thereafter; `pitr-verify`, logical `restore-drill`, and physical `pitr-restore-drill` services are explicitly guarded; CI runs the full base backup → WAL marker → chain verification → logical restore → physical PITR replay pipeline; `pg_hba.conf` no longer trusts local sockets (SCRAM everywhere).
  - **Tests**: 375 backend, 93 frontend, and 118 Android tests pass; new regression coverage exercises the fixes above. The containerized physical PITR drill runs in Linux CI because it requires a Docker daemon.

### Done (cont.)
- **Beta-deployment readiness remediation (frontend + backend)**:
  - **CI gates**: backend `format:check` fixed (`audit-logs.service.spec.ts`); backend e2e fixture now sets `department: 'CCIS'` so it satisfies `User_role_fields_valid`; dependency audit passes — Next 16.4.0, maplibre-gl 6.13.0, vitest 4.1.11, plus `pnpm-workspace.yaml` overrides for proxy-addr, multer, engine.io, qs, sharp, source-map-js, deepmerge-ts, fast-uri, mysql2, undici, js-yaml, @xmldom/xmldom, browserslist, compression, image-size, and nanoid. Two android build-tool advisories (braces `GHSA-vfj7-8cjw-p6xm`, node-forge `GHSA-86w9-cpqp-85rv`) have no published fixed release and are ignored via `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`.
  - **Cross-browser runtime noise**: new `RuntimeErrorGuard` + `lib/abort-errors.ts` suppress cancellation-shaped unhandled rejections only while a navigation or page teardown is in progress; faculty dashboard effects log every failure that occurs before unmount instead of message-matching; Playwright `assertNoErrors` treats engine cancellation messages as noise only inside a navigation/aborted-request window.
  - **Enrollment contract**: web and mobile `enrollStudent` strip `sectionId` from the request body (it stays in the path), matching `EnrollStudentDto` under `forbidNonWhitelisted`; regression tests assert the exact body on both clients.
  - **Web E2E**: fixed the Next 16.4 route-announcer locator collision in the auth spec and hardened pre-hydration login submissions (invalid credentials, privacy consent) with response-wait retries.
   - **Misc**: `Dockerfile.frontend` `NEXT_PUBLIC_ALLOW_QR_FALLBACKS` defaults to `false` (local compose still passes `true`); fixed two `react-hooks/exhaustive-deps` warnings via a date ref; `AuthSessionMonitor` uses `location.replace` after revocation; proxy-hop docs updated.

### Done (cont.)
- **Mobile release hygiene (MP1 of `plan/mobile-improvement-plan.md`)**:
  - Deleted deep-linkable dev screen `android/app/debug.tsx` (Expo Router exposes every route file to deep links).
  - QR fallbacks are now opt-in on mobile: new `android/hooks/qr-fallback-policy.ts` (`true` only for the exact env value) used by `scan.tsx`; EAS `production` profile pins `EXPO_PUBLIC_ALLOW_QR_FALLBACKS=false` and `EXPO_PUBLIC_E2E_MODE=false`; CI release APK already forced both false.
  - Release config: added `monochromeImage` (Android 13 themed icons) and maroon/dark `expo-splash-screen` config (`#7B1113` / `#0A0A0A`); verified Sentry init is env-gated (`EXPO_PUBLIC_SENTRY_DSN`, PII stripped, disabled when unset or E2E mode).
  - New `android/RELEASE.md` documents the monotonic `versionCode`/`versionName` strategy (EAS `appVersionSource: "remote"` + `autoIncrement`), required production env vars, Sentry source-map vars, and the pre-upload checklist.
  - Regression coverage: `__tests__/qr-fallback-policy.test.ts`; android typecheck clean and 135 tests pass (10 suites).

### Done (cont.)
- **Offline-first web PWA (`plan/offline-web-pwa-plan.md`, M1–M4)**:
  - M1 shell: native `app/manifest.ts`, generated 192/512/apple-touch icons, hand-rolled `public/sw.js` (no Serwist build coupling), `/offline` fallback, maroon/black splash/theme, SW headers (`no-cache`, `Service-Worker-Allowed`), `PwaBoot` registration + update toast, `OfflineBanner` in both role shells, one-time iOS install callout, `NEXT_PUBLIC_PWA_OFFLINE` kill switch, manifest/theme metadata.
  - M2 store + sync: `frontend/src/lib/offline/{db,crypto,store}.ts` — IndexedDB (`idb`) with per-account AES-GCM keys (non-extractable CryptoKey, raw-key fallback), owner-scoped encrypted caches for subjects/sections/sessions/roster/records, `queue_v2`, metadata (clock offset, last sync, enrolled section ids), `OfflineSyncPanel` drain triggers, `navigator.storage.persist()`, `classifyAttendanceSyncError` promoted to `@polycheck/shared`.
  - M3 student offline scan: cache-aware reads (`getSessions`, `getSections`, `getSubjects`, `getStudentsForSection`, attendance lists), offline `submitScan` with local signature/geofence/accuracy/staleness/window/duplicate checks, optimistic `offline:` record, trusted-clock `/health` offset refresh, readiness chip, "Saved on Device" scan outcome, geofence distance diagnostics.
  - M4 teacher cockpit: offline `generateQrCode` (trusted `issuedAt`, local activation state + `session_activation` queue), offline `endSession`, queued manual attendance/status, cached proofs fallback, cockpit polling suspended offline; server remains authoritative (409 reconciliation + receipts).
  - Tests: new encrypted store round-trip/owner-wipe/queue tests + receipt polling/409 reconciliation suite; frontend now **112 tests**.
- **Bulk import (`plan/bulk-import-plan.md`, BM1–BM7)**:
  - Shared contract (`types/bulk-import.ts`, zod request schemas, `ApiClient` methods), client-side CSV parser/mapper/normalizer with golden PUP fixtures + checksum (FNV-1a pair), `papaparse` in `@polycheck/shared`.
  - Backend: `POST /users/students/import` (validate → checksum-bound execute, chunked transaction, generated temporary passwords, dept scope, skip/update modes, credentials once), `users-import` BullMQ queue + job status, `POST /sections/:id/enrollments/import` (ownership, section-level advisory lock, `studentCount` reconciliation, `STUDENT_NOT_FOUND/INACTIVE`, v2 opt-in inactive provisioning), `ImportBatch` model + 90-day retention, audit summaries + metrics.
  - Forced first-login rotation: `User.mustChangePassword` + migration, global `PasswordChangeGuard` (403 `password_change_required`), `POST /auth/change-password` (rate-limited, keeps current session), admin reset now forces rotation; web + mobile password gates.
  - Web: 6-step-style `BulkImportDialog` (upload → map → validate → confirm → commit with stop/retry → report; credentials/issues/failed-rows CSV downloads), wired to Users and section detail; inactive/provisioned filter + bulk activate.
  - Mobile (BM6): `BulkImportSheet` paste-first condensed flow (clipboard paste → mapping → validate → import → report) on users + section screens, credentials via native share CSV; `getStudentInfo`-style helpers not required. Document picker deferred to avoid a native rebuild before release.
  - Tests: shared 87, backend 457 (new import/auth/queue specs), frontend 112, android 142.
- **Mobile parity (`plan/mobile-improvement-plan.md`, MP2–MP6)**:
  - MP2: in-house `CampusToast` provider (2 visible, 3.5s/5s, accessible, tokens) replacing feedback `Alert`s across 25+ screens; destructive confirms stay native. Super admin Schedule was later **removed by the super-admin console plan (SA1)**, superseding MP2 LD4; the route remains for Option A deep links.
  - MP3: reports donut via `react-native-svg` (golden/maroon/deep-maroon/muted palette, totals in center) replacing the stacked bar.
  - MP4: verified the mobile Leaflet WebView already renders the shared `pupSantaMaria` building polygons (no change required).
  - MP5: fixed audit items — calendar `getMonthDays` trailing all-null week, validation schema drift (`SectionCreateSchema` optional teacher fields, full `AttendanceRecordSchema`, integer geofence radius), session create honors `sectionId`, offline cockpit/detail caching (`getSectionSessions`, roles), terminal scan phantom record removal, activation response cache, cold-start splash bound (4s auth check, pre-sync no longer blocks), and unhandled mutation feedback.
  - MP6: Feature Parity Gate + offline-first contract codified in this file; plan addendum records the audit + deviations.
- **Auth contract alignment**: `changePassword` returns the updated profile on both clients; `User.mustChangePassword` propagates through login/me/users payloads.
- **Container verification (local Compose)**: rebuilt backend/frontend images; migration `20261026120000_bulk_import` applied and seed completed; 34-check API/PWA smoke passed (import validate/execute/idempotency/checksum, forced rotation, Flow B enrollment + studentCount reconciliation, sync receipt pipeline, manifest/sw/offline); Playwright Chromium 57/57 passed and the import spec passes on WebKit; Firefox flags the known Zod CSP eval probe plus dashboard navigation-abort console logs in production builds (same on pre-existing specs; zero backend 5xx).
- **Super Admin Console (`plan/super-admin-console-plan.md`, SA1–SA5 + SA7)**:
  - Web super nav is the 7-item admin console (Dashboard, User Management, System Reports, Audit Log, Server Status, Institution Settings, Global Search); Android super tab bar is Dashboard/Users/Reports/More with the More sheet limited to Global Search, Institution Settings, Audit Log. Classroom monitoring feeds are gone; Option A keeps deep links/Global Search lookup. The MP2 super-admin Schedule item is superseded (route remains for deep links).
  - Both super dashboards consume `GET /dashboard/admin-overview` (active/disabled faculty+students, active sessions, pending disputes, real DB/Redis health, recent audit activity) with no teacher dashboard inheritance or sections fetches.
  - Backend account administration: filtered/paginated `GET /users`, `PATCH /users/:id` (role-specific whitelisted fields), `PATCH /users/:id/role` (student↔teacher with section/identity guards), `POST /users/admins` (institution-scope promote/fresh), explicit audit rows. Web + Android Users v2 add server search/filters/pagination, edit, role change, Add Super Admin; bulk import/inactive/bulk-activate preserved.
  - SA7 real-time Server Status: super-admin-only `server:subscribe` room, 5s publisher that idles at zero subscribers, `GET /dashboard/server-status` snapshot, web `/faculty/server-status` with in-house SVG sparklines/gauges and 15-minute session-local history. `GET /metrics` untouched.
  - Every `(faculty)` Android screen now has an explicit `useAuthGate` role list (attendance/search were previously ungated).
  - Verification: backend 508 tests / 49 suites, frontend 138 / 22, Android 177 / 13, shared 87 / 5; Playwright Chromium **66/66** (includes new console/users/server-status/import specs); live Socket.IO stream verified for super admin and denied for teachers; new API smoke covers overview/server-status/filters/edit/role/create-admin/scope denials; zero backend 5xx. Firefox/WebKit production-container caveats documented in the plan addendum.

### Done (cont.)
- **AI Assistant + Standing Evaluation (`plan/ai-assistant-plan.md`, AI0–AI6)**:
  - Shared contract: `shared/src/types/ai.ts`, `shared/src/types/standing.ts`, `shared/src/validation/ai.ts`, plus `ApiClient` methods `getAiCapabilities`, `sendAiChatMessage`, `getAiThread`, `getMyStanding`.
  - Backend `backend/src/ai/`: OpenAI-compatible provider (base URL/model from `ai_base_url`/`ai_model` settings with `AI_BASE_URL`/`AI_MODEL` env fallback; API key from the super-admin Institution Settings field `ai_api_key` — sealed with AES-256-GCM (`AI_KEY_ENCRYPTION_SECRET` or `BETTER_AUTH_SECRET`), never returned by `GET /settings` — with `AI_API_KEY` env as fallback; SSE streaming; tool-call assembly; `user-agent: polycheck/1.0` + `x-opencode-session` per thread; 30 s default timeout), role-keyed system prompts and tool registries (teacher, super admin, student — read/export only), Redis-backed threads (7-day TTL, ownership checks), Socket.IO `ai:thread:*` rooms, daily message caps (`AI_MAX_MESSAGES_PER_DAY`), fail-open per-tool audit rows, endpoints `GET /ai/capabilities`, `POST /ai/chat`, `GET /ai/threads/:id`.
  - File generation `backend/src/docs/`: `GET /docs/master-list/:sectionId?format=pdf|docx` (PUP-branded, stable `MASTER_LIST_COLUMNS` layout + signature block) and `GET /docs/session-attendance/:sessionId?format=csv|pdf` (formula-safe CSV); scoped teacher/admin.
  - Standing evaluation `backend/src/standing/`: deterministic evaluator `GET /me/standing`, `attendance_min_rate_percent` setting (default 75, clamped 0–100), projection ("absences before below threshold") and disputed/pending caveat; consumed by the student assistant.
  - Web: Assistant sidebar item + floating launcher + `/faculty/assistant` and `/student/assistant` pages, streaming chat with attachment downloads, per-tab student standing banner, and Institution Settings fields for `attendance_min_rate_percent`, `ai_base_url`, `ai_model` (API key never rendered).
  - Android: Assistant tab for students, faculty/super-admin More-sheet entry, shared `AssistantChat` with streaming + `expo-sharing` downloads, process-lifetime standing banner, API/realtime helpers.
  - Role-tuned assistants: the super admin gets a distinct prompt, UI copy, starter prompts, and admin-only read tools (`get_institution_overview`, `find_users`, `get_recent_audit_activity`) in addition to institution-scoped section/session/export tools; teachers get own-section tools with "list my sections" browsing; students keep the own-data explainer set. Provider tool-call messages use the OpenAI `type: function` shape (fixes provider 400s after a tool call), `find_sections` tokenizes natural-language queries and supports a no-query browse, and master lists default to PDF.
  - Settings/env: `backend/.env.example`, `.env.production.example`, and Compose pass the optional `AI_*` variables; the assistant stays disabled until configured.

### Done (cont.)
- **Institution Settings Redesign + AI Availability Controls (`plan/institution-settings-plan.md`, IS1–IS5)**:
  - Web + Android settings are now four categorized tabs: Institution · Sessions & attendance · Accounts & access · AI Assistant (deep-linkable `?tab=` on web; segmented tabs on Android), with per-tab save, unsaved indicators, helper captions, and the encrypted API-key block preserved.
  - New boolean settings (default true): `ai_assistant_enabled` (master), `ai_assistant_teacher_enabled`, `ai_assistant_student_enabled`; migration `20261027120000_ai_availability_settings` seeds them idempotently. `allow_teacher_student_provisioning` is finally surfaced in the UI, and `enrollment_code_expiry_days` is now actually consumed by section creation + code reset (previously hardcoded to 14 days).
  - Enforcement is backend-first: `AiCapabilities.policyBlocked` reports master/role shutdowns, `POST /ai/chat` returns 403 (including regenerate), and policy checks run before provider-config details. Super admins are exempt from the teacher toggle but governed by the master.
  - Entry-point gating: web bubble and Android Assistant tab/More-sheet item use `shouldShowAssistantEntry` — policy-blocked roles see nothing, unconfigured non-admins see nothing, super admins keep the setup affordance while the master is on.
  - Verification: backend 619 / 58, web 220 / 34, Android 273 / 18; typecheck/lint/format/build clean; container smoke covered master-off (policyBlocked + 403), teacher-only disable, and restoration.

### Done (cont.)
- **Wave 4 — Notifications, Excuses, At-Risk & Filters (`plan/notifications-excuse-filters-plan.md`, FIL/NF/EXC/RISK)**:
  - Notifications: `Notification` + `PushSubscription` models/migration `20261027160000_wave4_notifications_excuses`; `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read`, `POST /notifications/push-token`; realtime `notifications:new` over the per-user gateway room; web bell + panel, Android bell + center + Expo push registration (native rebuild required); triggers for disputes, excuses, auto-absent, standing warnings, account actions/key provisioning; 30-day retention.
  - Excuse workflow: `excused` attendance status + record fields; student requests on absent/late with optional evidence (proofs storage pipeline), teacher approve/reject queue (`/faculty/excuses`, Android `(faculty)/excuses`), review stamps, audit, notifications; standings exclude excused with caveat; reports/exports/AI counts/badges updated on both platforms.
  - At-risk oversight: deterministic `GET /attendance/at-risk` (grouped, scope-checked) + teacher dashboard "Students to check on" widget (web + Android).
  - Filters: URL-synced teacher filters (attendance subject/section/presets, sessions subject/section/status/date, disputes section/date, student history subject/date/status), admin reports section + department filters, teacher dashboard period selector; Android filter primitives and equivalents.
  - Verification: backend 674 / 63 suites, web 254 / 39 files, Android 298 / 21 suites, shared 87; typecheck/lint/format/build clean; container smoke covered excuse request→approve→`excused`+notifications, at-risk ordering, and admin department filtering.

### Done (cont.)
- **Release Readiness — QA + Polish (`plan/release-readiness-plan.md`, QA-1–QA-4, PL-1–PL-5)**:
  - Web E2E restored and extended to cover the new surfaces: assistant dock/theater ladder, excuse request→approve, notification center badge/deep-link/mark-read, filter deep links, standing-banner dismissal. Hardened the suite: super-admin nav expectation, server-side user search in the admin journey, collision-free E2E student IDs (random + 409 retry), Zod CSP eval-probe allowlist, abort-shaped dashboard fetch logging suppressed, and service workers blocked for UI journeys (`playwright.config.ts`; offline PWA has separate coverage).
  - Final matrix: Chromium 69 passed / 5 skipped / 0 failed, Firefox 64 / 10 / 0, WebKit 64 / 10 / 0.
  - PL polish: sessions `?sectionId` context banner + clear (web + Android), dark-mode parity sweep across both platforms (raw hex moved to tokens), per-thread Redis assistant send lock (409 on concurrent send/regenerate), `excused` bucket in dashboard trends on both platforms, Android Wave 4 device runbook in `android/RELEASE.md`.
  - Verification: backend 679 / 63, web 265 / 41 files, Android 307 / 22, shared 87; typecheck/lint/format/build clean; Docker stack rebuilt.

### Done (cont.)
- **Campus Designations & Maintenance Mode (`plan/campus-designations-and-maintenance-plan.md`, DH-LD1–15 / MT-LD1–12)**:
  - **Shared**: `User` gains `isItCoordinator`/`isDepartmentHead`/`isUserRegistrar`; `utils/designations.ts` (`canAccessItOperations`, `canAccessAcademicOversight`, `canAccessUserAdmin`, `isMaintenanceExempt`, `oversightDepartment`, `activeDesignations`); `types/maintenance.ts` (status/503 contracts, `maintenance_until` is an estimate only, status path + settings-changed event); maintenance validation schemas; `ApiClient.getMaintenanceStatus`.
  - **Backend**: migration `20261102120000_campus_designations_maintenance_mode` (three default-false columns + partial designee index + idempotent maintenance setting seeds); seed accounts `bry.mis` (IT coordinator), `chair.ccis` (head), `reg.campus` (registrar, CCIS so demo data is in scope); Better Auth `additionalFields` + `RequestUser`/`SessionAuthenticator` carry designations; `DesignationsGuard` + `@RequireDesignation` registered after `RolesGuard`; `maintenance-mode/` module (`SystemMaintenanceService` Redis snapshot 60 s + 2 s memo + event invalidation + fail-open, `MaintenanceGuard` between PasswordChange and rate limiting, public `GET /maintenance/status`); `AllExceptionsFilter` forwards `estimatedEnd`/`designation`; registrar department-pinned account administration (`common/designations/department-pin.ts`, import queue included) with designation writes super-admin-only (`designations_admin_only`) and audited `admin.user.designations_changed`; department-head scoping in `AttendanceScopeService`/reports/excuses/at-risk; server-status + SR triage widened to IT; gateway maintenance rejection + `server:subscribe` IT access; login 503 interlock for all four login routes; `system.maintenance_changed` audit on maintenance settings.
  - **Web**: `MaintenanceProvider`/`MaintenanceScreen`/`Overlay`/`Page` (event + public probe, 30 s recovery poll, authenticated-wall-only semantics, admin login link, countdown from the shared clock offset); `SessionGuard` maintenance branch; login pages render typed 503 surfaces (login methods now throw `ApiHttpError`); capability-driven sidebar groups (IT Ops/Academic Oversight/Registrar) with super-admin nav unchanged; users console registrar scope + designations editor + scrollable dialog; settings `System` tab (maintenance trio, IT coordinators see only that tab); gates for `users`/`settings`/`server-status`/`system-reports`/`reports`; new `/faculty/at-risk` page.
  - **Android**: `lib/maintenance.ts` (store + classifier + countdown), API client parses `estimatedEnd`/publishes maintenance and keeps sync-queue items retryable; root shell overlay (student preservation notice) + exemption pill + 30 s probe; login portals show the maintenance screen; scan screen shows the preservation notice on 503; More-sheet derivation moved to `lib/more-items.ts` with IT/Oversight/Registrar items; new Server Status and At-Risk screens; settings System tab/gate; users registrar gate with role changes hidden; reports/at-risk server-status gates; shared mock parity extended.
  - **Verification**: shared **122**, backend **845 / 75 suites**, web **304 / 48 files**, Android **335 / 27 suites**; backend lint/format, frontend lint, all typechecks and `pnpm build` clean; live API matrix **20/20** (role denials + registrar designation 403); new `e2e/designations-maintenance.spec.ts` **4/4** and full Chromium suite **104 passed / 3 skipped / 0 failed**. Container stack rebuilt (migration applied, designees seeded, `/api/maintenance/status` live). Deviations recorded in the plan addendum (health probes live under the global `/api` prefix; seed registrar scoped to `CCIS`; event-based cache invalidation; backend-local oversight helper for mocked attendance specs).

### Done (cont.)
- **Responsive Web Execution (`plan/responsive-web-plan.md`, RW-0–RW-5)**:
  - **Harness (RW-0/RW-5)**: `e2e/responsive.spec.ts` now covers **7 role groups × 4 viewports** (375×812, 390×844, 412×915, 768×1024) across **37 enumerated routes** (`e2e/responsive-routes.ts`), including the designation surfaces (`/profile`, `/faculty/at-risk`, `/faculty/system-reports`, `/faculty/settings?tab=system`, registrar `/faculty/users`). Strict page-level overflow assertions, zero exemptions. `visual-capture.spec.ts` snapshots every route at 375×812 into gitignored `e2e/captures/mobile/` (46 images).
  - **RW-1 foundations**: `viewportFit: 'cover'`; `<640px` form controls render at 16px (iOS auto-zoom prevention); shared `Input` is `text-base sm:text-sm`; `FilterBar` children become full-row on phones; sidebar mobile chrome gets safe-area top/bottom padding and ≥44px menu/close/bell targets. Desktop unchanged.
  - **RW-2 heavy tables**: Users and Audit Log keep the desktop table only at `md+` (`hidden md:block`; 860/900px min-widths unreachable on phones) and render stacked cards below `md`; Users row actions are shared via one component and the breakpoint is DOM-gated with `matchMedia`/`useSyncExternalStore` to avoid duplicate text locators. Reports/server-status/settings/search get stacked grids, scrollable tab pills, wrapped toolbars, and ≤92vw dialogs.
  - **RW-3 density pass**: all student and faculty classroom routes (dashboard, subjects/sections/sessions, attendance, disputes, excuses, at-risk, assistant) collapse stat grids 5→2→1 / 4→2→1 / 3→1 below md, wrap filter/action rows, keep tables in contained scroll regions, cap dialogs at ≤92vw, and give primary icon/row controls ≥44px touch targets. Cockpit QR/PIN/override dialogs fit phones without changing dual-checkpoint logic.
  - **RW-4 schedules**: month cells collapse to day number + three event dots below md with a phone-only day-detail panel reusing `EventPopoverContent`; week timetables stay `min-w-[700px]` inside an overscroll-contained snap region with a phone-only fade/hint and auto-scroll to today's column; `StudentWeeklySchedule` uses the same contained 7-column week on phones.
  - **Verification**: responsive gate **28/28**; full Chromium E2E **122 passed / 3 skipped / 0 failed**; web **304 / 48 files**, shared **122**, backend **845 / 75**, Android **335 / 27**; frontend `eslint`, `tsc --noEmit`, `next build` clean; Docker frontend image rebuilt and harness run live. Impeccable detector reported only the incumbent `border-l-4` side-tab house-style warnings (no errors). Firefox/WebKit were not rerun this wave.

### Done (cont.)
- **Defense-Winning "Wow Factor" Suite (`plan/wow-factor-suite-plan.md`, F1–F9 / W1–W10)**:
  - **F9 Hash-chain ledger**: `AttendanceRecord.prevHash/recordHash/salt` (migration + idempotent `dist-seed` backfill script — 189 sessions / 3,145 rows chained live); `recordHash = SHA-256(prev|studentId|timestampISO|sessionId|salt)` appended fail-closed inside every commit transaction (scan, manual, offline batch) under a per-session `pg_advisory_xact_lock`; daily `ledger.anchored` audit anchor (2AM cron); `POST /audit-logs/ledger/verify` (super admin) → `LedgerVerifyResult` + `ledger.verified` audit; Verify button + result banner on web + Android audit-logs.
  - **F8 Blackbox timeline**: `GET /attendance/records/:id/timeline` assembles activation → scan → ED25519 signature → queue → sync → dispute events from existing truth (`ScanAttempt` telemetry, `tokenSnapshot` issuedAt, record stamps) — nothing stored; deterministic recommendation chip (accept/review/reject matrix incl. mocked/duplicate/accuracy/staleness cases) rendered in the web dispute drawer + Android review sheet.
  - **F6 RA 10173 center**: `geolocation_retention_days` setting (7–90, default 30) editable in the System tab (both platforms); nightly shredder nulls coordinates/accuracy/riskSignals past retention (decisional metadata + dispute evidence kept; denied-attempt deletion stays with the existing prune); `GET /settings/privacy-center` (IT-suite gated) returns the live attestation (0 rows beyond retention), consent coverage, data inventory; one-click DPO Summary PDF. Read-only Privacy (RA 10173) tab on web + Android.
  - **F4 Class record**: `GET /docs/class-record/:sectionId?format=pdf|docx&from=` — A4 landscape PUP grading sheet (Republic header/seal/campus, alphabetical roster, 18-week P/L/A/E/I grid with multi-session join `P/A`, totals + standing-consistent rate, Instructor/Chair/Dean sign-off boxes); owner/head-pinned/admin scope; one-click download (web) + share (Android).
  - **F5 CHED CMO No. 40 slip**: `AtRiskReferral` model + state machine (`generated → acknowledged → counseling_scheduled → resolved`); creation gated by the deterministic engine (`409 student_not_at_risk` otherwise) + idempotent active-referral lock (`409 referral_active`); notice PDF cites CHED CMO No. 40 / Article V §21 / PUP Handbook with the absence ledger; Referrals tab (web) + sheet (Android) with head/admin transitions, notifications (`at_risk_referral`), audits; `/faculty/at-risk` widened to all faculty (teachers file for own sections).
  - **F2 Geofence radar**: web MapLibre modal (campus polygons + geofence circle, pulsing green pins, blinking red denied pins with `124m away · 74m outside geofence` copy, `Inside/Denied` counters, no-GPS legend) + Android map overlay/denied log; live via additive `attendance:anomaly` (denied in-person scans with coordinates only — never PIN/online) + `attendance:updated` refetches; `ApiClient.getScanAttempts` binding added (was backend-only).
  - **F1 Kiosk**: `/faculty/sessions/[id]/kiosk` — chrome-free maroon stage, QR + SVG countdown ring, capacity ring, `attendance:updated` ticker (student names), `kiosk:join` presence, `session:finale` broadcast (from `end()` + the auto-end cron with authoritative counts) driving the confetti/lock finale + final breakdown. Web-only by parity justification (projector surface; mobile keeps the live cockpit).
  - **F3 Hologram**: `HologramOverlay` on all ID surfaces (web + Android) — 22° gold/maroon sweep (`prefers-reduced-motion` → static sheen), 1 Hz trusted-clock UTC watermark (`PUP-ID-VERIFIED • LIVE UTC: … • DEVICE-BOUND •·•·<last4>`), optional accelerometer parallax dormant until `expo-sensors` ships.
  - **F7 Outage simulator**: `armOutage/disarmOutage` flag store; one guarded throw at the top of both clients' fetch wrappers drives the REAL encrypted queues (zero engine changes); floating pill + More-sheet item (strict `EXPO_PUBLIC_/NEXT_PUBLIC_ENABLE_OUTAGE_SIMULATOR === 'true'`, EAS production pinned false, local compose on); `Receipt #n · <id8>` chip; RESTORE & REPLAY drains, refreshes the clock offset, and the teacher reconciles via existing realtime toasts.
  - **Bug fixed en route**: the "Connect to the internet once…" provisioning guard was dead code on both clients (plain `Error` classified as a network failure → silent offline activation with scans destined to fail server verification). Both sites now throw a typed 4xx that fails closed, with regression tests.
  - **Verification**: shared **176 / 14**, backend **993 / 82** (lint/format/coverage clean), web **397 / 59** (lint/tsc/build clean), Android **654 / 35** (tsc clean; coverage **92.1/79.7/96.9/97.6 — all CI thresholds pass**); Chromium E2E **130 passed / 3 skipped / 0 failed** including 8 new wow-suite journeys run live against the rebuilt Docker stack (migrations applied, ledger backfilled).

### In Progress
- (none)

### Done (cont.)
- **Assistant Panel Redesign (`plan/assistant-panel-redesign-plan.md`, AP1–AP5 + AM1)**:
  - Web: shared `AssistantShell` with Dock (compact panel), Theater (centered `min(1120px, 92vw) × min(760px, 86vh)` overlay with scrim) and Focus (full-page) geometries; remembered per-device preference (default Dock); no global hotkey; Esc ladder; focus trap/`aria-modal`/scroll lock; role-aware bubble label/aria/tooltip.
  - Chat UX: markdown rendering (react-markdown + remark-gfm, token-styled tables/bold/lists, CSP-safe), collapsible tool activity, copy/regenerate/inline retry (regenerate re-runs the last user turn without duplicating it), stop-while-streaming + reconcile, attachment file cards with progress/check, smart scroll + jump pill, auto-grow composer with Stop, grouped messages and timestamps.
  - Threads: per-user Redis index (`ai:user-threads:<userId>`, 7-day TTL, cap 20, newest-first, title = first user message ≤60 chars) kept in sync from the thread-save path; `GET /ai/threads`, `DELETE /ai/threads/:id` (ownership-checked, audited); `ThreadsRail` in Theater/Focus.
  - Android parity: copy, collapsible activity, attachment cards, stop/reconcile, GFM tables via `react-native-markdown-display`, role empty-state parity.
  - Verification: backend 615 tests / 58 suites, web 183 / 30, Android 214 / 16, shared 87 / 5; typecheck/lint/format/build clean; live smoke on the rebuilt Docker stack (thread list → regenerate with a single user turn → delete).

### Done (cont.)
- **Account Governance — delegated resets, teacher overrides, device binding/cooldown, universal profile (`plan/account-governance-plan.md`, GOV-0–GOV-7)**:
  - **Shared contract**: `User` gains `boundDeviceId`/`deviceBoundAt`/`deviceCooldownUntil`/nullable teacher permissions/contacts/`delegatedPermissions`; new `ApiClient` methods (`teacherResetStudentPassword`, `emergencyReleaseDevice`, `unregisterDevice`, `updateContacts`); create/reset inputs accept omitted passwords and results carry a one-time `temporaryPassword`; pure `effectivePermission`/`cooldownRemainingMinutes`/`formatCooldownRemaining` helpers + zod schemas.
  - **Backend**: migration `20261030120000_account_governance_device_binding` (7 nullable User columns + idempotent settings rows); settings keys `allow_teacher_password_reset`, `allow_teacher_emergency_device_unbind`, `device_cooldown_hours` (1–24, default 2) with `getTeacherDelegationPolicies()`. New `DeviceBindingService` (mobile-login cooldown gate, lazy write-on-change binding, self-unregister arming `max(existing, now+N)` + revoking all sessions, effective-permission merge). New `UsersService` governance methods with advisory-locked enrollment checks, rate limits, fail-open audits (`teacher.password_reset`, `teacher.device_release`, `student.device_unregister`, `contact.updated`), notifications, and a crypto-random `PUP-XXXXXXXX-XX!` generator satisfying the 12-char policy. Mobile login DTOs accept `deviceId`; attendance scan acceptance lazily binds; self-service change-password now bumps `authVersion` while advancing the invoking session's `generation`; `GET /auth/me` exposes teacher `delegatedPermissions`; `AllExceptionsFilter` forwards `remainingMinutes`.
  - **Web**: ApiHttpError carries `code`/`remainingMinutes`; Accounts settings tab exposes the two switches + cooldown field; Users create/reset flows generate credentials server-side and show a copyable `CredentialResultDialog`; teacher User dialog gains tri-state permission overrides; student detail + section roster share `StudentGovernanceActions` (reset modal → credential dialog, emergency release reason modal, device status chips); new `/profile` page (identity, password rotation, contacts, student device panel with cooldown countdown + unregister confirm) and a Profile sidebar entry for all roles.
  - **Android**: mobile login sends the SecureStore installation id and branches on typed `device_cooldown_active` with a branded countdown modal; new root `/profile` screen (identity/password/contacts/device + unregister Alert); ID-card device chip + profile shortcut; student detail gains reset/release actions and credential/release sheets; Users screen uses generated credentials, copy sheets, and permission tri-state; More sheet gains Profile & security; settings mirror adds the governance controls; the uppercase `PASSWORD_CHANGE_REQUIRED` dead-branch is fixed.
  - **Verification**: backend 712 / 65 suites, web 274 / 44, Android 310 / 23, shared 95 / 6; `pnpm lint`, backend format/validate, `pnpm build` clean. New/updated Playwright coverage in `e2e/account-governance.spec.ts` and `e2e/admin.spec.ts` (generated-credential modals).

### Done (cont.)
- **System Issue & Feedback Reporting (`plan/system-reports-plan.md`, SR-0–SR-7)**:
  - **Shared contract**: `ReportCategory`/`ReportSeverity`/`ReportStatus` unions + label maps, `SystemReport`/`CreateSystemReportInput` (with client telemetry fields: `deviceInfo`, `appVersion`, `route`, `networkType`), filters/page/stats types, `CreateSystemReportSchema` + status-update zod, and `ApiClient` methods (`createSystemReport`, `getMySystemReports`, `getSystemReports`, `getSystemReportStats`, `getSystemReport`, `updateSystemReportStatus`). Fixed a latent shared-packaging gap: `@polycheck/shared/validation` is now a real export path (tsup entry + exports map).
  - **Backend**: model `SystemReport` (enums `ReportCategory`/`ReportSeverity`/`ReportStatus`, FK `User` cascade) via migration `20261031120000_system_reports_and_feedback`; `backend/src/reports/` module: `POST /reports` (student/teacher, Redis rate limit 5/hour/user), `GET /reports/my` (latest 100), `GET /reports` + `GET /reports/stats` (super admin; filters category/severity/status/role/search/dates + pagination), `GET /reports/:id`, `PATCH /reports/:id/status` (institution scope only — department chairs read-only), `GET /reports/:id/screenshot` (owner or super admin). Identity (`userId`/`userRole`) is stamped server-side; screenshots reuse the proof pipeline (`decodeImageDataUrl` ≤5 MB + `ProofStorageService`) with a fail-open attachment (storage errors keep the report); `admin.report.status_changed` audits (fail-open) with `from/to/noteUpdated/ipAddress`; `resolvedAt`/`resolvedBy` stamped on entering resolved and cleared when leaving; submitter notified via new `system_report_resolved` type.
  - **Web**: `report-telemetry.ts` (pure UA summarizer + `navigator.connection` mapping); `ReportIssueDialog` (category hints, severity radio pills, 5–120 title/description validation via shared zod, 5 MB image attach) hosted in the sidebar footer for students/teachers and on `/profile`; profile gains "My reports" tab (`MyReportsPanel` status pills + admin notes); new `/faculty/system-reports` cockpit (5 metric cards incl. unresolved + scanner/GPS + resolved-this-month + critical, category/severity/status/role/date/search filters, table → detail drawer with telemetry grid, streamed screenshot, status select + admin notes; department-scope read-only banner); notification label/destination maps extended.
  - **Android**: `report-issue.tsx` route (students/teachers; auto device label from `Platform` + `expo-constants` version, `usePathname`, network `unknown` until expo-network lands, `expo-image-picker` attach); Faculty More sheet gains "Report an Issue", super More sheet gains "System Reports"; profile screen gains report entry + "My reports" section; new `(faculty)/system-reports.tsx` cockpit (MetricTiles, status/category chips, search, detail bottom sheet with diagnostics + auth'd screenshot fetch (new exported `getReportScreenshotDataUrl` + tested `bytesToBase64`), triage controls); notification icon map extended.
  - **Verification**: shared 95 / 6, backend 727 / 66, web 283 / 46, Android 314 / 24; typecheck/lint/format/build clean; Docker stack rebuilt and smoke-passed (migration applied; student create → `GET /reports/my`; 6th submission → 429 `rate_limited`; admin resolve → `resolvedAt`/`resolvedBy` + audit `open->resolved` + `system_report_resolved` notification; `/faculty/system-reports` and `/profile` serve 200; smoke data cleaned).

### Done (cont.)
- **Hybrid Attendance — dual checkpoints, meeting PIN, zero-GPS online mode (`plan/hybrid-attendance-plan.md`, HYB1–HYB6)**:
  - **Shared contract**: `SessionMode` (`in_person|online`) + `CheckpointType`; extended `Session`/`QRTokenPayload` (additive `mode`/`checkpoint`/`pinRequired`/`pinHash`/`validitySeconds`, legacy token normalization); `AttendanceStatus += incomplete`; nullable record coordinates + per-leg `checkIn*/checkOut*` fields; `pin-hash.ts` (PBKDF2-HMAC-SHA256, 100k iterations, 60–300s checkpoint validity, injected CSPRNG); `SessionCreateSchema` mode superRefine (online rejects geofences), `BulkSessionCreateSchema`, `ApiClient.generateCheckpointQrCode` + scan `pin`/nullable-coordinate contracts. `@noble/hashes@1.8` as a shared dependency.
  - **Database** (`20261101120000_hybrid_mode_dual_checkpoint`): `SessionMode` enum; `Session` gains `mode`, per-leg tokens/expiries/pin hashes/validity/grace, `autoEndAt` (+index); geofence columns nullable; `ScanAttempt` gains nullable coordinates + `checkpoint`/`pinVerified`; `AttendanceRecord` gains nullable coordinates, per-leg times/statuses/tokens/attempt FKs; mode/column CHECK constraint; `autoEndAt` backfill for in-flight sessions. Historical rows unchanged.
  - **Backend**: dual-arm activation state machine (atomic claims, online arms refused after expiry without ending the class, window-bounded regeneration), zero-GPS roster seeding (`latitude/longitude: null`), server-side PIN gate against the session hash with a per-student per-checkpoint `pin-attempt:*` limiter (6 / 10 min ⇒ `pin_locked`), per-leg reconciliation gates + null-normalized replay, `resolution.ts` matrix (`present`/`late`/`incomplete` with `missed_checkin|missed_checkout` notes/`absent`; disputed + manuallySet exempt) shared by `end()` and the `autoEndAt` cron, cache TTL from the deadline, `present()` strips checkpoint tokens + PIN hashes, `incomplete` propagated through reports/trends/standing/docs/AI, excuses accept `incomplete`.
  - **Web**: session wizard mode toggle + RA 10173 notice (no geofence), mode badge and two-step cockpit (validity seconds/start grace/PIN toggle/auto-generate/PIN chip/regenerate/per-leg roster badges/incomplete counts+filters+override cycle), screenshot-first online scan modal (no geolocation call, PIN phase), offline online scan queue (null coordinates + encrypted PIN), status/report/donut/trend surfaces including `incomplete`, zero-GPS CampusMap fallback, privacy page clause.
  - **Android**: cockpit parity (mode badge, dual steps, PIN bottom sheet with auto-generate, per-leg badges, zero-GPS card), create wizard mode toggle, scan screen location suppression + PIN modal + mode-aware fallback policy (`shouldShowScanFallbacks` — online screenshots always available; in-person keeps the prod env pin), api-client checkpoint signing/offline queue, status maps/history filters/report donut/dashboard trends.
  - **Verification**: shared **108 tests / 7 files**, backend **746 / 67 suites**, web **285 / 46**, Android **317 / 24**; `pnpm lint`, backend `lint:check` + `format:check`, all package typechecks and `pnpm build` clean. New backend suites: resolution matrix, hybrid validator (zero-GPS/PIN correct-wrong-locked-disabled/unarmed/end-grace), service-level RA null-coordinate persistence, online activation/regeneration. New `e2e/hybrid-attendance.spec.ts` (UI arms PIN-protected start/end checkpoints; student scan asserts `coordinates: { latitude: null, longitude: null }`).

### Done (cont.)
- **Login "Session Expired" Loop — Fix (diagnosing-bugs investigation)**:
  - **Symptom**: intermittent "session expired"-style failure right after login on both roles, sometimes requiring 2–3 attempts; the login POST always returned HTTP 201 yet the browser bounced back to the landing/login page.
  - **Root cause**: every successful login emits `auth.session-replaced` (`reason: new_login`), and the realtime gateway broadcasts it to the entire user room with force-disconnect. The root-layout `AuthSessionMonitor` socket — connected whenever any cached user exists (same-tab re-login, another tab, or a still-valid session in a persistent browser profile) — received that broadcast **for the browser's own fresh login**, and the WebSocket event can beat the login's HTTP response on the wire, so even an immediate `/auth/me` probe could still carry the pre-login cookie. The monitor then ran `api.logout()` — which by then carried the just-created cookie and deleted the new session server-side — plus its full-reload bounce, making the login look broken.
  - **Fix**: termination paths now recognize the self-addressed broadcast. New exported `isOwnLoginInFlight()` in both clients marks an in-flight login (`noteLoginStarted`, cleared in a `finally` on every exit path so the stamp can never outlive the response); the monitor skips termination only while that stamp is live, otherwise it **probes `GET /auth/me`** — a genuinely replaced device fails it (null) and takes the existing destructive path exactly as before, keeping single-session enforcement intact; network failures never prove revocation. (An earlier draft also skipped during a 5s post-completion window — removed: after the login response completes the fresh cookie is applied and a probe is authoritative, so a cross-device replacement arriving seconds after this device's own login still terminates correctly.)
  - **Regression coverage**: new `e2e/auth.spec.ts` journey "re-login from an already signed-in browser does not bounce the fresh session" (one Playwright test = persistent profile; verified red before the fix); Android `lib/session-replacement.ts` decision helper + jest suite (self-signal skip incl. grace window, probe-driven termination, network-failure no-op).
  - **Also fixed while here**: `e2e/auth.spec.ts` super-admin nav expectation missing the GOV-era `Profile` sidebar entry, and a flaky `SessionGuard.test.tsx` teardown race (Once-401 mock replaced with an all-401 implementation). Web `AuthSessionMonitor`'s termination handler hoisted to module scope for `react-hooks/immutability`.
  - **Verification**: 51/51 auth E2E specs across Chromium/Firefox/WebKit including the new journey on all three engines; full Chromium suite 92 passed / 3 skipped / 0 failed after the drift fix; web unit suite 285 / 46 files; Android 322 / 25 suites; frontend lint/typecheck clean; live persistent-profile reproduction loop lands on the dashboard on every attempt (was 100% bounce before the fix).

### Done (cont.)
- **Single-active-session scoped to students (`backend/src/auth/session-policy.ts`)**:
  - **Request**: one-device login enforcement (session replacement) applies only to students; teachers and super admins may keep concurrent devices (e.g. mobile scanner beside the web cockpit).
  - **Policy module**: `enforceSingleSession(role)` (students only), `resolveSessionGeneration(account)` — students bump `authVersion` and stamp the new value; staff stamp the **current** `authVersion` without bumping — plus `resolveSessionCreateAfter` (`delete-self` on generation mismatch vs `authVersion` for everyone; `delete-others` students only; `keep` for staff) and `broadcastsLoginReplacement(role)`.
  - **Wiring**: Better Auth session `create` hooks consume the policy (`before` no longer bumps `authVersion` for staff; `after` no longer deletes sibling sessions for staff); `AuthService.createSession` emits `auth:session-replaced` (`reason: new_login`) only for student logins, so staff other devices are never kicked or notified on a new login. Security revocations are unchanged for all roles: delegated/admin password resets, account enable/disable, and self-service password rotation still bump `authVersion` (and delete sessions), so every staff session dies through the authenticator's generation check; those events also still broadcast over realtime.
  - **Tests**: new `session-policy.spec.ts` (role × active × generation matrix, broadcast gate); `auth.service.spec.ts` now asserts the `new_login` broadcast for students and **no broadcast** for faculty and super-admin logins. Backend **754 / 68 suites**.
  - **E2E journeys (auth.spec.ts)**: "faculty can be signed in on two browsers simultaneously (staff multi-session)" — second context login leaves the first dashboard intact; "student single-session: signing in on a second browser ends the first" — the first device is ejected to `/` via realtime + `/auth/me` probe. API-level container check: two faculty jars both `200 /auth/me`; student first jar drops to `401` after the second login.
  - **Android**: root-layout monitor keeps the guarded path (students still get the self-broadcast); `shouldTerminateForReplacedSession` probe semantics updated to in-flight-only.
  - **Superseded (2026-11)**: the device-integrity login gate removed login-time replacement — successful student logins no longer bump `authVersion`, delete siblings, or emit `auth:session-replaced`; a second device is now rejected with `403 active_session_elsewhere` instead of ejecting the first.

### Done (cont.)
- **Vulnerability Hardening Patch Wave (plan/vulnerability-hardening-plan.md, V1–V4)**:
  - **V1 (unfair `incomplete` on forgotten End-QR)**: `resolveSessionAttendance` gained `endArmed?: boolean` (default true, backward-compat lock) — an online session whose Checkpoint 2 was never armed resolves check-in-only rows to `present`/`late` instead of `incomplete`/`missed_checkout`. `end()` and the `autoEndAt` cron derive the flag from the pre-claim row (both closers null `endQrToken` inside their claim updateMany *before* calling the resolver — do not re-read after the claim).
  - **V2 (teleportation trap)**: otherwise-valid accepted scans are checked against the student's other-session credits (status present/late, or online `pending` with an accepted `checkInToken`) within 30 min **and** a matched-date overlapping `HH:mm` window (half-open; intersection decides even for stale-but-active sessions; unparsed clocks fall back to recency). Conflicts persist as disputed rows (`disputeReason=concurrent_session_conflict`, description carries the other `subjectName`), teacher dispute rail renders them via new label/icon entries on web + Android. Teacher manual attendance is exempt. Env: `CONCURRENT_SESSION_CONFLICT_DETECTION` (default true), `CONCURRENT_SESSION_LOOKBACK_MINUTES` (default 30, 1–720).
  - **V3 (zombie student)**: new `EnrollmentTombstone` table (migration `20261102120000_enrollment_tombstone`, unique `[sectionId, studentId]`; `Section`/`User` relations incl. `SectionRemovals` Restrict) written inside `removeStudent`'s locked transaction; `enrollByCode` + `enrollViaCode` reject with `403 code=student_blocked_from_section`; teacher `enrollStudent` clears the block inside `createEnrollment` (locked) and bulk import clears for every created enrollment. No retro-block of historical removals; expired-code errors keep precedence.
  - **V4 (ghost professor)**: `activate()` optionally accepts teacher `latitude/longitude` (+ `overrideTeacherLocation`), gated to in-person sessions only (online stays RA-10173 zero-GPS). Off-campus fix beyond `max(geofenceRadius, 150)` ⇒ typed **409** `teacher_location_outside_geofence` carrying `distanceMeters/allowedDistanceMeters/canRequestOverride` (forwarded by `AllExceptionsFilter`); a confirmed override re-sends with the flag, writes the fail-open `session.activation_override` audit row, and proceeds. Web cockpit captures a one-shot `navigator.geolocation` fix (absent fix = info toast, unchanged behavior) and hosts an accessible override alertdialog; Android mirrors it via `expo-location` + native destructive Alert. `GenerateCheckpointQrInput.teacherLocation?` rides the shared contract; offline queued activations stay coordinate-free by design. Env: `TEACHER_ACTIVATION_LOCATION_ENFORCEMENT` (default true), `TEACHER_ACTIVATION_TOLERANCE_METERS` (default 150, 30–2000).
  - **Verification**: backend **778 / 68 suites** (24 new tests across resolution/attendance-conflict/sections-tombstone/sessions-gate), web **285**, Android **322**, shared **108**; typecheck/lint/format clean; `pnpm build` clean; full Chromium E2E **100 passed / 3 skipped / 0 failed**; hardening spec 8/8 on Firefox + WebKit; containers rebuilt with the tombstone migration applied and the V2/V3/V4 flows smoke-verified live.

### Done (cont.)
- **Android runtime + polish wave (post-device feedback, 2026-11-07/08; addendum in `plan/apk-readiness-plan.md`)**:
  - **Styled-TextInput crash**: `react-native-css@3.0.7`'s TextInput wrapper declares `{ textAlign: true }` in `nativeStyleMapping` and runs `path.split(".")` on that **boolean** whenever the resolved style carries a `textAlign` value (`text-center` class) — crashing the faculty QR-validity prompt, checkpoint prompts (validity/grace/PIN), enroll screen and scan PIN modal at render. Fixed app-side (`7d7f846`): `textAlign` moved to inline `style` on all 6 inputs (same pattern as the working inline-styled login inputs). Upstream `3.1.0-rc.1` still contains the bug (byte-identical), so the evaluated `nativewind@5.0.0-rc.1` + engine bump was **reverted**; `ImageBackground.backgroundColor: true` is the same trap but unused in this app.
  - **Navigation life** (`803a831`): detail screens live in hidden tabs (`href: null`), so navigation was unanimated over a white platform background. Root `Stack` gains themed `contentStyle` + `slide_from_right` + pop-style replaces; both Tabs groups gain `animation: 'fade'` + themed `sceneStyle`; the `key={isDark}` full-navigator remount removed (white flash on dark-mode toggle); mount-time `SplashScreen.hideAsync` race removed (splash hides at fonts+session ready; themed root behind it); `active:` press feedback on CampusButton/Card/IconButton; CampusToast animated with Reanimated (`FadeInDown`/`FadeOutUp`, reduced-motion gate, new jest mock for reanimated); `router.back()` for two back buttons that used `router.replace` (scroll-position loss); `CampusSkeleton`/`DashboardSkeleton`/`ListSkeleton` primitives adopted on the cockpit, faculty dashboard, and faculty subjects (removes the false "No subjects yet" during load and the white null-return on the cockpit chain).
  - **Verification**: emulator mid-flight push frame (88.9% maroon / darkened blend) instead of a white flash; Android 656/656 tests; typecheck clean; styled-bundle gate green with the fix; EAS preview build `86603ed8-6c75-4e5e-b100-21c5bd2633b8` (artifact QR reissued). Emulator diagnostic pitfall: a wedged AVD compositor can render screencaps all-black for the app window while the launcher composites fine — **reboot the emulator** before trusting black screenshots (AVD reboot restored real pixels; no app code involved).

### Done (cont.)
- **APK Release Readiness & Build-Pipeline Proofing (`plan/apk-readiness-plan.md`, APK0–APK10)**:
  - **Unstyled-APK root cause (proven)**: root `.gitignore` pattern `metro.config.js` ignored `android/metro.config.js`, so EAS builds ran without NativeWind v5 / `react-native-css` wiring. Expo SDK 57 still resolves the `.css` import on native without NativeWind and silently ships an empty stylesheet (the bundle succeeds). Emulator builds worked because the file existed locally. Fixed by anchoring the ignore to `/metro.config.js` and committing the project config.
  - **Regression gates**: `scripts/verify-tracked-build-files.mjs` (release-critical files present, tracked, not ignored) and `scripts/verify-android-bundle-styles.mjs` (production `expo export` must contain `twsa-safe-area` / `color-red-50` / `color-zinc-700`; proven to fail 3/3 when the Metro config is absent) are wired into the CI `verify` job. `android/RELEASE.md` gains the post-build APK/AAB fingerprint check.
  - **EAS preview config**: `build.preview` now references the EAS `preview` environment and keeps the deployed staging `EXPO_PUBLIC_API_URL`; docs cover physical-device URLs and the non-dev startup guard.
  - **Dependency alignment**: Expo `57.0.32`, RN `0.86.3`, expo-router `57.0.30` and the rest of the SDK patch line — `expo install --check` exits 0 and `expo-doctor` is 21/21. Metro 0.84.5 replaced `image-size` with its own asset parser, so the former `image-size` override and `patches/metro@0.84.4.patch` were removed as obsolete; the styled-bundle gate still passes on 0.84.5.
  - **Security**: `next 16.4.1` (two critical RCE advisories), `@sentry/nextjs 10.75.2` (critical middleware bypass), `better-auth 1.7.7` (critical OAuth-state + two highs; no Prisma migration needed), zod `4.6.7`; overrides for body-parser 2.4.0, multer 2.5.0, undici 8.12.2, vite 7.3.7, node-forge 1.4.1, qs 6.16.2, markdown-it 14.3.3. `pnpm security:audit` exits 0 with one justified ignore (`decode-uri-component` via `query-string@7`; the fixed release is ESM-only and would break Expo Router deep-link parsing). Two stale ignores (withdrawn/fixed advisories) were removed.
  - **Hygiene**: 7 frontend lint warnings cleared (0 problems), the Android Jest teardown warning eliminated via in-band `maxWorkers: 1` (Windows jest-worker 500 ms shutdown race with no real handle leak; scanner fake-timer restore moved to `afterEach`), and a full-suite `SessionGuard` `waitFor` timeout hardened.
  - **Verification**: shared **176**, backend **993 / 82 suites**, web **398 / 59 files**, Android **656 / 35 suites**; frontend/backend/android typecheck, lint, format, Prisma validate, Next build, backend build, `expo install --check`, `expo-doctor 21/21`, `pnpm security:audit` exit 0, and a styled production export all pass locally. EAS preview build `fe94588c-7f16-4eea-9777-ab6a2b0a17f8` finished; the downloaded APK's Hermes bundle contains `twsa-safe-area` (×4), `color-red-50`, and `color-zinc-700`, proving the shipped artifact is styled. Visual device smoke remains.

### Done (cont.)
- **Android keyboard + layout guards (post-device feedback, wave 3; uncommitted)**:
  - **Android 15+ keyboard**: edge-to-edge (targetSdk 36) makes `adjustResize` a no-op, so forms were covered by the IME. New `android/lib/keyboard.ts` (`keyboardAvoidingBehavior` → `padding` on iOS/API 35+), root `KeyboardAvoidingView` around the root `Stack` when `Platform.Version >= 35`, and the helper applied to the remaining Android KAVs (scan PIN/manual modals, dispute/excuse modals, bulk import sheet) plus KAV wraps on the faculty cockpit QR-validity/checkpoint sheets. `'height'` avoidance removed from `enroll`/`change-password` (double compensation), which now rely on the root inset.
  - **Sign-out confirmation**: new `android/lib/sign-out.ts` `confirmSignOut()` destructive Alert; all 10 sign-out affordances (student dashboard/history/ID card; faculty dashboard/subjects/attendance/excuses/reports; super dashboard; forced change-password escape) route through it. Profile logout remains the post-unregister confirm.
  - **Scanner layout**: the gold frame + instruction no longer render under the floating bottom panel — the panel height is measured (`onLayout`) and fed into the overlay padding, the header is reserved (96pt), and the scan frame is height-aware (`min(width*0.82, 340, height-470)`).
  - **Student session detail**: status now Scheduled / Active / Completed (was "Completed" for every non-active session); while armed it renders the signed class QR so class officers can display it, otherwise an "Awaiting instructor activation" explainer. Activation itself stays instructor-only by design: the backend `POST /sessions/:id/activate` is `@Roles('teacher')` and tokens must be signed with the instructor's provisioned device key — server-signed officer activation is a product/security decision, not implemented.
  - **Verified**: Android typecheck clean, **656/656 tests**, styled-bundle gate PASS (`twsa-safe-area=4`). EAS preview build `b8ffc0a9-feb8-4fa0-9b1f-f2f28804bd20` finished; artifact `https://expo.dev/artifacts/eas/hLKSlevPHE9usJujzjYtxqYbOIMT5MwKbqUHWf0nJAk.apk` (149.8 MB) fingerprint re-verified; installed on AVD (API 37) — landing renders styled (81% maroon), zero fatal/RN errors, and with the IME open on the login form the password field + SIGN IN stay fully visible (root KAV path confirmed). Authenticated screens remain device-unverified (no staging credential).

### Done (cont.)
- **Device-bug batch (wave 4, uncommitted)**: new `KeyboardAwareScrollView` (focused-input reveal on `keyboardDidShow`; adopted across faculty/super forms + login) and modal KAVs for input sheets; week-carousel snap/gesture tuning + responder-guard removal via backdrop-sibling modals; `cachedListOrThrow` empty-cache policy (cold cache surfaces retry, warm cache stays offline-first); `getStudentSections` hits role-scoped `/sections` (mobile + web); student dashboard/history/schedule keep last data with request-id ordering + refresh-failure toasts; permission card re-checks on focus; `campusDateOf` Manila date-boundary fix; sign-out in-flight stamp honored by `useAuthGate` and the root redirect (staff logout double-replace race) with profile unregister routed through it; More sheet restructured so item navigation commits after the modal closes. Verified: Android typecheck clean, **661/661 tests / 36 suites**, frontend `tsc` clean, styled-bundle gate PASS. Device smoke + APK rebuild pending.

### Done (cont.)
- **Course-on-section, session slot selector & dispute submit fixes (`plan/course-section-session-fixes-plan.md`, CS1–CS4 / SL1–SL3 / DS1–DS2)**:
  - **Course on sections**: shared `PUP_SANTA_MARIA_COURSES` catalog (`shared/src/constants/pup-courses.ts`; draft list pending registrar confirmation) + `pupCourseByCode`/`pupCourseName`/`pupCoursesByDepartment`; new `Section.course?: string` (Prisma `course String?`, idempotent migration `20261110120000_section_course`, optional in `CreateSectionDto`/`UpdateSectionDto`, trimmed and returned by `presentSection`); `formatSectionHeading`/`sectionCourseLabel` (`shared/src/utils/section-label.ts`). Web create-section now requires a Course select (catalog grouped by department + "Other — specify manually"), and the course renders on the faculty dashboard, subject cards ("Courses: …"), section grid/header/selects, sessions list, attendance, search, at-risk filter, and student subject pages. Legacy rows without a course render exactly as before.
  - **Session class-meeting selector**: new `frontend/src/lib/session-slots.ts` helpers; single create exposes a "Class meeting" select built from the section schedule (defaults to the date's weekday, picking a slot moves the date to its next occurrence and refills times/room, custom option for make-up dates); bulk create replaces the single weekday/time pair with one editable row per schedule slot. Contract: `BulkSessionInput.slots` + `BulkSessionSlotSchema` (legacy `daysOfWeek`+global pair still valid) and `CreateBulkSessionsDto.slots`; `createBulk` lets slots win, sweeps each slot's weekday with its own times, dedupes identical rows within a request, and keeps the existing date-level conflict/P2002 semantics.
  - **Student dispute submit**: root cause was the backend `@MinLength(10)` on description plus a submit handler with no `try/catch` (a 400 vanished silently). The dialog now requires a 10–1000-char trimmed description (counter, hint, `aria-invalid`, submitting state, `role=alert` feedback); the dashboard handler catches `ApiHttpError` and surfaces its message with no unhandled rejection; "Other" now posts `reason: 'other'` (added to `StudentDisputeReason`, the backend allowlist, and the teacher dispute label/icon maps on web + Android).
  - **Verification**: shared **198 / 17 files**, backend **1002 / 82 suites**, web **442 / 65 files**, Android **661 / 36 suites**; backend typecheck/lint/format, frontend `tsc`/lint (0 problems)/tests, Android `tsc`, and `pnpm build` clean. New `e2e/section-session-fixes.spec.ts` (course display, slot selector + per-slot bulk, dispute validation) and the faculty section-create journey updated; Playwright was not run locally (Docker daemon unavailable).

### Done (cont.)
- **Student device-integrity login gate (web-only UX; `plan/device-integrity-login-plan.md`, LI1–LI3 + LI5-web + VER)**:
  - **Shared**: `DeviceIntegrityErrorPayload`/`ActiveDeviceKind` (`shared/src/types/device-integrity.ts`), `formatCooldownCountdown` (`shared/src/utils/device-integrity.ts`), `User.cooldownDeviceId`, `EmergencyDeviceReleaseResult.hadBinding`.
  - **Backend**: student-only `DeviceBindingService.assertLoginAllowed` on **both** `/auth/login/student` (web, now sends `deviceId`) and `/auth/mobile/login/*`; a live valid session on another device → `403 active_session_elsewhere` (`activeDeviceKind`, `activeSessionLastActiveAt`) and the active device is **not** kicked; successful student logins no longer bump `authVersion`, delete siblings, or emit `auth:session-replaced`, and same-device logins purge that device's stale rows; null-device legacy sessions never block. Per-account Redis lease `student-login:<userId>` (15s TTL, bounded retries → 409, fail-open when Redis is down) serializes the gate + session-create pair. Cooldown is device-aware (`cooldownDeviceId` exempt) and carries `remainingMinutes` + `remainingSeconds`. `POST /auth/logout` accepts `{ deviceId?, armDeviceCooldown? }`; students arm only with a non-empty device id and `armDeviceCooldown !== false` (sign-out runs first, client IP audited). Self-service unregister stamps the exempt device; Emergency Device Release clears binding/cooldown/exemption (always revokes sessions) and returns `hadBinding`/`hadCooldown`.
  - **Web**: `loginStudent`/`logout` send the `web-…` installation id; programmatic terminations pass `armDeviceCooldown: false`; `ApiHttpError` parses the new fields; new `StudentLoginDeviceGate` renders a ticking cooldown (trusted `/health` offset) and the active-session explainer; teacher student detail shows bound/exempt/cooldown chips and release-result copy.
  - **E2E**: `installSessionCleanup()` added to every spec (module-level `afterEach` only attaches to the first spec per worker); new `e2e/device-integrity.spec.ts` journey (A active → B rejected → A logout → B countdown → A instant → faculty release → B instant); the second-device auth journey now asserts rejection while the first stays signed in.
  - **Verification**: shared **202 / 18 files**, backend **1034 / 82 suites** (+ real-DB integration e2e **7** passing with all **26** migrations), web **455 / 66 files**, Android untouched/byte-identical to HEAD (**661 / 36 suites** still pass; typecheck clean), `pnpm build` 3/3. Playwright not run locally (no Docker stack) — validation was list-level only.
  - **Feature Parity Gate justification**: the UX was explicitly requested web-only ("don't touch the mobile for now"); the security gates are backend-first and apply to both clients. Android shows only the generic `active_session_elsewhere` error, has no countdown/explainer, and sends no device id on logout (so it never arms a cooldown) — LI4 parity follow-up.

### Done (cont.)
- **Flutter Mobile Port (`plan/flutter-mobile-port-plan.md`, A1–A3 / B1–B5 / C1 / VER)**:
  - **Coexistence:** new sibling package `polycheck_mobile/` (Flutter 3.44.2 / Dart 3.12.2, app id `edu.pup.polycheck.mobile`) shipping beside the RN app (`edu.pup.polycheck`). `android/` is untouched as the read-only reference/shippable client — `git status --porcelain -- android` is empty; `backend/`, `frontend/`, and `shared/` were not modified.
  - **Delivered:** foundation + contracts (freezed models mirroring `shared/src/types`, Haversine/token/PIN/section-label/slot/pup-courses parity, TrustedClock, drift schema, go_router guard ladder); student flows (dashboard/schedule/history, 3D ID card + hologram, scanner with camera/upload/manual + geofence/mock/accuracy + meeting PIN + offline queue, disputes/excuses/enrollment, officer session creation); faculty flows (subjects/sections, course-aware headings, slot-aware bulk wizard, dual-checkpoint cockpit with locally Ed25519-signed `QrImageView` + fullscreen + PIN + realtime + manual overrides, student detail governance, disputes timeline, excuses, at-risk + CHED referrals, reports/exports, schedule, attendance); admin/designation console (dashboard, users + bulk import, 4-tab settings + maintenance/AI key, audit + ledger verify, live server status, system-reports triage, global search); shared surfaces (profile, assistant streaming, notifications, privacy, outage simulator); sync engine with receipt polling, first-arrival-wins duplicates, exponential backoff and retained terminal evidence; release config (R8, splash/icons, permissions, signing fallback, `RELEASE.md`).
  - **Verification:** `flutter pub get` OK; `dart format lib test` 300 files / **0 changed**; `flutter analyze` **0 issues**; `flutter test` **476/476** (64 test files); `flutter build apk --debug` OK (200,649,186 B). Existing `build/app/outputs/bundle/release/app-release.aab` **81,103,989 B / 77.35 MiB** is current but **debug-signed** (`CN=Android Debug`) because `android/key.properties` is absent — must not be uploaded. `cmdline-tools` missing makes `flutter build appbundle` exit 1 after writing the valid AAB. No keystores/secrets committed; `build/` + `.dart_tool/` ignored.
  - **Deferrals/gaps:** kiosk web-only; PWA `/offline` represented by the native offline engine; no FCM push; no OS background sync; assistant current-thread id not persisted across launches (threads remain browsable); PIN-protected offline scans do not survive cold start (process-memory PIN vault → terminal `pin_required`, evidence retained); teacher cockpit activation/end/manual overrides require network (no activation queue); scan-time signature verification is server-side; global search is super-admin-only (web also allows teachers); assistant entry icons are shown regardless of policy (screen + backend enforce). iOS deferred.

### Blocked
- (none)

## Key Decisions
- **Password hashing is native (`@node-rs/bcrypt`), not `bcryptjs`.** The pure-JS implementation ran on the event loop, pinning one core and capping login at ~51–113/min; at cost 12 it also starved Prisma long enough to produce P2028 500s. `@node-rs/bcrypt` was chosen over the `bcrypt` npm package because `Dockerfile.backend`'s prod-deps stage installs with `--ignore-scripts` and the image is Alpine/musl with no toolchain — `@node-rs` ships per-platform N-API packages as ordinary optional deps (`linux-x64-musl` and `win32-x64-msvc` both resolve). `UV_THREADPOOL_SIZE=16` (libuv default 4) is what parallelises it. Legacy `$2a$` hashes from bcryptjs still verify, so no re-hash migration is needed. Measured: backend CPU 100 % → 398 %, 2,000-student provisioning 100 min → 10 min, login p95 827 ms at cost 12.
- Section course is a **plain nullable string column** (`Section.course`, program short code like `BSIT`) backed by the shared `PUP_SANTA_MARIA_COURSES` constant — no course table and no backfill. The web form requires it; the API keeps it optional so the Android composer keeps validating until parity lands. Display uses `formatSectionHeading` at web sites that hold the Section; composed `sectionName` payloads stay bare so mobile's `Sec …` labels are unaffected.
- Bulk session creation accepts **two shapes**: `slots` (one entry per class meeting with its own times) wins when present; the legacy `daysOfWeek` + one time pair remains valid and behaves exactly as before. The per-row unique key `(sectionId, date, startTime, endTime)` lets different meetings share a date; the date-level existing-session conflict check is preserved.
- Student disputes use `reason: 'other'` for the free-form option (added to the shared union, backend allowlist, and both teacher rails); the description is validated client-side to the backend's 10–1000 rule and API failures are surfaced inline instead of being swallowed.
- **Student device-integrity state machine**: one active student login at a time — a login from a device that is not the holder is **rejected** (`403 active_session_elsewhere`) and never replaces the active session; same-device logins pass and purge that device's stale rows; logout (or self-service unregister) arms a per-account cooldown where only `cooldownDeviceId` is exempt; teacher Emergency Device Release is the audited escape hatch. Gate + session-create are serialized per account by a 15s Redis lease (`student-login:<userId>`, bounded retries → 409, fail-open when Redis is down). Enforced backend-first on `/auth/login/student` and `/auth/mobile/login/*`; web sends `web-…` ids, mobile `mobile-…`; staff are exempt and keep concurrent devices. Successful student logins never bump `authVersion`, delete siblings, or emit `auth:session-replaced`; revocations (password reset, status/role change, rotation) still bump it and kill every session.
- V2 concurrent-conflict is a **flag for teacher review, never a silent penalty**: the windows test decides whenever clocks parse (recency only for malformed times; a stale still-active session never opened for today's slot does not veto an unrelated window); teacher manual attendance is exempt; the first (legit) class record is never touched.
- V4 teacher-location evidence is optional by design: absent fix = offline-first behavior unchanged; online sessions must never send coordinates (RA 10173 extends to activation); overrides are audited fail-open rather than blocking, and `allowedDistanceMeters = max(geofenceRadius, tolerance)` keeps large-radius rooms from false-flagging.
- V3 tombstones are stamped on removal inside the guarded transaction and only lifted by explicit teacher action (single enroll or bulk import); student code enrollment can never delete a block, and expired-code errors keep precedence over the block.
- `auth:session-replaced` is now emitted only by security revocations (password reset, status/role change, forced rotation) — never by student logins — and force-disconnects the user's rooms. Client termination paths still treat an event as *suspicion, not proof*: the in-flight own-login window (`isOwnLoginInFlight`) remains as defense-in-depth, and only an authoritative `GET /auth/me` failure (null) or 401 elsewhere terminates the device. Network failures never sign the user out; single-session is enforced server-side by the login-time active-session gate plus the `generation`/`authVersion` check on every request.
- Dark mode on mobile: use NativeWind `dark:` variants for static colors and `isDark` only where a native API requires a computed color value; never mix `className` and `style` on the same element.
- `Pressable` replaces `TouchableOpacity` for clickable list items to avoid scroll-touch interference.
- Timeline for session activation: Teacher generates QR (1–15 minutes) → scans within validity → Present; scans during the configured grace period (up to 60 minutes) → Late; after grace expiry the backend auto-ends the session and marks remaining Pending records Absent. A teacher can end the session earlier.
- `gracePeriodMinutes` is enforced by online validation, delayed offline validation, Redis TTLs, and the automatic expiry job.
- QR rendering uses `react-native-qrcode-svg` on mobile and `qrcode` on web so generated attendance tokens are scanner-compatible.
- `expo-sharing` + `react-native-svg` ref are used for sharing the QR image on mobile; web also supports token copy/download.
- **Hybrid attendance**: `Session.mode` is immutable; online sessions forbid geofences by schema/service and never persist coordinates (`null` end-to-end, no location heuristics — RA 10173). Dual checkpoints use seconds (`60–300s`), start grace `0–60m`, end grace fixed `0`. The legacy single-`qrToken` columns remain in-person-only. Between checkpoints rows stay `pending`; `end()`/the `autoEndAt` cron resolves `present`/`late`/`incomplete`/`absent` (disputed + manuallySet exempt). `incomplete` counts in the standing denominator, not the numerator, and is excusable.
- **Meeting PIN**: 2–4 digits hashed client-side with PBKDF2-HMAC-SHA256 (100k iterations, per-token salt, `@noble/hashes`); the hash is signed into the token and stored on the session (`startPinHash`/`endPinHash`); the server verifies against the DB copy with timing-safe comparison and locks after 6 attempts / 10 min per student per checkpoint. Plaintext PINs never leave the teacher device, are never logged, and offline queue copies live only in the encrypted per-account store.
- Screenshot/link QR fallbacks are always available for `online` sessions (`shouldShowScanFallbacks` on Android; web modal enables them per decoded/known session mode) regardless of the global fallback env pins; in-person keeps the hardened opt-in policy.
- Audit logging fails open: if the initial audit-row insert fails, the mutation still runs and the failure is logged with full request context (method, path, actor) rather than returning 500. This preserves in-class availability when the audit table is briefly unavailable; the trade-off (a possible missing audit row for that one mutation) is accepted and observable in logs. Audit completion/failure updates remain best-effort and merge request context.
- Signing-key rotation serializes against activation cache publication via the per-teacher `key-rotation:<id>` Redis lock; cache publication is best-effort and skips (DB fallback) when rotation holds the lock. Production image references must be `@sha256:` digests — tags are retargetable and rejected by `validate-production-images.sh`.
- Device binding is student-only, but device identity now covers **web + mobile**: web sends `web-…` on login/logout, mobile its SecureStore `mobile-…`. Binding is written lazily on mobile login success and accepted scans (write-on-change). `AuthSession.deviceId` records the holder (legacy null rows never block). Self-service unregister clears the binding, revokes all sessions, and arms `deviceCooldownUntil = max(existing, now + device_cooldown_hours)` with the unregistering device exempt; during cooldown only `cooldownDeviceId` may log in, others get `403 code=device_cooldown_active` + `remainingMinutes`/`remainingSeconds`, and teachers clear it instantly through the audited Emergency Device Release. Institution switches are a master gate: per-teacher overrides (`null` = inherit) can restrict but never enable a disabled capability.
- Delegated temporary passwords are generated server-side (`node:crypto`, unambiguous alphabet) so every credential satisfies the 12-character PUP policy; they are returned exactly once and force rotation (`mustChangePassword`). Audit actions follow the lowercase-dot convention (`teacher.password_reset`, `teacher.device_release`, `student.device_unregister`, `contact.updated`); generated account creations reuse `admin.user.created` with `generatedPassword: true`.
- Self-service password changes bump `authVersion` and advance the current Better Auth session's `generation` in the same transaction — other sessions die immediately while the rotating session survives; an account cooldown/limit is enforced server-side on every delegated action even if the UI hides the button.
- **Dual-hat designations are additive teacher flags** (`isItCoordinator`/`isDepartmentHead`/`isUserRegistrar`). Super admins implicitly hold every suite; designation writes are super-admin-only (`PATCH /users/:id`, audited `admin.user.designations_changed`) and rejected for other actors with `403 designations_admin_only` before any field is applied. `admin-scope.ts` semantics are untouched — registrar scoping lives in `common/designations/department-pin.ts`.
- **Registrar scope is department-pinned**: list/create students, create department teachers, reset passwords, enable/disable, and run bulk imports inside their own `User.department`; role changes, admin creation, email edits, capability overrides, and designation writes stay super-admin-only.
- **Department-head scope** expands attendance reports/excuses/at-risk to the actor's department through `AttendanceScopeService` and the at-risk/excuse services; a plain teacher (or a head without a department) keeps today's own-session behavior. IT coordinators get server-status, SR triage, and maintenance controls but never academic oversight; heads never get telemetry.
- **Maintenance mode** is settings-driven and default-off: Redis snapshot (60 s) + 2 s in-process memo, invalidated by `settings.maintenance-changed` on write, failing open (log-only) when both cache and DB are unreadable. `maintenance_until` is a display estimate only — it never switches the mode off. Exemptions are super admins + IT coordinators; the four `@Public` login routes enforce the same rule inside `AuthService` after credential validation. `/maintenance/status` and the health probes stay public (health lives under the global `/api` prefix).
- **IT coordinators may only write the three maintenance setting keys** (`PUT /settings/:key` per-key policy); every maintenance write is audited `system.maintenance_changed`.
- **E2E enrollment hygiene**: the student enrollment journey uses a disposable student account because instructor removal stamps a V3 `EnrollmentTombstone`, which would block a reused seeded student from code enrollment on subsequent runs.
- **Flutter port is a new sibling package, not a replacement:** `polycheck_mobile/` (Flutter 3.44+, Riverpod/go_router/freezed/drift/dio) ships with app id `edu.pup.polycheck.mobile` alongside the RN `android/` app; `android/` stays byte-identical as the reference/shippable client, and `backend/`/`frontend/`/`shared/` remain read-only contracts.
- **Flutter mirrors the backend contract exactly:** identical dispute unions (`StudentDisputeReason` 7 + `SystemDisputeReason` 12 incl. `concurrent_session_conflict`), notification types, device-integrity 403 payloads/countdown semantics, maintenance/forced-password gates, and designation suites (`adminAccessFor` over `/admin/*`: super-admin all; IT server-status/system-reports/settings-System; registrar department-pinned users).
- **Ed25519 token format parity:** `<base64url(payload JSON)>.<base64url(signature)>`, signature over the base64url payload string; Flutter stores a 32-byte seed (also reads legacy 64-byte nacl keys) and uploads the 32-byte public key via `POST /auth/provision-key`, failing closed with a typed 4xx when the device was never provisioned.
- **TrustedClock rule:** all validity/expiry/countdown decisions use device-UTC epoch ms + the persisted `/health` midpoint offset; the raw device wall clock is never trusted, and timer UI is anchored to trusted time.
- **Zero-radius PUP design system:** `#7B1113`/`#FFDF00`/ink tokens, Lora display + DM Sans body, 1 px borders, no rounded cards — matching web/RN.
- **Flutter offline attendance engine:** owner-scoped drift queue (no plaintext PIN at rest), batches ≤100 with receipt polling, first-arrival-wins `DISPUTED_DUPLICATE`, retry/backoff for transient failures, terminal evidence retained, drains on app resume / connectivity regain / student session + manual **Sync now**.
- **Cockpit QR is real and scannable:** tokens render through `qr_flutter`'s `QrImageView` in-panel and on the fullscreen maroon stage; the raw token remains as the copy/share/manual-entry fallback.
- **Flutter release pipeline:** `android/key.properties` is opt-in; without it release AAB/APK fall back to the debug key for local verification only (never upload). R8/shrink stay enabled, `versionCode` comes from `pubspec.yaml` `+N`, and `RELEASE.md` carries the Play checklist.

- **Auth Landing Animation & Layout Fix**: Moved auth pages from `app/login/` into `app/(auth-landing)/login/` (with role sub-routes `faculty` and `student`) within a shared route group. This preserves layout state and prevents full unmounts, restoring smooth CSS/motion animations and logo transitions when switching between login views.
- **Student Scan QR Fallback Options (Web & Mobile)**:
  - Web fallbacks are enabled by default (`NEXT_PUBLIC_ALLOW_QR_FALLBACKS !== 'false'`); mobile fallbacks are **opt-in** (`EXPO_PUBLIC_ALLOW_QR_FALLBACKS === 'true'` via `hooks/qr-fallback-policy.ts`) and pinned `false` in the EAS production profile.
  - Web modal (`ScanQrModal.tsx` & `ScanQrViews.tsx`) now exposes all 3 accessible check-in channels: **Camera**, **Upload Image** (local QR decoding via `BarcodeDetector` / ZXing with drag & drop and 10 MB file validation), and **Enter Token** (manual input / paste of teacher-signed QR token with whitespace and surrounding quote sanitization).
  - Both fallback channels strictly require and enforce client-side GPS location capture against classroom geofence before submission.
  - Added warning banner in upload view when camera permissions are denied or unavailable on the device.
  - Mobile scanner (`android/app/(tabs)/scan.tsx`) exposes `Upload QR Image` and `Enter Code` fallbacks alongside live camera.
- **Database Migration Self-Healing**: Added idempotent pre-checks and backfills in `20260907090000_domain_constraints/migration.sql` to gracefully handle dirty development databases or re-runs without crashing the migration service container.
- **Docker Compose Local Developer Experience**: Added automated 1-click startup scripts (`start-local.bat`, `start-local.sh`, `stop-local.bat`, `stop-local.sh`) and passed `NEXT_PUBLIC_ALLOW_QR_FALLBACKS: "true"` to local container builds.
- **Comprehensive Automated Test Coverage**: 2,220 total passing automated tests across 190 suites/files monorepo-wide (shared 176 / 14, backend 993 / 82 suites, web 397 / 59 files, Android 654 / 35 suites). Chromium E2E: **130 passed / 3 skipped / 0 failed**, including the 8 wow-suite journeys (ledger verify, dispute timeline, radar, class-record/CHED/DPO downloads, outage replay, kiosk finale) and the 28 responsive-gate tests. Firefox/WebKit were not rerun for this wave (previous baseline 64 / 10 / 0).

## Next Steps
- Run the attendance hash-chain backfill from the seed entrypoint (it is compiled to `dist-seed` but never executed, so a fresh volume has unhashed rows), and make `ledger/verify` report `insufficient_data` rather than "intact" when no hashed records exist — see `plan/defense-day-bugfix-plan.md` Deviation 8.
- Connect sessions page to section context when navigated from section detail.
- Add dispute notification badge on faculty sidebar/tab bar.
- Add OS-scheduled background sync; the encrypted SQLite queue already syncs opportunistically while the app is active.
- Web push (VAPID) for installed PWAs remains deferred; Android Expo push shipped in Wave 4 (requires a dev client/EAS rebuild).
- Add academic calendar integration (semester dates, holidays).
- Add dark mode support parity across all pages.
- Mobile import file picker (`expo-document-picker`) as the fast-follow to the shipped paste-first flow (requires a native rebuild).
- Run the super-admin Maestro flow and device smoke (users edit/role/add-admin + live Server Status) — not executed locally because adb/Maestro are unavailable.
- Run the Lighthouse PWA checklist and physical iOS/installed-PWA offline verification before enabling `NEXT_PUBLIC_PWA_OFFLINE` in production.
- Run the 5,000-user load simulation on staging (plan/load-simulation-plan.md LT4–LT6); the local harness is validated (200 students paced as 4×50 waves pass, 200-simultaneous burst documents the single-instance limit).
- AI assistant follow-ups: add Maestro/Playwright journeys for faculty extraction → share/download and the student standing question; device-test Android file sharing and keyboard layout; add a per-thread send lock (concurrent `POST /ai/chat` is last-write-wins); get PUP sign-off on the external AI endpoint policy and set `AI_*` in production.
- Confirm the attendance standing threshold policy (`attendance_min_rate_percent`, default 75) with the registrar and adjust the seeded default if needed.
- Run `e2e/designations-maintenance.spec.ts` on Firefox/WebKit (new spec verified on Chromium only this wave) and add a Maestro flow for the mobile More-sheet suites + maintenance overlay.
- Device-smoke the Android maintenance overlay, the exemption pill, and the offline preservation notice during a real maintenance window.
- Confirm the campus registrar policy (department-pinned today) with the Branch Director before onboarding the Registrar's Office beyond CCIS.
- Run `e2e/responsive.spec.ts` + `e2e/visual-capture.spec.ts` on Firefox/WebKit and device-smoke the installed PWA (safe-area insets, month-day tap target, week autoscroll) before the next release.
- Run `e2e/wow-suite.spec.ts` on Firefox/WebKit (MapLibre WebGL + blob downloads) and device-smoke the demo arc: kiosk on a projector, radar with a real denied scan, hologram screenshot legibility, outage arm→scan→receipt→restore→reconcile.
- Add `expo-sensors` in a dev-client/EAS build to activate the dormant accelerometer parallax on the ID hologram.
- Kiosk/finale and radar journeys are Chromium-verified; add Maestro coverage for the Android denied-attempt log + finale banner when device runs resume.

## Critical Context
- `android/metro.config.js` is load-bearing: it wires NativeWind v5 (`withNativeWind` → `react-native-css` custom Metro transformer + resolver). It must stay tracked; the root `.gitignore` only ignores the root-level `/metro.config.js`. Without it EAS builds silently ship an empty stylesheet (`className` dead, inline `StyleSheet` styles still render).
- NativeWind v5 is a thin wrapper over `react-native-css` + Expo's CSS transform; there is **no babel plugin** — `android/global.css` uses Tailwind v4 `@source` directives for content scanning.
- Styled-bundle fingerprint: a corrected production Hermes bundle contains `twsa-safe-area`, `color-red-50`, and `color-zinc-700`; a config-less bundle contains zero of them. Enforced by `scripts/verify-android-bundle-styles.mjs` in CI and documented in `android/RELEASE.md`.
- Metro 0.84.5+ (Expo 57.0.32 line) ships its own image parser and no longer depends on `image-size`, so no pnpm patch/override is needed for the old image-size v2 incompatibility.
- EAS `preview` profile uses the EAS `preview` environment and pins `EXPO_PUBLIC_API_URL` to the deployed staging API in `eas.json`; physical-device local testing needs the LAN IP (never `10.0.2.2`).
- Android release builds are **EAS-only** on Windows: the local CMake path-length limit (`react-native-worklets` >250-char object paths under `.pnpm`) makes `gradlew assembleDebug` unreliable; see `plan/apk-readiness-plan.md` APK8.
- Android package: `edu.pup.polycheck`; iOS bundle: `edu.pup.polycheck`.
- Hardening flags (V1–V4): `CONCURRENT_SESSION_CONFLICT_DETECTION` (default true) + `CONCURRENT_SESSION_LOOKBACK_MINUTES` (default 30); `TEACHER_ACTIVATION_LOCATION_ENFORCEMENT` (default true) + `TEACHER_ACTIVATION_TOLERANCE_METERS` (default 150). V3's block table is `EnrollmentTombstone`; blocked students see `403 code=student_blocked_from_section`; teacher enroll/import clear blocks. In-person activations may carry teacher coordinates; overrides are audited `session.activation_override`.
- Student logins never replace sessions (`backend/src/auth/session-policy.ts`): a successful student login stamps the current `authVersion` (no bump), purges only that device's stale duplicates, and emits no `new_login` broadcast; a second device is rejected with `403 code=active_session_elsewhere` while the active device keeps its session. Staff logins likewise stamp the current `authVersion` and never delete siblings, so faculty/super-admin credentials work on the web dashboard and mobile app simultaneously. Security revocations (password reset, status/role change, forced rotation) still bump `authVersion` and kill every session.
- Device-integrity login gate: `POST /auth/login/student` (web) and `/auth/mobile/login/*` accept an optional `deviceId` (web `web-…`, mobile `mobile-…`) and both run `DeviceBindingService.assertLoginAllowed` — cooldown first, then active-session. Rejections: `403 active_session_elsewhere` (`activeDeviceKind`, `activeSessionLastActiveAt`) and `403 device_cooldown_active` (`remainingMinutes` + `remainingSeconds`). `POST /auth/logout` accepts `{ deviceId?, armDeviceCooldown? }`; students arm only with a non-empty `deviceId` and `armDeviceCooldown !== false` (revoke-then-arm, client IP audited), staff/device-less logouts never arm. `AuthSession.deviceId` + `(userId, deviceId)` index and `User.cooldownDeviceId` come from migration `20261111120000_login_device_integrity` (nullable, idempotent, no backfill; legacy null-device sessions never block, but an unidentified attempt with any active session fails closed). The `student-login:<userId>` Redis lease has a 15s TTL, bounded retries → 409, and fails open when Redis is unreachable. `activeSessionLastActiveAt` is `AuthSession.updatedAt` (Better Auth lazy `updateAge`, informational only). Android sends its installation id (server-gated) but renders only the generic `active_session_elsewhere` error, has no countdown/explainer, and sends no device id on logout (never arms) — LI4 parity follow-up.
- Permissions: camera (QR scan), location (geofence check) — already requested in `scan.tsx` via `useCameraPermissions` + `expo-location`.
- Runtime mock data has been removed. Web and mobile use the NestJS API; mobile retains only its SQLite offline cache and sync queue.
- `AttendanceRecord.status` now includes `'disputed'`. `AttendanceRecord` has optional `manuallySet?: boolean`. `AttendanceSummary` has `disputed: number`.
- `Session` no longer has `tokenWindowSeconds`; replaced by `qrValidityMinutes: number`. `qrGeneratedAt?: string` tracks when QR was generated.
- API client methods include `generateQrCode`, `submitScan`, `endSession`, `getDisputedRecords`, and `resolveDispute`.
- `createQRTokenData` signature changed: `(sessionId, subjectId, teacherId, teacherName, validityMinutes, gracePeriodMinutes)`. Note: `subjectId` param is actually `sectionId` in the new model; kept as `subjectId` for token backward compat.
- `isTokenInValidityWindow(payload, serverTimeMs?)` returns `{ valid: boolean, inGrace: boolean }`.
- Mobile QR rendering uses `react-native-qrcode-svg`; web QR rendering uses `qrcode`.
- Mobile scan uses real `CameraView` with `onBarcodeScanned` from `expo-camera`.
- Faculty layout has a `disputes` tab with `gavel` icon.
- Grace period: after QR validity expires, valid scans are Late. The backend auto-ends the session when grace expires, or the teacher can end it earlier.
- Web offline: `frontend/public/sw.js` + IndexedDB (`frontend/src/lib/offline/*`); flag `NEXT_PUBLIC_PWA_OFFLINE`; sync uses the existing `/sync/attendance/batches` receipt contract.
- Bulk import endpoints: `POST /api/users/students/import` (`?background=true` optional), `GET /api/users/students/import/jobs/:id`, `POST /api/sections/:id/enrollments/import`; execute requires the validate `rowChecksum`.
- Forced password rotation: `User.mustChangePassword` blocks protected routes with 403 `password_change_required` until `POST /auth/change-password` succeeds (web + mobile gates).
- The mobile import sheet is paste-first by design (`expo-document-picker` deferred to avoid a native rebuild); credentials share through `android/services/file-sharing.ts`.
- Admin console endpoints: `GET /dashboard/admin-overview`, `GET /dashboard/server-status`, `GET /users?role&q&department&status&limit&offset`, `PATCH /users/:id`, `PATCH /users/:id/role`, `POST /users/admins`. Realtime server metrics use `server:subscribe` / `server:subscribed` / `server:metrics` in the `/attendance` namespace (super_admin only, 5s, idle when unsubscribed).
- AI assistant: `GET /ai/capabilities`, `POST /ai/chat` (teacher/super_admin/student; accepts `regenerate: true` to re-run the last user turn), `GET /ai/threads` (per-user summaries), `GET /ai/threads/:id`, `DELETE /ai/threads/:id`; the reply streams over Socket.IO `ai:thread:join` / `ai:thread:stream` (delta/done/error) in the `/attendance` namespace. Threads and the per-user summary index live in Redis (7-day TTL) and are ownership-checked. The provider is OpenAI-compatible and disabled until configured: `AI_BASE_URL` (or the `ai_base_url` setting) + `ai_api_key` (super-admin settings, stored encrypted; `GET /settings` never returns it) or `AI_API_KEY` env fallback + `AI_MODEL` (or `ai_model`); caps via `AI_MAX_MESSAGES_PER_DAY`. OpenCode Go uses `https://opencode.ai/inference/go/openai/v1` and requires `x-opencode-session` (the provider sends the thread id).
- Document exports: `GET /docs/master-list/:sectionId?format=pdf|docx` and `GET /docs/session-attendance/:sessionId?format=csv|pdf` (teacher/super_admin, scoped). Master list columns are fixed (`MASTER_LIST_COLUMNS`) for future OCR/template work.
- Standing evaluation: `GET /me/standing` (student only) is deterministic (no LLM); `attendance_min_rate_percent` (default 75, institution-editable) drives the dashboard banner and the student assistant. Pending/disputed records are excluded from the rate and reported as a caveat.
- AI availability settings (all default true): `ai_assistant_enabled` (master; off hides the assistant everywhere including super admins), `ai_assistant_teacher_enabled` (teachers only; super admins exempt), `ai_assistant_student_enabled` (students). `GET /ai/capabilities` returns `policyBlocked: true` with the administrator reason, and `POST /ai/chat` rejects with 403. Settings are read per request — no restart needed.
- Institution settings UI categories: Institution · Sessions & attendance · Accounts & access · AI Assistant (web `?tab=`; Android segmented tabs). `allow_teacher_student_provisioning` lives under Accounts; `enrollment_code_expiry_days` now controls section enrollment-code lifetime.
- Notifications/excuses: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read`, `POST /notifications/push-token`; Socket.IO `notifications:new` in the user's `auth:user:<id>` room. Excuse flow: `POST /attendance/records/:id/excuse` (student, absent/late), `GET /attendance/excuses`, `POST /attendance/records/:id/excuse/decision` (teacher only; approve → `status=excused`). `excused` is excluded from the standing denominator with a caveat. At-risk: `GET /attendance/at-risk?sectionId&limit`. Report totals include `excused`; `AttendanceReportFilters.department` is admin-scoped.
- Android push requires a dev client/EAS rebuild (`expo-notifications` plugin + `POST_NOTIFICATIONS`); web push (VAPID) remains a deferred, env-gated follow-up.
- Account governance endpoints: `POST /api/users/students/:id/teacher-reset-password` (`{ sectionId }`, teacher; returns the one-time `temporaryPassword`), `POST /api/users/students/:id/device-release` (`{ sectionId, reason, note? }`, teacher; returns `hadBinding`/`hadCooldown`), `POST /api/users/me/device/unregister` (student self-service; body `{ deviceId? }`), `PATCH /api/users/me/contacts` (`{ contactEmail?, contactPhone? }`, empty string clears). Both student login routes accept an optional `deviceId`; cooldown failures return `403 code=device_cooldown_active` + `remainingMinutes`/`remainingSeconds`, and an active session on another device returns `403 code=active_session_elsewhere` + `activeDeviceKind`/`activeSessionLastActiveAt`. `POST /api/auth/logout` accepts `{ deviceId?, armDeviceCooldown? }`. Teacher-effective capabilities arrive via `GET /auth/me` → `delegatedPermissions`.
- Governance settings (`Institution Settings → Accounts & access`): `allow_teacher_password_reset` (default true), `allow_teacher_emergency_device_unbind` (default true), `device_cooldown_hours` (1–24, default 2). Per-teacher nullable overrides live on `User.canResetStudentPasswords` / `canEmergencyUnbindDevices` and are edited through `PATCH /users/:id` (teacher targets only).
- System reports: `POST /api/reports` (student/teacher only, telemetry auto-captured client-side, 5/hour/user; `REPORT_CREATE_RATE_LIMIT`/`_WINDOW_SECONDS` tunable), `GET /api/reports/my`, super-admin `GET /api/reports` (+`?category&severity&status&role&search&startDate&endDate&limit&offset`), `GET /api/reports/stats`, `GET /api/reports/:id`, `PATCH /api/reports/:id/status` (institution scope; department chairs read-only), `GET /api/reports/:id/screenshot`. Audit action `admin.report.status_changed`; notification type `system_report_resolved`. Screenshots stream through the proof storage driver (local `/uploads` or `s3://` references in `SystemReport.screenshotUrl`); mobile screenshots must be fetched with the bearer token (`api.getReportScreenshotDataUrl`).
- Hybrid attendance endpoints: `POST /sessions/:id/activate` accepts `{ checkpoint: 'start'|'end', validitySeconds, gracePeriodMinutes?, regenerate?, token }` (online) or the legacy `{ validityMinutes, gracePeriodMinutes?, token }` (in-person); `POST /sessions/:id/end` resolves the checkpoint matrix. `POST /attendance/scan` and `/attendance/check` accept optional `pin` and nullable coordinates (online must omit coordinates).
- Meeting PIN format: `p1$pbkdf2-sha256$<iterations>$<b64url salt>$<b64url digest>` stored in `Session.startPinHash`/`endPinHash` and inside the signed token (`pinRequired`, `pinHash`); PIN attempts use Redis `pin-attempt:<sessionId>:<studentId>:<checkpoint>` (6 attempts / 10 min).
- Online sessions: `Session.mode = 'online'`, geofence columns null, `AttendanceRecord.latitude/longitude` null, `autoEndAt` drives the every-minute cron. Between checkpoints rows remain `pending`; final statuses resolve to `present`/`late`/`incomplete` (`notes` tag)/`absent`.
- Mobile scan fallback policy: `shouldShowScanFallbacks(<env>, mode)` in `android/hooks/qr-fallback-policy.ts` — `online` always shows screenshot/manual fallbacks; in-person still requires `EXPO_PUBLIC_ALLOW_QR_FALLBACKS=true`.
- Shared crypto: `@noble/hashes@1.8` (`pbkdf2.js`/`sha256.js` subpaths) is used by `shared/src/utils/pin-hash.ts`; v2 is ESM-only and breaks backend ts-jest.
- Campus designations: `User.isItCoordinator` / `isDepartmentHead` / `isUserRegistrar` (default false, teacher accounts only). Helpers live in `shared/src/utils/designations.ts`; backend enforcement uses `@RequireDesignation(...)` + `DesignationsGuard` (registered after `RolesGuard`). Super admins pass every designation route implicitly.
- Designation suites: IT Operations (`/faculty/server-status`, `/faculty/system-reports`, `/faculty/settings?tab=system`, `GET /dashboard/server-status`, `server:subscribe`, SR triage routes), Academic Oversight (`/faculty/reports`, `/faculty/excuses`, `/faculty/at-risk`, `GET /attendance/report|excuses|at-risk` — department-pinned), Registrar (`/faculty/users` and the department-pinned user-admin routes).
- Maintenance mode: settings `maintenance_mode_enabled` / `maintenance_message` / `maintenance_until` (string rows; `''` clears). `GET /api/maintenance/status` is public; protected requests by non-exempt actors return `503 { code: 'system_maintenance', message, estimatedEnd? }`; `GET/PUT /settings` per-key policy lets IT coordinators write only the maintenance keys. Exemptions: `role: 'super_admin'` or `isItCoordinator`; login routes enforce the same rule inside `AuthService`; health probes are `GET /api/health` and `/api/health/ready` (public, global `/api` prefix).
- The module name `MaintenanceService` (`backend/src/common/services/maintenance.service.ts`) is still the cron pruning service; the maintenance-mode subsystem lives in `backend/src/maintenance-mode/` (`SystemMaintenanceService`). Do not conflate them.
- Seed designees: `bry.mis@pup.edu.ph` (IT coordinator), `chair.ccis@pup.edu.ph` (department head), `reg.campus@pup.edu.ph` (registrar; department `CCIS` so local demo data is in scope).
- `Section.course` is a nullable PUP Santa Maria program code (e.g. `BSIT`); the catalog lives in `shared/src/constants/pup-courses.ts` (`PUP_SANTA_MARIA_COURSES`, `pupCourseByCode`, `pupCourseName`, `pupCoursesByDepartment`) and is exported from the shared package root. `formatSectionHeading(section)` renders `Section X · COURSE` and degrades to `Section X` when absent.
- Bulk sessions accept `slots: [{ day, startTime, endTime }]` (slot-aware, each meeting keeps its own times) or the legacy `daysOfWeek + startTime + endTime` pair; when both are sent, `slots` wins. Backend `createBulk` still rejects a request when any target date already has a session for the section.
- Student dispute `reason='other'` is valid (backend allowlist + both teacher label/icon maps); the web dialog also client-validates the description to 10–1000 trimmed characters before enabling submit.
- `polycheck_mobile/` is the Flutter port (not `android/`): `flutter pub get`, `dart format lib test`, `flutter analyze` (release gate 0), `flutter test` (476 hermetic tests), `flutter build apk --debug`, `flutter build appbundle --release`. Build-time flags: `PUP_API_BASE_URL` (default staging `https://polycheck-api.addtokart.tech/api`, must include `/api`), `PUP_WS_BASE_URL` (derived `…/attendance`), `ALLOW_QR_FALLBACKS` (default false; online sessions always allow upload/manual), `ENABLE_OUTAGE_SIMULATOR` (default false), `PUP_APP_VERSION`.
- `polycheck_mobile` package: `edu.pup.polycheck.mobile`; minSdk 26 / targetSdk 36; R8 + shrink on; debug APK 200,649,186 B; release APK 90,984,782 B; AAB `build/app/outputs/bundle/release/app-release.aab` 81,103,989 B — **debug-signed fallback** until `android/key.properties` exists. `flutter doctor` reports `cmdline-tools` missing, so `flutter build appbundle` exits 1 after writing a valid bundle (install cmdline-tools for a clean exit 0 + `apkanalyzer` symbol check).
- Flutter sync engine: `OfflineAttendanceQueue` rows are owner-scoped and never store a plaintext PIN; PINs live in the process-lifetime `AttendancePinVault`, so a cold-start replay of a PIN-protected scan is rejected terminally (`pin_required`) with evidence retained. Terminal evidence is never deleted; transient failures back off 5 s → 5 min; 401/maintenance aborts release rows back to pending. Teacher cockpit activation/end/manual writes are network-only (no offline activation queue).
- Flutter routes put the admin/designation console under `/admin/*` (dashboard/users/settings/audit-logs/server-status/system-reports/search); `/faculty/*` keeps classroom surfaces and the shared `/assistant`, `/profile`, `/notifications`, `/privacy` routes. Kiosk is intentionally absent. The guard ladder is `restore → auth → role → mustChangePassword → maintenance → shared → role section` and treats `/faculty`/`/student` as redirects to their dashboards.
- The Flutter scanner verifies token shape/window/meeting PIN/geofence locally but leaves Ed25519 signature verification to the backend; in-person upload/manual QR fallbacks are opt-in while online sessions always allow them.

## Relevant Files
- `shared/src/types/session.ts` — Session now has `qrValidityMinutes`, `qrGeneratedAt?`; removed `tokenWindowSeconds`
- `shared/src/types/attendance.ts` — AttendanceStatus includes `'disputed'`; AttendanceRecord has `manuallySet?`; AttendanceSummary has `disputed`
- `shared/src/validation/index.ts` — SessionCreateSchema enforces `qrValidityMinutes` (1–15) and `gracePeriodMinutes` (0–60)
- `shared/src/utils/token.ts` — `isTokenInValidityWindow` replaces `isTokenExpired`; `createQRTokenData` takes `validityMinutes` + `gracePeriodMinutes`
- `android/services/api-client.ts` — real NestJS HTTP client with SQLite-backed offline behavior
- `android/metro.config.js` — required NativeWind v5 / react-native-css Metro wiring (transformer + resolver); must stay tracked for EAS
- `scripts/verify-tracked-build-files.mjs` — CI gate: release-critical files are present, tracked, and not ignored
- `scripts/verify-android-bundle-styles.mjs` — CI gate: production Android export contains the compiled NativeWind stylesheet fingerprint
- `scripts/build-shared-if-available.mjs` — guarded root postinstall that builds `@polycheck/shared` only when sources/tooling exist
- `android/jest.config.js` — in-band Android test execution (Windows jest-worker shutdown race)
- `plan/apk-readiness-plan.md` — executed APK readiness plan + deviations
- `android/services/api-config.ts` — device-safe backend URL resolution
- `frontend/src/lib/api-client.ts` — real NestJS HTTP client
- `frontend/src/lib/api-config.ts` — browser backend URL configuration
- `android/app/(faculty)/sessions/[id].tsx` — full overhaul: QR gen, student roster, manual override, end session, countdown
- `android/app/(tabs)/scan.tsx` — wired `CameraView` QR scanning + manual code entry
- `android/app/(faculty)/disputes.tsx` — new dispute review screen with accept/reject/override
- `android/app/(faculty)/_layout.tsx` — added disputes tab with `gavel` icon
- `android/app/(faculty)/dashboard.tsx` — fixed subject card navigation to `subjects/[id]`
- `android/app/(faculty)/sessions/create.tsx` — `qrValidity` replaces `tokenWindow` (VALIDITY_OPTIONS 5–60 min)
- `frontend/src/app/faculty/sessions/[id]/page.tsx` — new session activation page (QR gen, student roster, end session)
- `frontend/src/app/faculty/disputes/page.tsx` — new dispute review page
- `frontend/src/components/layout/sidebar.tsx` — added "Disputes" nav item with `Gavel` icon
- `frontend/src/app/faculty/sessions/create/page.tsx` — removed grace/validity sliders, Santa Maria defaults
- `frontend/src/app/faculty/page.tsx` — disputes count now uses `api.getDisputedRecords().length`
- `frontend/src/components/MapPicker.tsx` — Santa Maria default, "Use My Location" button
- `frontend/src/components/ScanQrModal.tsx` — full student QR scan (camera/upload/manual)
- `frontend/src/app/faculty/students/[id]/page.tsx` — 3D ID flip card rewrite
- `android/app/(faculty)/sessions/create.tsx` — removed sliders, Santa Maria defaults, use-my-location
- `android/app/(faculty)/sessions/[id].tsx` — expanded QR prompt, state prefill with grace/validity
- `android/components/MapView.tsx` — recenterSignal prop, marker/viewport effects
- `backend/src/sessions/dto/create-session.dto.ts` — DTO field optionality, ActivateSessionDto grace param
- `backend/src/sessions/sessions.service.ts` — defaults on create, grace storage at activate, auto-expiry cron
- `backend/src/attendance/attendance.service.ts` — ensureOfflineActivation relaxed grace check
- `backend/src/users/device-binding.service.ts` — both-channel device-integrity login gate (cooldown + active-session), session device stamping/purge, logout-armed cooldown, unregister, effective teacher permissions
- `backend/src/users/password-generator.ts` — server-side `PUP-…` temporary credential generator
- `backend/src/users/users.service.ts` — delegated reset/release/contacts, generated credentials, permission overrides
- `backend/prisma/migrations/20261030120000_account_governance_device_binding/` — device/permission columns + governance settings seeds
- `frontend/src/components/faculty/StudentGovernanceActions.tsx` — shared teacher reset/release actions
- `frontend/src/components/profile/` — universal profile page, password/contacts/device panels
- `frontend/src/components/admin/credential-result-dialog.tsx` — one-time temporary credential modal with copy
- `android/app/profile.tsx` — universal mobile profile + unregister flow
- `android/app/(faculty)/student/[id].tsx` — mobile teacher reset/release actions and credential sheets
- `shared/src/utils/permissions.ts` — effective-permission merge + cooldown countdown helpers
- `backend/src/reports/reports.service.ts` — issue intake service: rate limits, telemetry stamping, fail-open screenshot/audit, triage + notifications
- `backend/prisma/migrations/20261031120000_system_reports_and_feedback/` — SystemReport model + enums + indexes
- `frontend/src/app/faculty/system-reports/page.tsx` — super-admin triage cockpit
- `frontend/src/components/reports/ReportIssueDialog.tsx` — accessible intake dialog (sidebar + profile host)
- `frontend/src/components/reports/MyReportsPanel.tsx` — profile "My reports" tab
- `frontend/src/lib/report-telemetry.ts` — pure web diagnostics capture
- `android/app/report-issue.tsx` — mobile intake screen (More-sheet + profile entry)
- `android/app/(faculty)/system-reports.tsx` — mobile triage cockpit
- `android/lib/base64.ts` — RFC-4648 encoder for auth'd screenshot streaming





- `shared/src/utils/pin-hash.ts` — PBKDF2 meeting-PIN hashing/verification + CSPRNG PIN generation (`@noble/hashes@1.8`)
- `shared/src/utils/token.ts` — token normalization, `validitySeconds` window support, checkpoint/pin payload extras
- `backend/prisma/migrations/20261101120000_hybrid_mode_dual_checkpoint/` — session modes, dual checkpoints, `autoEndAt`, nullable coordinates, per-leg attempt FKs
- `backend/src/attendance/resolution.ts` — dual-checkpoint status matrix shared by `end()` and the auto-end cron
- `backend/src/attendance/scan-validator.service.ts` — online zero-GPS branch + meeting-PIN gate + per-checkpoint token matching
- `backend/src/sessions/sessions.service.ts` — dual-arm activation, bounded regeneration, `autoEndAt`, cache TTL from the deadline
- `frontend/src/app/faculty/sessions/[id]/page.tsx` — two-step online cockpit with PIN toggle/announce chip and per-leg roster badges
- `frontend/src/components/ScanQrModal.tsx` — mode-aware scan (no geolocation online) + meeting-PIN phase
- `android/app/(faculty)/sessions/[id].tsx` — online cockpit parity (dual steps, PIN sheet, zero-GPS card)
- `android/app/(tabs)/scan.tsx` — location suppression for online tokens, PIN modal, mode-aware screenshot fallbacks
- `android/hooks/qr-fallback-policy.ts` — `shouldShowScanFallbacks` (online always allows screenshot/manual)
- `e2e/hybrid-attendance.spec.ts` — online checkpoint arming + zero-GPS PIN scan journey

- `frontend/src/components/AuthSessionMonitor.tsx` — module-scope replacement verifier: own-login window skip + `/auth/me` probe before destructive logout
- `frontend/src/lib/api-client.ts` — `isOwnLoginInFlight`/`noteLoginStarted`/`clearLoginInFlight` in-flight login tracking on both login methods
- `android/lib/session-replacement.ts` — `shouldTerminateForReplacedSession` decision helper (in-flight window + `/auth/me` probe)
- `android/services/api-client.ts` — same in-flight tracking helpers on `loginStudent`/`loginFaculty`
- `android/__tests__/session-replacement.test.ts` — self-signal/probe/network-failure cases
- `android/app/_layout.tsx` — root-layout monitor now terminates only via the verified helper
- `e2e/auth.spec.ts` — new re-login-from-signed-in-browser journey + GOV Profile sidebar expectation fix
- `backend/src/auth/session-policy.ts` — login never bumps `authVersion`/deletes siblings/broadcasts; `purge-same-device` for students; revocation generation checks unchanged
- `backend/src/auth/session-policy.spec.ts` — role × active × generation matrix + broadcast gate
- `backend/src/auth/better-auth.service.ts` — session `create` hooks consume the policy
- backend/test note — `auth.service.spec.ts` asserts student logins emit **no** `auth.session-replaced` broadcast (revocations only)

- `backend/src/attendance/resolution.ts` (+spec) — `endArmed` branch: never-armed online closes keep check-in credit
- `backend/src/sessions/sessions.service.ts` — V1 endArmed derivation (pre-claim) + V4 `assertTeacherAtClassroom` gate/audit
- `backend/src/attendance/attendance.service.ts` — V2 `applyConcurrentSessionConflict` + env knobs + persistable conflict reason
- `backend/src/sections/{sections.service.ts,enrollment-import.service.ts}` — V3 tombstone gate/clear/upsert ordering
- `backend/prisma/migrations/20261102120000_enrollment_tombstone/` — `EnrollmentTombstone` DDL + FK cascade
- `shared/src/types/{attendance,api}.ts` — `concurrent_session_conflict` + `TeacherActivationLocation`
- `backend/src/common/{constants/error-codes.ts,config/env-validation.ts,filters/all-exceptions.filter.ts}` — new codes, env parsing, geofence-error forwarding
- `frontend/src/app/faculty/sessions/[id]/page.tsx` — one-shot geo capture + override alertdialog
- `frontend/src/lib/api-client.ts` — `generateQrCode` 4th param + ApiHttpError distance fields
- `android/app/(faculty)/sessions/[id].tsx` — expo-location fix + native override Alert
- `android/services/api-client.ts` — carried teacherLocation + ApiRequestError distance fields
- `e2e/hardening-fixes.spec.ts` — V2/V3/V4 journeys (Chromium/Firefox/WebKit)
- `android/lib/session-replacement.ts` — `shouldTerminateForReplacedSession` decision helper (in-flight window + `/auth/me` probe)
- `android/services/api-client.ts` — same in-flight tracking helpers on `loginStudent`/`loginFaculty`
- `android/__tests__/session-replacement.test.ts` — self-signal/probe/network-failure cases
- `android/app/_layout.tsx` — root-layout monitor now terminates only via the verified helper
- `e2e/auth.spec.ts` — new re-login-from-signed-in-browser journey + GOV Profile sidebar expectation fix
- `backend/src/auth/session-policy.ts` — login never bumps `authVersion`/deletes siblings/broadcasts; `purge-same-device` for students; revocation generation checks unchanged
- `backend/src/auth/session-policy.spec.ts` — role × active × generation matrix + broadcast gate
- `backend/src/auth/better-auth.service.ts` — session `create` hooks consume the policy
- backend/test note — `auth.service.spec.ts` asserts student logins emit **no** `auth.session-replaced` broadcast (revocations only)
- `shared/src/utils/designations.ts` - pure capability helpers (super-admin short-circuit, department oversight)
- `shared/src/types/maintenance.ts` - maintenance status/503 contracts, setting keys, status path, settings-changed event
- `shared/src/validation/maintenance.ts` - status/503 parsing + settings-input validation
- `backend/prisma/migrations/20261102120000_campus_designations_maintenance_mode/` - designation columns, partial designee index, maintenance setting seeds
- `backend/src/maintenance-mode/` - `SystemMaintenanceService` (Redis+2s memo, event invalidation, fail-open), `MaintenanceGuard` (post-auth, pre-rate-limit), public status controller
- `backend/src/common/guards/designations.guard.ts` + `common/decorators/require-designation.decorator.ts` - route-level suite gates
- `backend/src/common/designations/department-pin.ts` - registrar scope, account-admin scope, designation diff helpers
- `backend/src/auth/auth.service.ts` - login 503 interlock for all four login routes; designation flags in sanitized profiles
- `backend/src/settings/settings.service.ts` + `settings.controller.ts` - maintenance keys, audit + invalidation event, per-key IT policy
- `backend/src/attendance/attendance-scope.service.ts` - department-head scope branches (reports/excuses/at-risk/lists)
- `frontend/src/components/maintenance/` - Provider/Overlay/Page/Screen + countdown helpers
- `frontend/src/components/layout/sidebar.tsx` - capability-driven designee suites (super-admin list unchanged)
- `frontend/src/components/admin/user-profile-dialog.tsx` - designations editor + registrar restrictions
- `frontend/src/app/faculty/settings/settings-config.ts` + `page.tsx` - System tab, IT-only tab visibility, maintenance controls
- `frontend/src/app/faculty/at-risk/page.tsx` - department at-risk oversight
- `android/lib/maintenance.ts` - process-lifetime maintenance store + classifier + countdown
- `android/lib/more-items.ts` - pure More-sheet derivation for designations
- `android/components/maintenance/MaintenanceScreen.tsx` - offline preservation notice + exemption semantics
- `android/app/(faculty)/server-status.tsx` / `at-risk.tsx` - IT/Oversight parity screens
- `e2e/designations-maintenance.spec.ts` - IT/head/registrar isolation + maintenance open/close journey
- `android/__tests__/maintenance.test.ts` / `more-items.test.ts` - mobile designation/maintenance unit coverage
- `e2e/responsive.spec.ts` + `e2e/responsive-routes.ts` - 7-role × 4-viewport overflow gate over 37 routes (zero exemptions)
- `e2e/visual-capture.spec.ts` - mobile evidence captures for every route (gitignored `e2e/captures/mobile/`)
- `frontend/src/app/layout.tsx` - `viewportFit: 'cover'` for safe-area insets
- `frontend/src/app/globals.css` - <640px 16px form-control rule (iOS auto-zoom)
- `frontend/src/components/ui/input.tsx` - `text-base sm:text-sm` touch input sizing
- `frontend/src/components/FilterBar.tsx` - full-row filter fields on phones
- `frontend/src/components/layout/sidebar.tsx` - safe-area mobile chrome + 44px menu/close/bell targets
- `frontend/src/app/faculty/users/page.tsx` - desktop table (md+) + stacked cards (<md) with shared row actions and a matchMedia DOM gate
- `frontend/src/app/faculty/audit-logs/page.tsx` - desktop table (md+) + stacked cards (<md)
- `frontend/src/app/faculty/schedule/page.tsx` / `student/schedule/page.tsx` - month dot collapse + phone day panel; contained snap week + today autoscroll
- `frontend/src/components/student/StudentWeeklySchedule.tsx` - contained 7-column week on phones
- `frontend/src/app/globals.css` / `frontend/src/components/ui/input.tsx` - shared touch sizing primitives
- `plan/responsive-web-plan.md` - executed plan + addendum (harness matrix, deviations)
- `shared/src/utils/ledger.ts` - canonical chain hash math + `LedgerVerifyResult`
- `shared/src/utils/outage-simulator.ts` - flag store both clients' fetch guards consult
- `shared/src/utils/id-hologram.ts` - live-UTC stamp, device-chip masking, watermark line
- `shared/src/types/privacy.ts` - RA 10173 snapshot contract + data inventory constants
- `backend/src/attendance/ledger.service.ts` - fail-closed chain append (advisory lock) + verify
- `backend/src/attendance/attendance-forensics.service.ts` - timeline assembly + recommendation matrix
- `backend/src/attendance/attendance-referral.service.ts` - CHED referral state machine + scope
- `backend/src/docs/docs.service.ts` - class-record / CHED-notice / DPO-summary builders
- `backend/src/common/services/maintenance.service.ts` - nightly anchor (2AM) + telemetry shredder (3AM)
- `backend/src/settings/settings.service.ts` - `geolocation_retention_days` + privacy-center snapshot
- `backend/src/realtime/attendance.gateway.ts` - kiosk presence, `session:finale`, `attendance:anomaly`
- `backend/prisma/migrations/20261103120000_wow_attendance_hash_chain/` - chain columns + backfill script
- `backend/prisma/migrations/20261103130000_wow_privacy_center/` - retention setting seed
- `backend/prisma/migrations/20261103140000_wow_at_risk_referrals/` - `AtRiskReferral` model
- `frontend/src/app/faculty/sessions/[id]/kiosk/page.tsx` - projector stage, rings, ticker, finale
- `frontend/src/components/radar/GeofenceRadarModal.tsx` - live geofence radar (pins/counters/legend)
- `frontend/src/components/dev/OutageSimulator.tsx` - flag-gated arm/restore + receipt chip
- `frontend/src/components/disputes/DisputeTimeline.tsx` - forensic rail + recommendation chip
- `frontend/src/components/student/HologramOverlay.tsx` - sweep + live UTC watermark (both ID faces)
- `frontend/src/app/faculty/settings/` - privacy (RA 10173) read-only tab + retention field in System
- `frontend/src/app/faculty/audit-logs/page.tsx` - Verify Ledger Integrity button + result banner
- `frontend/src/app/faculty/at-risk/page.tsx` - CHED notice action + Referrals queue (all faculty)
- `android/components/HologramOverlay.tsx` / `DisputeTimeline.tsx` / `OutageSimulatorSheet.tsx` - mobile parity
- `android/lib/radar-overlay.ts` - attempt shaping + denied log + finale banner mapping
- `android/app/(faculty)/sessions/[id].tsx` - radar overlay + finale banner on the session map
- `android/app/(faculty)/audit-logs.tsx` - mobile ledger verify + banner
- `e2e/wow-suite.spec.ts` - the 8 defense journeys (ledger/timeline/radar/downloads/referral/privacy/outage/kiosk)
- `frontend/src/components/ui/pagination-bar.tsx` - reusable, accessible PUP-styled `PaginationBar` component with summary counts, responsive Prev/Next navigation, and page buttons. Integrated pagination across all faculty and department management views: Sessions directory (`faculty/sessions`), Excuses queue (`faculty/excuses`), Disputes console (`faculty/disputes`), At-Risk oversight (`faculty/at-risk`), Attendance overview (`faculty/attendance`), Reports (`faculty/reports`), Subjects grid (`faculty/subjects`), Section Sessions card (`faculty/sections/[id]`), and Subject Sessions list (`faculty/subjects/[id]/sessions`) with full test coverage.- `shared/src/constants/pup-courses.ts` - PUP Santa Maria course catalog (draft, confirm with registrar) + lookup/grouping helpers
- `shared/src/utils/section-label.ts` - `formatSectionHeading`/`sectionCourseLabel` shared section labels (course-aware)
- `backend/prisma/migrations/20261110120000_section_course/` - nullable `Section.course` (idempotent DDL, no backfill)
- `frontend/src/app/faculty/sections/create/page.tsx` - required catalog-backed Course selector (grouped options + "Other — specify manually")
- `frontend/src/lib/session-slots.ts` - pure class-meeting helpers (weekday math, slot labels, per-slot occurrence counting, payload shaping) + tests
- `frontend/src/app/faculty/sessions/create/page.tsx` - "Class meeting" selector (single) + per-slot bulk rows sending `slots`
- `frontend/src/lib/student-dispute.ts` - dispute description validation + typed submit-error describer + tests
- `frontend/src/components/student/StudentDashboardDialogs.tsx` - dispute dialog min-length/counter/submitting/`role=alert` + `other` reason
- `e2e/section-session-fixes.spec.ts` - course display + class-meeting selector/per-slot bulk + dispute submit regression journey
- `shared/src/types/device-integrity.ts` - `ActiveDeviceKind` + `DeviceIntegrityErrorPayload` (cooldown/active-session 403 bodies)
- `shared/src/utils/device-integrity.ts` - `formatCooldownCountdown(totalSeconds)` (`m:ss` / `h:mm:ss`, ceil)
- `backend/prisma/migrations/20261111120000_login_device_integrity/` - nullable `AuthSession.deviceId` + `(userId, deviceId)` index, nullable `User.cooldownDeviceId` (idempotent, no backfill)
- `backend/src/auth/dto/logout.dto.ts` - optional `deviceId` + `armDeviceCooldown` for student logout arming
- `frontend/src/components/auth/StudentLoginDeviceGate.tsx` - ticking cooldown panel + active-session explainer
- `frontend/src/lib/hooks/use-trusted-now.ts` - ticking trusted clock from the `/health` offset
- `frontend/src/app/(auth-landing)/login/student/page.tsx` - device-integrity gate states on the student login page
- `e2e/device-integrity.spec.ts` - two-browser gate → logout cooldown → same-device instant → teacher release journey
- `e2e/helpers.ts` - `installSessionCleanup()`, non-arming `apiLogout`, `getWebDeviceId`, `releaseStudentDevice`
- `polycheck_mobile/lib/src/core/polycheck_core.dart` - Flutter core barrel (models, api, network, providers, router, sync, theme, utils, widgets)
- `polycheck_mobile/lib/src/core/router/router_decision.dart` + `core/router/routes/*.dart` - pure guard ladder + auth/student/faculty/admin/surface route tables
- `polycheck_mobile/lib/src/core/sync/sync_engine.dart` + `attendance_pin_vault.dart` + `sync_lifecycle_binder.dart` - offline drain, receipt reconciliation, process-memory PIN vault, resume/reconnect triggers
- `polycheck_mobile/lib/src/core/providers/trusted_clock.dart` - persisted `/health` midpoint offset + `TrustedClock.now`
- `polycheck_mobile/lib/src/features/student/data/student_scan_service.dart` + `features/student/presentation/scan/student_scan_screen.dart` - scanner pipeline (window/PIN/geofence/queue) + camera/upload/manual UI
- `polycheck_mobile/lib/src/features/faculty/data/teacher_signing_key.dart` - Ed25519 key provisioning + token signing parity
- `polycheck_mobile/lib/src/features/faculty/presentation/session_cockpit_screen.dart` + `widgets/qr_token_panel.dart` - dual-checkpoint cockpit, `QrImageView`, fullscreen QR/PIN stage, realtime + overrides
- `polycheck_mobile/lib/src/features/faculty/data/session_wizard.dart` + `core/utils/session_slots.dart` - slot-aware bulk session payloads
- `polycheck_mobile/lib/src/features/admin/domain/admin_access.dart` - designation capability matrix (K13)
- `polycheck_mobile/lib/src/features/surface/data/notification_links.dart` - notification type → deep-link map
- `polycheck_mobile/lib/src/core/network/api_config.dart` - `PUP_API_BASE_URL` / `PUP_WS_BASE_URL` + Socket.IO namespace derivation
- `polycheck_mobile/android/app/build.gradle.kts` + `android/app/proguard-rules.pro` - opt-in release keystore with debug fallback, R8 rules
- `polycheck_mobile/RELEASE.md` - version/signing/Play data-safety runbook

### Done (cont.)
- **Flutter mobile hardening wave (W1/W2 — parity with the RN reference):** ported the RN anti-cheat layer 1:1 into `polycheck_mobile/`: `core/utils/device_security.dart` (runtime root/hook/emulator probes — same path lists and heuristics as `android/services/device-security.ts`; sent with every scan and replayed batch, flagged scans marked for instructor review), offline **Ed25519 local verification** before queueing (`verifyToken` in `token_crypto.dart`; forged tokens refuse with "QR token signature is invalid"), server-parity **50 m accuracy** + **2 min staleness** gates (−30 s tolerance) with RN error copy, trusted-clock-derived `locationCapturedAt`, cached "already saved" short-circuit, **encrypted offline PIN persistence** (drift schema v2 `pinEncrypted`, AES-256-GCM, key `polycheck.offline-encryption-key.v1` — cold-start drains now replay PIN-protected scans), 30 s foreground drain timer, per-row retry (`SyncController.retryOne`), and the `auth:session-replaced` **realtime termination monitor** (in-flight-login skip + `/auth/me` probe, RN copy). UX parity: offline prep orchestrator + web-parity `READY FOR OFFLINE CLASS` chip ("Prepare for offline class" → caches subjects/sections/sessions/attendance/clock), dashboard sync panel with last-sync/issues/per-row retry, admin console back buttons + fallback leading, student sign-out confirmations (profile + dashboard, shared `confirmSignOut`), student **month schedule** tab with day dots + drilldown, and the cockpit **denied-attempts log**. Residual deferrals: offline session activation/end queue, FCM push. Verified: `flutter analyze` 0, **570 tests**, debug APK builds, `android/` byte-identical. Gap evidence in `documentation/flutter-parity-gap-report.md`.

### Done (cont.)
- **Flutter bug sweep (FIX1–FIX7)**: dialog-context fix for the sign-out crash (root cause: caller-context pop on nested shell navigator → go_router empties matches → blank screen + `logout()` never ran, leaving the server session alive); nested-shell test harness replaces the flat-router test that hid it; profile gained a real back path (tab switching is local-state, stackless landings get a fallback back arrow) and lost the duplicate floating pills (Assistant moved to the AppBar); student dashboard gained **My classes** (max 4 + View all, officer chips, rate bars) with a `/student/subjects` list route; gate explainer now tells wiped-device students how the seat is freed; faculty gained a ShellRoute bottom nav (Dashboard · Subjects · Sessions · Disputes) + More sheet with designation-gated consoles; date-bound month test made clock-injectable and off-schedule sessions plot instead of crashing; remaining caller-context dialog pops converted (profile unregister, assistant delete, admin user sheet). Verified: `flutter analyze` 0 · **620/620 tests** · debug APK builds · `android/` byte-identical.

### Done (cont.)
- **Flutter device-bug round 2 (six fixes)**: roster deserialization crash — `GET /sections/:id/students` omits `role`, Flutter `User.role` was a required cast → `Null is not a subtype of String` on BOTH section detail and session cockpit (plus a latent global-search site); fixed via `@Default(UserRole.student)` + regenerated freezed/json (unknown wire values still fail loud) and a `models_contract_test` with recorded backend serializer snapshots (roster row, `presentSection` ±course, Session `present()` in_person/online, AttendanceRecord nullables). Course picker rebuilt as a stateful sheet — 65% height cap (`showCampusBottomSheet(maxHeight:)` global), live code/name search, group headers, manual path always reachable. Student schedule sliver crash died via `ValueKey(_view)` + hoisting the month watches to screen level (both branches plain widgets). New shared `core/widgets/`: `campus_month_cell.dart` (faculty 54px geometry, maroon-today fill, `+N` dot overflow; consumed by both faculty + student grids with per-scope dot palettes) and `campus_bottom_nav.dart` (full-width flat bar, hairline top, gold edge indicator; both shells consume; faculty floating-box styling deleted). Officer permission staleness: `studentSectionDetail/SessionDetail` providers now `autoDispose` + screens invalidate on init, tri-state `OfficerPermissionCheck` (authorized/denied/errored) with a "couldn't verify — tap to retry" banner instead of fake denial. Verified: analyze 0 · **663/663 tests** · android byte-identical. Suggested backend one-liner (owner's call, not shipped): add `role: 'student'` to the roster row map in `sections.service.ts:238-241`.

### Done (cont.)
- **Flutter device-bug sweep 2 (SW-1–SW-7)**: admin console gained a shared `CampusBottomNav` shell (per-designation items from `adminSectionsFor`, popup overflow, registrar popup-only); profile lost the duplicate Notifications tab (bell/`?tab=notifications` now push the notification center with a back arrow); assistant gained stackless-back fallback; scanner manual-token/PIN dialogs now own their controllers in `State` (fixes the `_dependents.isEmpty` crash caused by disposing a `TextEditingController` while the dialog exit transition was still mounted — proven red→green by a new widget test) and the confirm label is `SUBMIT CHECK-IN TOKEN`; offline signature failures now distinguish a missing cached teacher key ("Reconnect once and run Prepare for offline class") from a bad signature, readiness checks `hasVerifiableKeys` (32-byte b64url) and shows `KEY MISSING — PREPARE ONLINE AGAIN`, prep records a `teacher_key` failure, and a TS(tweetnacl)→Dart fixture test pins the crypto math; offline banner extracted to a provider and the scanner header pads the strip. Verified: analyze 0 · **710/710 tests** · debug APK built · `android/` untouched.

### Done (cont.)
- **Defense-Day Bugfix Plan executed (`plan/defense-day-bugfix-plan.md`, DD-1–DD-6, 60 findings):**
  - **Flutter offline engine (DD-F1–F4, F9, F16, F19–F21)**: drift schema v3 adds `inputChannel` + `locationCapturedAt` with an idempotent v2→v3 migration (v1→v3 in one open); the replay payload is now byte-parity with the live `POST /attendance/scan` body, so the backend `missingCoreEvidence` gate no longer stamps every replay `disputed / missing_scan_evidence`; in-person rows carry the trusted fix timestamp while online stays location-free (RA 10173). Disputed receipts reconcile to new `AttendanceSyncStatus.confirmedFlagged` (+`SyncDrainReport.flagged`, "synced — flagged for instructor review" copy, panel renders them distinctly with no retry). 4xx classification terminalizes only `{400, 409, 422}`; 403 privacy-consent (notice-version bump), 404, 405 and 413 release the claimed rows to retryable with backoff — a consent bump can no longer destroy up to 25 queued check-ins. In-flight drains are keyed per owner (a foreign future is never joined; `ownerChanged` has honest copy), `retryOne` awaits then re-drains, the staleness tolerance applies only to the clock-ahead side, and prep steps catch `on Object`.
  - **Flutter faculty/scan UX (DD-F5–F18)**: schedule day/event sheets own their context (no caller-context pop); dispute override clamped to present/late/absent; cockpit ticker stored + cancelled + visibility-gated; cockpit realtime self-heals with capped backoff, never overlapping sockets, and re-reads the token on every connect (`setAuthFn`); at-risk gained mounted guards + `on Object`; end-of-session summary separates disputed/excused buckets; torch state reads from the controller; Restore & replay triggers a drain; month fetch falls back to cache with a retry banner; notification realtime is guarded.
  - **Dispute-reason contract (DD-C3)**: `missing_scan_evidence` **and** `implausible_client_timestamp` added to the shared union, the Dart enum, and both clients' label/icon maps, with unknown-value fallbacks — a wire value can no longer crash the web Disputes page (\"Element type is invalid\") or blank the Flutter disputes list (`UnknownApiValue`).
  - **Web offline engine (DD-W1–W4, W24–W26, DD-C4)**: offline window/`present`/`late` decisions use the cached `/health` offset and fail closed when it is absent; the accuracy policy mirrors the server (500 m); the not-synced check precedes signature verification; terminal results delete the phantom cached row; drain-on-mount with capped backoff that continues past retryable rows; `logout()` is queue-preserving by default with `requestUserLogout()` prompting when rows are pending (all user-initiated handlers wired; programmatic/replaced-session termination never wipes); service worker **v2** caches only `/api/health` behind a credential guard and answers `CLEAR_API_CACHE` on logout/account switch; `EditableAttendanceStatus`/`ResolvableAttendanceStatus` narrow the client contract to the backend DTO allowlists.
  - **Web pages (DD-W5–W23, W27, W28)**: one shared `useRunMutation` (in-flight dedupe + notification + per-action busy) across ~20 mutations; every init/fetch chain ends in a rendered error state with retry instead of a permanent spinner, a blank `return null`, or a silent empty list; search debounced 300 ms behind a monotonic guard; settings use `Promise.allSettled` per key; cockpit back link replaces `router.back()`; manual records send nullable coordinates; `deriveSessionStatus` drives badges and `STATUS_CYCLE` includes `incomplete`; the session-create duplicate check is sequenced (a stale response can no longer disable submit); the kiosk applies per-record status deltas.
  - **Backend (DD-C1, DD-C2, DD-B1–DD-B7)**: scan-armed offline activation now writes `autoEndAt`, so the cron ends the session and resolves the roster instead of leaving every row `pending` forever; offline online check-outs replayed after close land `delayed_offline_sync` instead of `checkpoint_not_armed`; disputes stamp `disputePreviousStatus` (migration `20261112120000_dispute_previous_status`) so `reject` restores `late`/`present` rather than forcing `absent`; new `common/utils/attendance-rate.ts` is the single source of truth for at-risk, `/me/standing`, the class-record grid and the CHED notice (denominator includes `incomplete`); offline clock-behind replays land `disputed / implausible_client_timestamp`; `UpdateSectionDto` validates weekday + `HH:mm`; a manual `pending` is rejected at the DTO; department scope is case-insensitive in every admin-scope fragment; `GET /reports/export` accepts `department` with the reports-list scope rule; roster rows carry `role: 'student'`.
  - **Verification**: shared **202 / 18 files**, backend **1059 / 84 suites**, web **502 / 76 files**, Flutter **749**; backend `typecheck` + `lint:check` + `format:check` + `prisma validate`/`generate`, frontend `tsc --noEmit` + eslint (0 problems) + `next build`, `dart format lib test` (369 files, 0 changed) + `flutter analyze` 0, and root `pnpm build` all clean. `android/` is untouched. DB-level behaviour was subsequently verified against a real Postgres (see the live-verification bullet below); the Flutter app was not run against a backend (no device attached).
  - Note: the drift "`AppDatabase` created multiple times" warning in `test/router/app_router_test.dart` is a pre-existing test-harness artifact (the provider is a singleton per container and closes via `ref.onDispose`), not a leak.
  - **Live verification (local Docker stack, 2026-11-12)**: the compose stack was rebuilt and brought up (postgres/redis/migrate/seed/backend/frontend healthy); migration `20261112120000_dispute_previous_status` applied against real Postgres (**27 applied**) and the `disputePreviousStatus` enum column exists. A 27-check API smoke against the running server passed 27/27 — roster `role`, section PATCH 400s for `day:"Funday"` and `"9:00"` (valid body still 200), `GET /reports/export?department=CCIS` 200 with rows, the full dispute flow (file → `disputed` + stamped previous status → teacher `reject` → restored `late`, not `absent`), `/me/standing` vs `/attendance/at-risk` agreeing on rate **and** status with one `incomplete`, and the auto-end cron ending a seeded session with 13 pending rows leaving **0 pending** (resolved `absent`). Running the full Chromium E2E file set exposed **five failures, all triaged to test/env causes rather than product regressions**: two were pre-existing spec bugs (`section-session-fixes.spec.ts` never authenticated its Playwright `request` context; its bulk assertion assumed 2027 rows appear on page 1 of the now-paginated list), one pinned the old 3-state `STATUS_CYCLE` that DD-W23 intentionally extended to four, one was data pollution from the smoke script, and one was the hash-chain backfill never running from the seed (Deviation 8) — after repairing the specs, scoping the assertion with `?sectionId=`, resetting the volume, and running the backfill, the previously-failing tests pass.
  - **Ledger truth + residual E2E fixes (same day, follow-up wave)**: the seed now chains history — `backfillAttendanceLedger(prisma)` is exported and awaited at the end of `prisma/seed.ts`, so a fresh volume logs "Attendance ledger backfill: 2 sessions inspected, 9 rows chained" and verifies **9/9 hashed** with no manual step. `LedgerVerifyResult` gained `status: 'verified' | 'broken' | 'insufficient_data'` + `unhashedRecords` (optional for the read-only RN fixtures); `verify` now returns `insufficient_data` with `verified: false` instead of claiming integrity over zero checked rows, and web + Flutter render three distinct banner states. **A real chain-corruption bug was found by the E2E run**: `resolution.ts` (both status matrices) and `sessions.service.ts` (expired activation) rewrote `timestamp` when collapsing `pending` → `absent`, and `timestamp` is part of the hash preimage while `appendLedger` is a no-op once hashed — so *every session ended with unscanned students silently broke its own chain*. All three paths now preserve the timestamp (the session's `endedAt` records resolution time) and the three specs that pinned the old shape were re-pinned. Playwright isolation was fixed at the cause: `student.spec.ts` logged a disposable student into the **same browser context**, replacing the cookie so teardown could only revoke the disposable session and the seeded student's row survived the file, poisoning later unidentified logins with `403 active_session_elsewhere`; new `revokeBrowserSession(page)` is called before every in-context account switch and `apiLoginStudent` uses a stable `web-e2e-api-context` device id with a one-shot self-heal. Backend after the fixes: **1063 tests / 85 suites, all passing**; `android/app/(faculty)/disputes.tsx` gained the two new `DisputeReason` entries so the RN reference app typechecks again.
  - **The app's first E2E layer (`polycheck_mobile/integration_test/`)**: `integration_test` SDK package only (no new pub deps), a `--dart-define` base URL (default `http://10.0.2.2:4000/api`), disposable teacher/student/section/session fixtures, a `ProviderContainer` wired to the real drift DB + real API client, and a guard that fails if the app client and harness target different backends. **4/4 tests pass on `emulator-5554` against the live stack**: (1) offline in-person scan — teacher signs a token locally with the app's Ed25519 key, student scans with the outage simulator armed, row lands in the encrypted Drift queue carrying `inputChannel` + `locationCapturedAt`, disarm → real `SyncEngine` drain → **server row `status: present`** with real coordinates (proving DD-F1/F2 end to end); (2) authoritative sign-out preserves the queue and owner keys then drains to `present`, while the explicit user sign-out purges; (3) portal login with a disposable student lands on the dashboard. Runbook: `polycheck_mobile/INTEGRATION_TESTS.md`. Two `lib/` bugs were fixed on the way: `sync_lifecycle_binder.dart` read `ref` inside `State.dispose()` (Riverpod 3 throws on any teardown with `bootstrap: true`) — the monitor is now captured in `initState` and stopped from the field; and `test/features/student/officer_permission_test.dart` was a **time bomb** (its only fixture hardcoded `expiresAt: 2026-11-11T18:00:00Z`, so four "authorized" cases flipped to `denied` the moment that instant passed) — now relative to `now`.
  - **Final full gates after all of the above**: Chromium E2E **121 passed / 0 failed / 5 skipped** over 126 tests (every previously red spec green, including F9 on a fresh 9/9-chained ledger); backend **1063 / 85 suites**; shared **202 / 18**; frontend `tsc --noEmit` + eslint clean; Flutter `dart format` 377 files 0 changed + `flutter analyze` 0 + **4/4 device integration tests**; root `pnpm build` 3/3.


### Done (cont.)
- **Ingestion Gateway Multi-Core Scaling (`plan/ingest-gateway-scaling-plan.md`, executed 2026-11-14)**:
  - **Root cause found by profiling**: `tweetnacl`'s pure-JS Ed25519 verify costs ~16 ms of CPU per token (V8 profile: >90 % of sampled CPU), which — not only single-core scheduling — explains the baseline p50 1.65 s / 13.11 % timeouts at 15 s. New Node-only entry `@polycheck/shared/token-node` (`shared/src/utils/token-node.ts`) verifies the same token format with `node:crypto` + a cached SPKI KeyObject (~0.1 ms); the gateway scan path **and** the drainer's authoritative re-verify use it. `signQRToken` (tweetnacl) stays the signing path; the browser-safe shared root never re-exports the Node entry; a parity test signs with tweetnacl and verifies natively. The NestJS backend still uses the shared tweetnacl `verifyQRToken` (same optimization available later, not on this hot path).
  - **Roles + cluster**: `INGEST_ROLE=all|http|drain` (default `all` = previous behaviour). Role `http` runs a `node:cluster` primary that forks `INGEST_HTTP_WORKERS` (compose default 4) on the shared listening handle, respawns crashed workers (10 exits/60 s crash-loop guard), forwards SIGTERM, and aggregates worker metrics over IPC on `INGEST_METRICS_PORT` 4003. Compose now has `ingest` (http) + `ingest-drain` (single instance, `INGEST_CONSUMER_NAME: ingest-drain`, own `/health/ready` + `/metrics` on 4002) in both local and coolify files; `Dockerfile.ingest` unchanged.
  - **Stream lifecycle (drainer-owned)**: producers never trim (a backlog > cap would evict accepted-but-unwritten scans). The drainer trims on every tick (self-throttled 30 s): `XTRIM MAXLEN ~ 50000` when the PEL is empty, `XTRIM MINID <oldest pending>` when it is not, looping up to 20 rounds because Redis approximate trims are chunked (~10k/call) — an idle pass converged 100,003 → 50,002. `ingest_buffer_depth` now reports pending (XPENDING; true backlog) and `ingest_stream_length` reports XLEN; backpressure and `/health/ready` gate on pending. `XAUTOCLAIM` (30 s idle) at startup and on idle ticks reclaims entries stranded by dead consumers; restart replays its own PEL. Fixed the old `oldestPendingAgeSeconds` parsing bug (lag was permanently 0).
  - **Drainer throughput**: one multi-row `INSERT … ON CONFLICT DO NOTHING` + one batched `UPDATE … FROM (VALUES)` claim per session inside the same `pg_advisory_xact_lock` transaction (was ~4 ms/scan of per-row round trips); hashes computed sequentially in stream order, `createdAt` strictly increasing so the head read is deterministic, row-count mismatch rolls back and retries (fail closed); distinct sessions commit with bounded concurrency ≤ 4.
  - **Keep-alive**: Fastify has no `headersTimeout` option; server now sets `keepAliveTimeout: 72_000` explicitly and `server.headersTimeout = 73_000` (must exceed keep-alive; nginx upstream idle is 65 s).
  - **Verification**: ingest **69 tests / 8 files**, shared **202 / 18**, contract gate OK, typechecks clean. Live stack: `/health/ready` `{redis,buffer,lag}` = ok and drainer `{redis,drainer,writes}` = ok; `e2e-smoke.mjs` **17/17**; ledger verify `verified: true` (45,752 records, 0 broken); k6 200-VU cold-cache runs: **10k → p50 58–66 ms / p95 104–124 ms / 0 % failed / 3,112 rps**; **50k → median 48.9 ms / p95 79.2 ms / 0 % failed / 3,903 rps** (baseline: p50 1.65 s, 13.11 % timeouts, ~121 rps); `ingest_drain_failures_total` 0 throughout; stream idle at XLEN 50,002, pending 0. Rollback = `INGEST_ROLE=all` (single process) or dropping the `gateway` profile.

### Done (cont.)
- **Ingestion gateway hardening follow-up (same day)**:
  - **Writer integration suite**: `services/ingest/test/writer.integration.test.ts` — six Postgres-backed cases (insert chaining in arrival order, claiming an activation-seeded pending row in place incl. `createdAt` rewrite, duplicate suppression without rewriting the earlier decision, deterministic cross-batch head, failed signature stored `disputed`/`invalid_signature` with `disputePreviousStatus='pending'`, "earlier decision wins" for a resolved seed). Runs only when `DATABASE_URL` is set (CI verify job provides one with migrations) and skips otherwise; random fixture ids + `afterAll` cleanup.
  - **One head predicate**: `LedgerService.appendLedger` selects the session head by `(createdAt DESC, id DESC)` — the same rule as the drainer writer — instead of `(timestamp DESC, id DESC)`. `createdAt` is the write-order proxy; scan timestamps are payload (offline replays can arrive out of order). Ledger spec re-pinned; residual no-chain-position-column caveat documented in code (verification only requires each `prevHash` to reference an existing row).
  - **Backend native verification**: `scan-validator.service.ts` (every scan/sync), `attendance.service.ts` (offline activation), `sessions.service.ts` (activation token) and `attendance-forensics.service.ts` (dispute timeline) now call `verifyQRTokenNative`; specs rebind their mocks to the new entry. tweetnacl remains for web/Android and the root shared export.
  - **Backpressure tuning**: local compose `INGEST_MAX_BUFFER` default 150000 → 45000 (just below the 50k stream cap) now that the gauge measures pending (XPENDING), not retained XLEN.
  - **Verification**: ingest **75/75** (69 + 6 integration with `DATABASE_URL`; 6 skipped without), shared **202/202**, backend **1063/1063 (85 suites)**, contract gate OK; live backend scan + manual decision + ledger verify after the backend image rebuild.

### Done (cont.)
- **Two-core deployment profile + capacity-error mapping**:
  - **Sizing** (`docker-compose.local.yml`, all env-overridable): `INGEST_HTTP_WORKERS` 4 → **1**, `INGEST_CLUSTER_ENABLED` → **false**, `UV_THREADPOOL_SIZE` 16 → **4**, backend `connection_limit` 50 → **12**, `INGEST_DB_POOL_SIZE` 8 → **4**, and `cpus: ${SERVICE_CPU_LIMIT:-1.0}` on backend/ingest/ingest-drain so a stray run or benchmark degrades itself instead of the host. Two-container split kept (the drainer still isolates DB write latency from the HTTP loop).
  - **Capacity → 503**: `AllExceptionsFilter` maps pg-pool acquire timeouts (`timeout exceeded when trying to connect`, `Connection terminated due to connection timeout`) and Prisma `P2024` to **503 `database_busy`** with `retry-after: 5` + `retryAfterSeconds: 5`; a genuine outage (`Connection terminated unexpectedly`, `connection refused`) intentionally stays a 500 so it alerts. Four regression tests added (mapping ×3, non-mapping ×1).
  - **Login decision**: bcrypt cost 12 retained by explicit product call — ~400 ms/login, core-bound (~15–20 admitted logins/s/instance), 2,000 students ≈ 2 minutes if perfectly synchronized. Levers if that changes: cost 10 or more cores, not replicas on 2 cores.
  - **Verification**: backend **1067 tests / 85 suites** pass, typecheck clean, compose config valid, stack recreated at the new sizing with all three health probes green.
