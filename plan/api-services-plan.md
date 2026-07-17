# Polycheck — API Services Plan

## Responsibility

This document is a reference for every REST endpoint the NestJS backend must expose. It is organized by NestJS module/domain. Each endpoint includes its method, path, auth requirement, inputs, and what it does.

This maps directly to the `ApiClient` interface in `@polycheck/shared/types/api.ts`.

---

## NestJS Module Structure

```
backend/src/
├── auth/               # Login, logout, key provisioning
├── users/              # User CRUD, teacher/student management
├── subjects/           # Subject (parent course) CRUD
├── sections/           # Section (class instance) CRUD + enrollment
├── sessions/           # Session lifecycle + QR generation
├── attendance/         # Attendance records, manual overrides
├── disputes/           # Dispute review and resolution
├── sync/               # Offline sync endpoint (async via BullMQ)
├── reports/            # Aggregated attendance summaries + CSV export
├── calendar/           # Calendar event aggregation
├── section-roles/      # President/QAC role assignment
├── session-permissions/# Temporary session access for students
├── proofs/             # Proof-of-class photo management
└── common/             # Guards, decorators, pipes, filters
```

---

## Auth Module (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login/student` | Public | Login with studentId + password |
| POST | `/auth/login/faculty` | Public | Login with email + password |
| POST | `/auth/logout` | JWT | Invalidate current session |
| GET | `/auth/me` | JWT | Get current user profile |
| POST | `/auth/provision-key` | JWT (teacher) | Upload ECDSA public key |
| POST | `/auth/refresh` | Refresh token | Get new access token |

---

## Users Module (`/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | JWT (super_admin) | List all users with role filter |
| GET | `/users/:id` | JWT | Get user by ID (own or admin) |
| POST | `/users` | JWT (super_admin) | Create teacher or student account |
| PATCH | `/users/:id` | JWT (super_admin \| own) | Update profile fields |
| DELETE | `/users/:id` | JWT (super_admin) | Deactivate account |
| GET | `/users/teachers` | JWT (super_admin) | List all teachers |
| GET | `/users/students` | JWT (teacher \| super_admin) | List students (scoped to teacher's sections) |

---

## Subjects Module (`/subjects`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/subjects` | JWT | List all subjects |
| GET | `/subjects/:id` | JWT | Get subject by ID |
| POST | `/subjects` | JWT (teacher \| super_admin) | Create subject |
| PATCH | `/subjects/:id` | JWT (teacher \| super_admin) | Update subject |
| DELETE | `/subjects/:id` | JWT (super_admin) | Delete subject |

---

## Sections Module (`/sections`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sections` | JWT | List sections (teacher: own; student: enrolled; admin: all) |
| GET | `/sections/:id` | JWT | Get section detail |
| POST | `/sections` | JWT (teacher) | Create section under a subject |
| PATCH | `/sections/:id` | JWT (teacher, own) | Update section |
| DELETE | `/sections/:id` | JWT (teacher, own) | Delete section |
| GET | `/sections/:id/students` | JWT (teacher, own) | List enrolled students with attendance summary |
| POST | `/sections/:id/enroll` | JWT (student) | Enroll via enrollment code |
| POST | `/sections/:id/enroll-student` | JWT (teacher, own) | Manually enroll a student |
| DELETE | `/sections/:id/students/:studentId` | JWT (teacher, own) | Remove student from section |
| POST | `/sections/:id/enrollment-code/reset` | JWT (teacher, own) | Regenerate enrollment code |
| POST | `/sections/:id/enrollment-code/disable` | JWT (teacher, own) | Disable enrollment code |
| GET | `/sections/:id/enrollments` | JWT (teacher, own) | List all enrollment records |

### Enrollment via Code

```
POST /sections/:id/enroll
Body: { enrollmentCode: string }
```

- Server fetches section by `id`
- Validates `section.enrollmentCode` matches, and `section.enrollmentCodeExpiry` > now
- Creates `Enrollment` row if not already enrolled (unique constraint prevents double-enroll)
- Increments `section.studentCount`

---

## Sessions Module (`/sessions`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sessions` | JWT | List sessions (teacher: own; student: enrolled sections) |
| GET | `/sessions/:id` | JWT | Get session detail |
| POST | `/sessions` | JWT (teacher) | Create single session |
| POST | `/sessions/bulk` | JWT (teacher) | Create recurring sessions |
| POST | `/sessions/:id/activate` | JWT (teacher, own) | Generate QR code — activates session |
| POST | `/sessions/:id/end` | JWT (teacher, own) | End session — clears QR, sets pending → absent |
| GET | `/sessions/:id/attendance` | JWT (teacher, own) | Get all attendance records for a session |

### Session Activation

```
POST /sessions/:id/activate
Body: { validityMinutes: number }
```

1. Fetch session, verify teacher owns it
2. Generate QR token: call `createQRTokenData(...)` — but in production, this signing happens on the device, not the server
3. On the server, the activation endpoint **stores** a server-generated reference token for display/tracking purposes only; the canonical signed token is generated on the device
4. Set `isActive = true`, `qrGeneratedAt`, `qrTokenExpiresAt`
5. Cache geofence in Redis with TTL = `qrValidityMinutes + gracePeriodMinutes + 30min`
6. Emit WebSocket event `session:activated` to teacher's room

**Important**: In the production offline flow, QR activation happens on the teacher's device without calling this endpoint. This endpoint handles the online activation path (teacher has internet). The two flows produce compatible records.

### Session End

```
POST /sessions/:id/end
```

1. Set `isActive = false`, clear `qrToken`, `qrGeneratedAt`, `qrTokenExpiresAt`
2. Bulk-update all `AttendanceRecord` with `status = 'pending'` for this session → `status = 'absent'`
3. Invalidate Redis geofence cache for this session
4. Emit WebSocket event `session:ended`

---

## Attendance Module (`/attendance`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/attendance` | JWT | List records (teacher: own sections; student: own only; admin: all) |
| GET | `/attendance/:id` | JWT | Get single record |
| PATCH | `/attendance/:id/status` | JWT (teacher, own section) | Manual status override |
| GET | `/attendance/summaries` | JWT | Get attendance summaries by section |
| GET | `/attendance/student/:studentId` | JWT | Get all records for a student |

### Manual Override

```
PATCH /attendance/:id/status
Body: { status: AttendanceStatus }
```

- Any `AttendanceStatus` value is valid (teacher has full override authority)
- Sets `manuallySet = true`
- If status was `disputed`, does NOT set `disputeResolved`; resolve via disputes endpoint

---

## Disputes Module (`/disputes`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/disputes` | JWT (teacher \| super_admin) | List disputed records (optional: filter by session, status) |
| POST | `/disputes` | JWT (student) | Submit a dispute for own record |
| POST | `/disputes/:recordId/resolve` | JWT (teacher, own section) | Accept / reject / override dispute |

### Submit Dispute

```
POST /disputes
Body: {
  recordId: string
  reason: DisputeReason
  description: string
}
```

- Fetches `AttendanceRecord` by `recordId`, verifies `studentId` matches JWT sub
- Sets `status = 'disputed'`, `disputeReason`, `disputeDescription`

### Resolve Dispute

```
POST /disputes/:recordId/resolve
Body: {
  resolution: 'accept' | 'reject' | 'override'
  newStatus?: AttendanceStatus    // required when resolution = 'override'
}
```

- `accept` → `status = 'present'`, `disputeResolved = true`
- `reject` → `status = 'absent'`, `disputeResolved = true`
- `override` → `status = newStatus`, `manuallySet = true`, `disputeResolved = true`

---

## Sync Module (`/sync`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/sync/attendance` | JWT (student) | Submit batch of offline attendance records |
| GET | `/sync/pre-session` | JWT (student) | Pull geofences, sessions, section data for offline cache |
| GET | `/sync/status/:jobId` | JWT | Poll async sync job result |

See `sync-plan.md` for full processing logic.

---

## Reports Module (`/reports`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/attendance` | JWT (teacher \| super_admin) | Attendance summary by section, filterable |
| GET | `/reports/export` | JWT (teacher \| super_admin) | Export attendance as CSV |
| GET | `/reports/overview` | JWT (super_admin) | Institution-wide attendance rates |

### Filters (query params for `/reports/attendance`)

```
?sectionId=&sessionId=&teacherId=&startDate=&endDate=&studentId=&status=
```

All filters are optional and combinable.

### CSV Export

```
GET /reports/export?sectionId=sec-001
```

Returns `Content-Type: text/csv` with `Content-Disposition: attachment; filename=attendance-sec-001.csv`.

CSV columns: `id, studentName, studentId, date, time, status, section, sessionId, disputed, notes`

---

## Calendar Module (`/calendar`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/calendar/events` | JWT | Get calendar events for date range |

```
GET /calendar/events?startDate=2026-06-01&endDate=2026-06-30
```

Server generates calendar events by cross-referencing enrolled sections' schedules against existing sessions. Matches `generateCalendarEvents()` logic from `@polycheck/shared/utils/calendar.ts`.

---

## Section Roles Module (`/section-roles`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/section-roles/:sectionId` | JWT (teacher, own) | List roles for a section |
| POST | `/section-roles` | JWT (teacher, own) | Assign president or qac to a student |
| DELETE | `/section-roles/:sectionId/:studentId/:role` | JWT (teacher, own) | Remove role |
| GET | `/section-roles/student/:studentId` | JWT | Get all roles for a student |

---

## Session Permissions Module (`/session-permissions`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/session-permissions` | JWT (teacher) | Grant temporary session permission to student |
| DELETE | `/session-permissions/:sectionId/:studentId` | JWT (teacher) | Revoke permission |
| GET | `/session-permissions/:sectionId` | JWT (teacher) | List active permissions for a section |
| GET | `/session-permissions/check/:sectionId/:studentId` | JWT | Check if student has active permission |

Permission expiry (`expiresAt`) is set to 24 hours from grant time. Lazy expiry on read: if `expiresAt < now`, treat as inactive.

---

## Proofs Module (`/proofs`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/proofs` | JWT (student with QAC role or session permission) | Upload proof-of-class photo |
| GET | `/proofs/:sessionId` | JWT (teacher, own) | List all proofs for a session |
| DELETE | `/proofs/:proofId` | JWT (teacher, own) | Delete a proof |

Photo upload accepts `multipart/form-data` with the image file. The server stores it to a cloud bucket and saves the URL in `ProofOfClass.photoUrl`.

---

## Search Endpoint

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search` | JWT (teacher \| super_admin) | Search across students, sections, sessions |

```
GET /search?q=Angela
```

Returns:
```ts
{
  students: Student[]
  sections: Section[]
  sessions: Session[]
}
```

---

## Error Handling Conventions

All endpoints return structured errors:

```ts
{
  statusCode: number
  error: string      // e.g. "Not Found", "Forbidden"
  message: string    // human-readable detail
}
```

Use NestJS built-in exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`) — they serialize to this shape automatically.

---

## Global Middleware and Pipes

- **Validation Pipe**: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` globally applied. DTOs use class-validator decorators.
- **Zod Validation**: Shared Zod schemas from `@polycheck/shared/validation` can be used in NestJS via `ZodValidationPipe` or manually in service methods.
- **Rate Limiting**: Applied globally via `@nestjs/throttler` backed by Redis. Auth endpoints have stricter limits (see `infra-plan.md`).
- **CORS**: Allow origins from the Next.js frontend URL and mobile app scheme. Restrict methods to `GET, POST, PATCH, DELETE`.

---

## Open Questions

- **Pagination**: Most list endpoints need pagination. Decide on a convention: `?page=1&limit=20` (offset-based) or cursor-based. Offset is simpler; cursor is more efficient for large datasets.
- **WebSocket gateway location**: The WebSocket gateway is part of the sessions module (real-time session updates). Confirm if it should be its own module or co-located with sessions.
- **Photo upload size limit**: Define max photo size for proof-of-class uploads (recommend 5MB). Enforce at the NestJS layer before sending to cloud storage.
- **`getStudentSections` vs `getSections` scoping**: The same `GET /sections` endpoint must return different data based on role. Implement via a single service method that checks role, or via separate endpoints (e.g., `/sections/my`).
