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
| Cloud database | PostgreSQL on Supabase |
| Local database | SQLite via expo-sqlite |
| Authentication | Better Auth (Next.js) + JWT (NestJS guards) |
| Monorepo | pnpm workspaces + Turborepo |
| Shared code | `@polycheck/shared` package |

## User Roles

### Super Admin
Department heads, program chairs, PUP officials. Highest access — sees data across all teachers and subjects. Manages teacher accounts, configures institution settings, generates reports. Does not manage day-to-day attendance.

### Admin (Teacher / Instructor)
Creates subjects, configures class schedules, generates QR codes per session, sets geofences, defines check-in time windows. Views attendance records for their classes. Flags anomalies.

### Student
Primary interface is the mobile app. Has a digital student ID. Views class schedules. Checks in by scanning teacher's QR code. Views own attendance history. Receives feedback on denied check-ins.

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

## Design System

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| Maroon (Primary) | `#7B1113` | Buttons, nav bars, headers, active states |
| Deep Maroon (Dark) | `#4A0A0B` | Hover/pressed states, sidebar, dark mode surfaces |
| Golden Yellow (Accent) | `#F5A800` | Highlights, badges, CTA emphasis, icons |
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
- Supabase RLS enforces role-based access:
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
- `@polycheck/shared` — shared types, utils, mock data
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
import { mockStudents, mockSubjects } from '@polycheck/shared/mock'
```

### API Client Pattern (both apps)
```typescript
// In development, import mock data directly
// In production, call the NestJS API
const useMockData = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
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
- Added 5 new mock students (s-009 to s-013) enrolled in subj-001, 8 new sessions (sess-007 to sess-014), and ~30 new attendance records.
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

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Dark mode on mobile: use `isDark` context + inline `style` for colors, not NativeWind `dark:` variants — `dark:` doesn't propagate across `react-native-screens` native view controllers on navigation mount.
- `Pressable` replaces `TouchableOpacity` for clickable list items to avoid scroll-touch interference.
- Timeline for session activation: Teacher generates QR (sets validity N minutes) → scans within N min → Present; after expiry → scans are Late; teacher presses End Session → all remaining Pending → Absent. Grace period is not a separate timer — it's the post-QR-expiry period until End Session.
- `gracePeriodMinutes` on Session is metadata/display; the grace period ends only when the teacher manually ends the session. No auto-absent on grace expiry.
- `MockQr` deterministic visual component used on both mobile (with `react-native-svg`) and web (with `svg`). Replaced `react-native-qrcode-svg` and `qrcode` npm packages to avoid native module build issues and dependency conflicts.
- `expo-sharing` + `react-native-svg` ref for sharing QR image on mobile; clipboard copy for token.

## Next Steps
- Add session list to section detail page (link or inline view connecting `sections/[id]` to `sessions/[id]`).
- Connect sessions page to section context when navigated from section detail.
- Implement enrollment management page for teachers to manually add/remove students via search.
- Add student self-enrollment flow (enter enrollment code).
- Add dispute notification badge on faculty sidebar/tab bar.
- Wire `isTokenInValidityWindow` util into mock API's `checkAttendance` for proper signed-timestamp validation.
- Add `disputed` badge styling to shared `StatusBadge` components on both platforms.

## Critical Context
- Android package: `edu.pup.polycheck`; iOS bundle: `edu.pup.polycheck`.
- Permissions: camera (QR scan), location (geofence check) — already requested in `scan.tsx` via `useCameraPermissions` + `expo-location`.
- Mock data: `mockStudents` has 13 entries (s-001 to s-013); `mockSubjects` has 4 parent entries (subj-001 to subj-004); `mockSections` has 5 sections (sec-001 to sec-005); `mockSessions` has 14 entries (sess-001 to sess-014); `mockAttendanceRecords` has 54 entries; `mockEnrollments` has 29 entries.
- `AttendanceRecord.status` now includes `'disputed'`. `AttendanceRecord` has optional `manuallySet?: boolean`. `AttendanceSummary` has `disputed: number`.
- `Session` no longer has `tokenWindowSeconds`; replaced by `qrValidityMinutes: number`. `qrGeneratedAt?: string` tracks when QR was generated.
- Mock API methods added: `generateQrCode`, `submitScan`, `endSession`, `getDisputedRecords`, `resolveDispute`.
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
- `shared/src/mock/sessions.ts` — all sessions updated with `qrValidityMinutes`
- `shared/src/mock/attendance.ts` — 3 new records (2 disputed, 1 manuallySet); summaries include `disputed`
- `android/services/mock-api.ts` — added `generateQrCode`, `submitScan`, `endSession`, `getDisputedRecords`, `resolveDispute`; updated `checkAttendance`, `createSession`; added Subject CRUD + Section CRUD
- `frontend/src/lib/mock-api.ts` — same additions as mobile mock API
- `android/app/(faculty)/sessions/[id].tsx` — full overhaul: QR gen, student roster, manual override, end session, countdown
- `android/app/(tabs)/scan.tsx` — wired `CameraView` QR scanning + manual code entry
- `android/app/(faculty)/disputes.tsx` — new dispute review screen with accept/reject/override
- `android/app/(faculty)/_layout.tsx` — added disputes tab with `gavel` icon
- `android/app/(faculty)/dashboard.tsx` — fixed subject card navigation to `subjects/[id]`
- `android/app/(faculty)/sessions/create.tsx` — `qrValidity` replaces `tokenWindow` (VALIDITY_OPTIONS 5–60 min)
- `frontend/src/app/faculty/sessions/[id]/page.tsx` — new session activation page (QR gen, student roster, end session)
- `frontend/src/app/faculty/disputes/page.tsx` — new dispute review page
- `frontend/src/components/layout/sidebar.tsx` — added "Disputes" nav item with `Gavel` icon
- `frontend/src/app/faculty/sessions/create/page.tsx` — `qrValidity` slider (5–60 min) replaces `tokenWindow`
- `frontend/src/app/faculty/page.tsx` — disputes count now uses `api.getDisputedRecords().length`
