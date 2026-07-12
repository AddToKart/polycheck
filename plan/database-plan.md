# Polycheck — Database Design Plan

## Responsibility

This document covers the PostgreSQL database schema (via Prisma ORM), table relationships, indexing strategy, and data lifecycle decisions for the Polycheck backend. It is the foundational layer that all other domain plans depend on.

---

## Data Model Overview

The data model maps directly from the TypeScript types defined in `@polycheck/shared`. The hierarchy is:

```
User (role: teacher | student | super_admin)
  └── Teacher → owns Sections
       └── Section (class instance of a Subject)
            ├── Subject (parent course, e.g. "Software Engineering")
            ├── ScheduleDay (embedded in Section)
            ├── Enrollment  (students ↔ sections)
            ├── SectionRole (president, qac per section)
            ├── Session     (one per class meeting)
            │    ├── AttendanceRecord
            │    └── ProofOfClass
            └── SessionPermission (temporary session access for students)
```

---

## Prisma Schema

### User

```prisma
model User {
  id               String   @id @default(cuid())
  studentId        String?  @unique   // PUP student number, e.g. "2024-00123-MN-0"
  fullName         String
  email            String?  @unique
  role             UserRole
  program          String?
  yearLevel        Int?
  department       String?
  photoUrl         String?
  scope            String?  // super_admin only: "department" | "institution"
  isActive         Boolean  @default(true)
  teacherPublicKey String?  // ECDSA public key PEM; teacher accounts only
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  sections           Section[]            // teacher relation
  enrollments        Enrollment[]
  attendanceRecords  AttendanceRecord[]
  sectionRoles       SectionRole[]
  sessionPermissions SessionPermission[]
  proofsOfClass      ProofOfClass[]

  @@index([role])
  @@index([studentId])
  @@index([email])
}

enum UserRole {
  super_admin
  teacher
  student
}
```

**Notes:**
- `studentId` is the PUP-issued ID string, distinct from the internal `id`.
- `teacherPublicKey` is provisioned once during teacher onboarding. Stored as PEM or base64 DER. Used exclusively for QR token signature verification on sync.
- `scope` only applies to `super_admin`; ignored for other roles.

---

### Subject

```prisma
model Subject {
  id          String   @id @default(cuid())
  name        String
  code        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  sections Section[]

  @@index([code])
}
```

Subjects are institution-level course definitions. They are the parent entity for Sections.

---

### Section

```prisma
model Section {
  id                   String    @id @default(cuid())
  subjectId            String
  subject              Subject   @relation(fields: [subjectId], references: [id])
  section              String    // e.g. "A", "B"
  room                 String
  semester             String    // e.g. "2nd Semester AY 2025-2026"
  teacherId            String
  teacher              User      @relation(fields: [teacherId], references: [id])
  enrollmentCode       String?   @unique
  enrollmentCodeExpiry DateTime?
  studentCount         Int       @default(0)  // denormalized counter
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  schedule           ScheduleDay[]
  enrollments        Enrollment[]
  sessions           Session[]
  sectionRoles       SectionRole[]
  sessionPermissions SessionPermission[]
  proofsOfClass      ProofOfClass[]

  @@index([teacherId])
  @@index([subjectId])
  @@index([enrollmentCode])
}
```

---

### ScheduleDay

```prisma
model ScheduleDay {
  id        String    @id @default(cuid())
  sectionId String
  section   Section   @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  day       DayOfWeek
  startTime String    // "HH:mm"
  endTime   String    // "HH:mm"
  room      String?

  @@index([sectionId])
}

enum DayOfWeek {
  Mon Tue Wed Thu Fri Sat Sun
}
```

---

### Enrollment

```prisma
model Enrollment {
  id        String   @id @default(cuid())
  studentId String
  student   User     @relation(fields: [studentId], references: [id])
  sectionId String
  section   Section  @relation(fields: [sectionId], references: [id])
  enrolledAt DateTime @default(now())

  @@unique([studentId, sectionId])
  @@index([sectionId])
  @@index([studentId])
}
```

The `@@unique` constraint enforces one enrollment per student per section and is the database-level mechanism for the "no duplicate enrollment" rule.

---

### Session

```prisma
model Session {
  id                   String    @id @default(cuid())
  sectionId            String
  section              Section   @relation(fields: [sectionId], references: [id])
  teacherId            String
  subjectName          String
  date                 String    // "YYYY-MM-DD" stored as string — local time concept
  startTime            String    // "HH:mm"
  endTime              String    // "HH:mm"
  room                 String?
  qrValidityMinutes    Int
  gracePeriodMinutes   Int
  geofenceLatitude     Float
  geofenceLongitude    Float
  geofenceRadiusMeters Int
  isActive             Boolean   @default(false)
  qrToken              String?   // cleared when session ends
  qrTokenExpiresAt     DateTime?
  qrGeneratedAt        DateTime?
  isRescheduled        Boolean   @default(false)
  rescheduledFromDate  String?
  originalScheduleTime String?
  originalRoom         String?
  createdAt            DateTime  @default(now())

  attendanceRecords AttendanceRecord[]
  proofsOfClass     ProofOfClass[]

  @@index([sectionId])
  @@index([teacherId])
  @@index([date])
  @@index([isActive])
}
```

**Notes:**
- `date` is `String` (`YYYY-MM-DD`) to avoid timezone confusion. Sessions are local-time concepts.
- Geofence fields are denormalized from Section at session creation. This is intentional: a rescheduled session may be in a different room with a different geofence.
- `qrToken` is cleared on `endSession`. The raw token submitted by students is stored in `AttendanceRecord.tokenSnapshot` for audit.

---

### AttendanceRecord

```prisma
model AttendanceRecord {
  id                 String           @id @default(cuid())
  sessionId          String
  session            Session          @relation(fields: [sessionId], references: [id])
  sectionId          String
  studentId          String
  student            User             @relation(fields: [studentId], references: [id])
  studentName        String           // denormalized for display
  studentProgram     String?
  timestamp          DateTime
  status             AttendanceStatus
  latitude           Float
  longitude          Float
  deviceId           String?
  tokenSnapshot      String?          // raw signed token from sync payload; used for post-facto re-verification
  isSynced           Boolean          @default(false)
  syncedAt           DateTime?
  disputeReason      String?
  disputeDescription String?
  disputeResolved    Boolean          @default(false)
  manuallySet        Boolean          @default(false)
  notes              String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@unique([sessionId, studentId])   // REJECT-ON-DUPLICATE enforcement
  @@index([sessionId])
  @@index([studentId])
  @@index([sectionId])
  @@index([status])
  @@index([isSynced])
}

enum AttendanceStatus {
  present
  late
  absent
  pending
  disputed
}
```

**Critical:** The `@@unique([sessionId, studentId])` constraint is the database-level enforcement of the reject-on-duplicate rule. A second sync attempt for the same pair causes a unique constraint violation, which the sync handler must catch and log as a rejected duplicate, NOT a server error.

**`tokenSnapshot`:** Store the raw signed token string from the sync payload. This allows the server to re-verify the ECDSA signature against the teacher's stored public key at any point after sync, even if the QR had already expired.

---

### SectionRole

```prisma
model SectionRole {
  id          String          @id @default(cuid())
  sectionId   String
  section     Section         @relation(fields: [sectionId], references: [id])
  studentId   String
  student     User            @relation(fields: [studentId], references: [id])
  studentName String          // denormalized
  role        SectionRoleType
  grantedBy   String          // teacherId
  grantedAt   DateTime        @default(now())

  @@unique([sectionId, studentId, role])
  @@index([sectionId])
  @@index([studentId])
}

enum SectionRoleType {
  president
  qac
}
```

---

### SessionPermission

```prisma
model SessionPermission {
  id        String   @id @default(cuid())
  sectionId String
  section   Section  @relation(fields: [sectionId], references: [id])
  studentId String
  student   User     @relation(fields: [studentId], references: [id])
  grantedBy String
  grantedAt DateTime @default(now())
  expiresAt DateTime
  isActive  Boolean  @default(true)

  @@index([sectionId])
  @@index([studentId])
  @@index([isActive, expiresAt])
}
```

`expiresAt` is set to 24 hours from grant time. Expiry is checked at request time (lazy check). A background cron can periodically flip `isActive = false` for expired rows.

---

### ProofOfClass

```prisma
model ProofOfClass {
  id                    String   @id @default(cuid())
  sectionId             String
  section               Section  @relation(fields: [sectionId], references: [id])
  sessionId             String
  session               Session  @relation(fields: [sessionId], references: [id])
  uploadedBy            String
  student               User     @relation(fields: [uploadedBy], references: [id])
  uploadedByStudentName String
  photoUrl              String   // cloud storage URL — never raw base64 in DB
  uploadedAt            DateTime @default(now())
  description           String?

  @@index([sessionId])
  @@index([sectionId])
}
```

---

## Indexing Summary

| Table | Indexes |
|---|---|
| `User` | `role`, `studentId`, `email` |
| `Subject` | `code` |
| `Section` | `teacherId`, `subjectId`, `enrollmentCode` |
| `Session` | `sectionId`, `teacherId`, `date`, `isActive` |
| `AttendanceRecord` | `sessionId`, `studentId`, `sectionId`, `status`, `isSynced` |
| `Enrollment` | `studentId`, `sectionId` |
| `SectionRole` | `sectionId`, `studentId` |
| `SessionPermission` | `sectionId`, `studentId`, `isActive+expiresAt` |
| `ProofOfClass` | `sessionId`, `sectionId` |

---

## Data Lifecycle Rules

### Enrollment Code
- 6–8 char alphanumeric, generated on section creation.
- `@unique` in DB — regeneration must be collision-safe (retry loop).
- Expired codes reject new enrollments; existing enrollments remain valid.
- Disabling sets `enrollmentCode = null`.

### Session Lifecycle
- Created with `isActive = false`.
- `activateSession` (QR generation): sets `isActive = true`, writes `qrToken`, `qrGeneratedAt`, `qrTokenExpiresAt`.
- `endSession`: clears `qrToken`, `qrGeneratedAt`, `qrTokenExpiresAt`, sets `isActive = false`.
- Sessions have **no administrative expiry** — they stay accessible for retroactive management (see system plan).

### Attendance Status Transitions
```
pending  → present | late | absent    (on QR scan / session end)
any      → disputed                   (on student dispute submission)
disputed → present | late | absent    (on teacher resolution)
any      → any                        (manual teacher override; sets manuallySet = true)
```

### Cascade Behavior
- Deleting a `Section`: cascades to `ScheduleDay`, `Enrollment`, `SectionRole`, `SessionPermission`.
- `Session` and `AttendanceRecord` rows are **retained** (not cascade-deleted) for audit purposes.
- `ProofOfClass` rows are also retained for audit.
- `studentCount` on Section must be manually decremented on `Enrollment` delete (no DB-level trigger in Prisma; handle in service layer).

---

## Migration Conventions

- `prisma migrate dev` for local development.
- `prisma migrate deploy` in CI/CD pipelines.
- Never `prisma db push` in production.
- Migration names should be descriptive: `add_teacher_public_key`, `add_token_snapshot_to_attendance`.

---

## Open Questions

- **`date` as String vs `DateTime`**: String avoids timezone conversion issues since sessions are local-time concepts. If cross-timezone reporting is ever needed, this will need revisiting.
- **`studentCount` counter**: Currently managed by the service layer (increment on enroll, decrement on unenroll). Consider a Postgres trigger or a computed column if data consistency becomes a concern.
- **Photo storage provider**: `photoUrl` field is ready; the specific bucket (S3, GCS, Cloudinary) is unresolved for v1.
- **Teacher public key rotation**: No rotation mechanism in v1. If a teacher loses their private key, an admin re-provisions via the onboarding flow, overwriting `teacherPublicKey`.
- **Better Auth session table**: Better Auth may add its own session/account tables via its Prisma adapter. These should be kept in the same database but treated as Better Auth's domain — don't mix with application data models.
