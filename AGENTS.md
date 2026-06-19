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
