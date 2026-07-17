# Polycheck — Unified Development Guide

## Project Overview

Polycheck is a unified web and mobile attendance management system for the Polytechnic University of the Philippines (PUP). It digitizes attendance through QR code scanning, geolocation verification, and biometric confirmation. It is built as an offline-first system, working fully without internet and syncing to the cloud when connectivity is available.

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
├── backend/                # NestJS API (not yet built)
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
| Authentication | Better Auth (Next.js) + JWT (NestJS guards) |
| Monorepo | pnpm workspaces + Turborepo |
| Shared code | `@polycheck/shared` package |

## User Roles

### Super Admin
Department heads, program chairs, PUP officials. Highest access — sees data across all teachers and subjects. Manages teacher accounts, configures institution settings, generates reports. Does not manage day-to-day attendance.

Super Admin capabilities are limited to scoped oversight, reports/exports, global search, user account administration (including teacher/student creation, status changes, and password resets), and institution settings. Super Admins have read-only access to classroom resources and must not create/update/delete subjects, sections, sessions, attendance, disputes, enrollment codes/rosters, section roles, QR tokens, or proof-of-class records.

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
| Logging into absent student's account | Single active session per account (Better Auth) | Device binding + biometric gate |
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
- Biometric gate before QR scanning
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
- **Validation**: `SessionCreateSchema` — removed `tokenWindowSeconds`, added `qrValidityMinutes` (min 1, max 180), added optional `endTime`, `room`.
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
- **Subject→Section refactor**: Split `Subject` type into `Subject` (parent/course: id, name, code, description) and `Section` (child/class instance: id, subjectId, section, room, schedule, semester, teacherId, teacherName, enrollmentCode, enrollmentCodeExpiry, studentCount). Updated `Session.sectionId`, `AttendanceRecord.sectionId`, `AttendanceSummary.sectionId`, `Enrollment.sectionId`, `Student.enrolledSectionIds`. Updated validation schemas with `SubjectCreateSchema` and `SectionCreateSchema`. Restructured mock data: 4 parent subjects + 5 sections with updated enrollments, sessions, attendance. Rewrote both mock APIs: `getSubjects()` (no args) + CRUD for parent Subject, `getSections()` + CRUD for child Section. Renamed methods: `getSubjectStudents` → `getSectionStudents`, `getSubjectSessions` → `getSectionSessions`, `getStudentAttendanceForSubject` → `getStudentAttendanceForSection`, `removeStudentFromSubject` → `removeStudentFromSection`. Installed `mock-qr` polyfill; replaced `react-native-qrcode-svg` and `qrcode` libs with custom `MockQr` deterministic visual component on both platforms. Fixed all 25 UI files across mobile and web for the new data model.
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

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Dark mode on mobile: use `isDark` context + inline `style` for colors, not NativeWind `dark:` variants — `dark:` doesn't propagate across `react-native-screens` native view controllers on navigation mount.
- `Pressable` replaces `TouchableOpacity` for clickable list items to avoid scroll-touch interference.
- Timeline for session activation: Teacher generates QR (sets validity N minutes) → scans within N min → Present; after expiry → scans are Late; teacher presses End Session → all remaining Pending → Absent. Grace period is not a separate timer — it's the post-QR-expiry period until End Session.
- `gracePeriodMinutes` on Session is metadata/display; the grace period ends only when the teacher manually ends the session. No auto-absent on grace expiry.
- QR rendering uses `react-native-qrcode-svg` on mobile and `qrcode` on web so generated attendance tokens are scanner-compatible.
- `expo-sharing` + `react-native-svg` ref are used for sharing the QR image on mobile; web also supports token copy/download.

## Next Steps
- Connect sessions page to section context when navigated from section detail.
- Add dispute notification badge on faculty sidebar/tab bar.
- Add offline sync engine for mobile (SQLite + background sync).
- Implement push notifications (Expo Notifications / web push).
- Add leave/excuse request workflow.
- Add academic calendar integration (semester dates, holidays).
- Add dark mode support parity across all pages.

## Critical Context
- Android package: `edu.pup.polycheck`; iOS bundle: `edu.pup.polycheck`.
- Permissions: camera (QR scan), location (geofence check) — already requested in `scan.tsx` via `useCameraPermissions` + `expo-location`.
- Runtime mock data has been removed. Web and mobile use the NestJS API; mobile retains only its SQLite offline cache and sync queue.
- `AttendanceRecord.status` now includes `'disputed'`. `AttendanceRecord` has optional `manuallySet?: boolean`. `AttendanceSummary` has `disputed: number`.
- `Session` no longer has `tokenWindowSeconds`; replaced by `qrValidityMinutes: number`. `qrGeneratedAt?: string` tracks when QR was generated.
- API client methods include `generateQrCode`, `submitScan`, `endSession`, `getDisputedRecords`, and `resolveDispute`.
- `createQRTokenData` signature changed: `(sessionId, subjectId, teacherId, teacherName, validityMinutes, gracePeriodMinutes)`. Note: `subjectId` param is actually `sectionId` in the new model; kept as `subjectId` for token backward compat.
- `isTokenInValidityWindow(payload, serverTimeMs?)` returns `{ valid: boolean, inGrace: boolean }`.
- Mobile QR rendering uses `MockQr` deterministic visual component (replaced `react-native-qrcode-svg`); web uses same `MockQr` component (replaced `qrcode` npm package).
- Mobile scan uses real `CameraView` with `onBarcodeScanned` from `expo-camera`.
- Faculty layout has a `disputes` tab with `gavel` icon.
- Grace period: after QR validity expires, scans are marked Late. It ends when teacher presses End Session (no auto-cutoff).

## Relevant Files
- `shared/src/types/session.ts` — Session now has `qrValidityMinutes`, `qrGeneratedAt?`; removed `tokenWindowSeconds`
- `shared/src/types/attendance.ts` — AttendanceStatus includes `'disputed'`; AttendanceRecord has `manuallySet?`; AttendanceSummary has `disputed`
- `shared/src/validation/index.ts` — SessionCreateSchema uses `qrValidityMinutes` (1–180), drops `tokenWindowSeconds`, adds optional `endTime`/`room`
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
