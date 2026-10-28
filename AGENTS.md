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
| Logging into absent student's account | Single active session per account (Better Auth) | Optional device binding |
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

### In Progress
- (none)

### Done (cont.)
- **Assistant Panel Redesign (`plan/assistant-panel-redesign-plan.md`, AP1–AP5 + AM1)**:
  - Web: shared `AssistantShell` with Dock (compact panel), Theater (centered `min(1120px, 92vw) × min(760px, 86vh)` overlay with scrim) and Focus (full-page) geometries; remembered per-device preference (default Dock); no global hotkey; Esc ladder; focus trap/`aria-modal`/scroll lock; role-aware bubble label/aria/tooltip.
  - Chat UX: markdown rendering (react-markdown + remark-gfm, token-styled tables/bold/lists, CSP-safe), collapsible tool activity, copy/regenerate/inline retry (regenerate re-runs the last user turn without duplicating it), stop-while-streaming + reconcile, attachment file cards with progress/check, smart scroll + jump pill, auto-grow composer with Stop, grouped messages and timestamps.
  - Threads: per-user Redis index (`ai:user-threads:<userId>`, 7-day TTL, cap 20, newest-first, title = first user message ≤60 chars) kept in sync from the thread-save path; `GET /ai/threads`, `DELETE /ai/threads/:id` (ownership-checked, audited); `ThreadsRail` in Theater/Focus.
  - Android parity: copy, collapsible activity, attachment cards, stop/reconcile, GFM tables via `react-native-markdown-display`, role empty-state parity.
  - Verification: backend 615 tests / 58 suites, web 183 / 30, Android 214 / 16, shared 87 / 5; typecheck/lint/format/build clean; live smoke on the rebuilt Docker stack (thread list → regenerate with a single user turn → delete).

### Blocked
- (none)

## Key Decisions
- Dark mode on mobile: use NativeWind `dark:` variants for static colors and `isDark` only where a native API requires a computed color value; never mix `className` and `style` on the same element.
- `Pressable` replaces `TouchableOpacity` for clickable list items to avoid scroll-touch interference.
- Timeline for session activation: Teacher generates QR (1–15 minutes) → scans within validity → Present; scans during the configured grace period (up to 60 minutes) → Late; after grace expiry the backend auto-ends the session and marks remaining Pending records Absent. A teacher can end the session earlier.
- `gracePeriodMinutes` is enforced by online validation, delayed offline validation, Redis TTLs, and the automatic expiry job.
- QR rendering uses `react-native-qrcode-svg` on mobile and `qrcode` on web so generated attendance tokens are scanner-compatible.
- `expo-sharing` + `react-native-svg` ref are used for sharing the QR image on mobile; web also supports token copy/download.
- Audit logging fails open: if the initial audit-row insert fails, the mutation still runs and the failure is logged with full request context (method, path, actor) rather than returning 500. This preserves in-class availability when the audit table is briefly unavailable; the trade-off (a possible missing audit row for that one mutation) is accepted and observable in logs. Audit completion/failure updates remain best-effort and merge request context.
- Signing-key rotation serializes against activation cache publication via the per-teacher `key-rotation:<id>` Redis lock; cache publication is best-effort and skips (DB fallback) when rotation holds the lock. Production image references must be `@sha256:` digests — tags are retargetable and rejected by `validate-production-images.sh`.

- **Auth Landing Animation & Layout Fix**: Moved auth pages from `app/login/` into `app/(auth-landing)/login/` (with role sub-routes `faculty` and `student`) within a shared route group. This preserves layout state and prevents full unmounts, restoring smooth CSS/motion animations and logo transitions when switching between login views.
- **Student Scan QR Fallback Options (Web & Mobile)**:
  - Web fallbacks are enabled by default (`NEXT_PUBLIC_ALLOW_QR_FALLBACKS !== 'false'`); mobile fallbacks are **opt-in** (`EXPO_PUBLIC_ALLOW_QR_FALLBACKS === 'true'` via `hooks/qr-fallback-policy.ts`) and pinned `false` in the EAS production profile.
  - Web modal (`ScanQrModal.tsx` & `ScanQrViews.tsx`) now exposes all 3 accessible check-in channels: **Camera**, **Upload Image** (local QR decoding via `BarcodeDetector` / ZXing with drag & drop and 10 MB file validation), and **Enter Token** (manual input / paste of teacher-signed QR token with whitespace and surrounding quote sanitization).
  - Both fallback channels strictly require and enforce client-side GPS location capture against classroom geofence before submission.
  - Added warning banner in upload view when camera permissions are denied or unavailable on the device.
  - Mobile scanner (`android/app/(tabs)/scan.tsx`) exposes `Upload QR Image` and `Enter Code` fallbacks alongside live camera.
- **Database Migration Self-Healing**: Added idempotent pre-checks and backfills in `20260907090000_domain_constraints/migration.sql` to gracefully handle dirty development databases or re-runs without crashing the migration service container.
- **Docker Compose Local Developer Experience**: Added automated 1-click startup scripts (`start-local.bat`, `start-local.sh`, `stop-local.bat`, `stop-local.sh`) and passed `NEXT_PUBLIC_ALLOW_QR_FALLBACKS: "true"` to local container builds.
- **Comprehensive Automated Test Coverage**: 1,338 total passing automated tests across 131 suites monorepo-wide (87 shared, 265 web, 679 backend, 307 mobile); the web E2E suite includes 198 tests across Chromium, Firefox, and WebKit (10 engine-specific skips). The AI assistant additions are covered by backend AI/docs/standing suites plus web and Android chat/standing tests.

## Next Steps
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

## Critical Context
- Android package: `edu.pup.polycheck`; iOS bundle: `edu.pup.polycheck`.
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

## Relevant Files
- `shared/src/types/session.ts` — Session now has `qrValidityMinutes`, `qrGeneratedAt?`; removed `tokenWindowSeconds`
- `shared/src/types/attendance.ts` — AttendanceStatus includes `'disputed'`; AttendanceRecord has `manuallySet?`; AttendanceSummary has `disputed`
- `shared/src/validation/index.ts` — SessionCreateSchema enforces `qrValidityMinutes` (1–15) and `gracePeriodMinutes` (0–60)
- `shared/src/utils/token.ts` — `isTokenInValidityWindow` replaces `isTokenExpired`; `createQRTokenData` takes `validityMinutes` + `gracePeriodMinutes`
- `android/services/api-client.ts` — real NestJS HTTP client with SQLite-backed offline behavior
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





