# Polycheck — Attendance & Disputes Domain Plan

## Responsibility

This document covers the attendance management domain: how attendance records are created, how their status transitions work, how the dispute lifecycle is managed, and how aggregated summaries are computed for reporting.

---

## Attendance Record Sources

An `AttendanceRecord` can be created in three ways:

| Source | Who | How |
|---|---|---|
| QR Scan (offline) | Student | Via the sync endpoint after local capture |
| Session End | System | Auto-generates `absent` records for students who never scanned |
| Manual Override | Teacher | Via the manual status update endpoint |

Each source results in a record with different field values:

```ts
// QR Scan (via sync)
{ isSynced: true, syncedAt: now, tokenSnapshot: '<signed>', manuallySet: false }

// Auto-absent on session end
{ isSynced: false, syncedAt: null, tokenSnapshot: null, manuallySet: false, status: 'absent' }

// Manual override
{ manuallySet: true }
```

---

## Creating Absent Records on Session End

When a session ends, every student enrolled in that section must have an attendance record for this session. The session end handler:

1. Fetch all enrolled `studentIds` for `session.sectionId`
2. Fetch existing attendance records for this session
3. For each student without a record → create `AttendanceRecord` with `status = 'absent'`
4. For each student with `status = 'pending'` → update to `status = 'absent'`

This is a bulk operation and should use `createMany` and `updateMany` for performance:

```ts
// Upsert pattern for session-end absent creation
await db.attendanceRecord.createMany({
  data: missingStudents.map(studentId => ({
    sessionId, sectionId, studentId,
    status: 'absent',
    timestamp: new Date(),  // session end time
    latitude: 0, longitude: 0,  // no location for auto-absent
  })),
  skipDuplicates: true,  // safe guard
})
```

---

## Status Transitions Reference

```
pending
  ├── → present     (QR scanned within validity window)
  ├── → late        (QR scanned within grace period)
  └── → absent      (session ended with no scan)

present | late | absent
  └── → disputed    (student submits dispute)

disputed
  ├── → present     (teacher accepts dispute)
  ├── → absent      (teacher rejects dispute)
  └── → any         (teacher overrides manually)

any status
  └── → any status  (teacher manual override; sets manuallySet = true)
```

The `manuallySet` flag is purely informational — it marks records where teacher intervention changed the status. It does not prevent further changes.

---

## AttendanceSummary Computation

The `AttendanceSummary` type (from `@polycheck/shared`) provides per-section aggregates used in dashboards and reports.

```ts
interface AttendanceSummary {
  sectionId: string
  subjectName: string
  totalSessions: number
  present: number
  late: number
  absent: number
  disputed: number
  attendanceRate: number  // (present + late) / (present + late + absent) * 100
}
```

This should be computed server-side per request (no materialized view for v1). The query pattern:

```sql
SELECT
  section_id,
  COUNT(*) FILTER (WHERE status = 'present') AS present,
  COUNT(*) FILTER (WHERE status = 'late')    AS late,
  COUNT(*) FILTER (WHERE status = 'absent')  AS absent,
  COUNT(*) FILTER (WHERE status = 'disputed') AS disputed
FROM attendance_records
WHERE section_id = $1
  AND (student_id = $2 OR $2 IS NULL)  -- optional student filter
GROUP BY section_id
```

Use Prisma's `groupBy` or raw query for this.

---

## Per-Student Attendance Summary

For a student's detail page (teacher view), the summary is per-section per-student:

```
GET /attendance/summaries?studentId=s-001&sectionId=sec-001
```

Returns a single `AttendanceSummary` with counts for that student in that section.

---

## Disputes Domain

### Dispute Lifecycle

```
Student submits dispute → status = 'disputed'
  ↓
Teacher sees in disputes queue (GET /disputes)
  ↓
Teacher reviews and resolves → status updated, disputeResolved = true
```

### Dispute Reasons (from shared types)

Disputes have a `DisputeReason` field:

```ts
type DisputeReason =
  | 'gps_error'           // GPS failed to get location
  | 'camera_error'        // QR scan failed
  | 'technical_issue'     // generic device issue
  | 'was_present'         // student claims they were there
  | 'other'
```

The student also provides a free-text `description` (max 500 chars).

### Dispute Queue Endpoint

```
GET /disputes
Query params: sessionId?, sectionId?, resolved?
```

Returns all `AttendanceRecord` rows where `status = 'disputed'`, optionally filtered. Used by both teacher and super_admin views.

Teacher scoping: teachers only see disputes for their own sections. Super admins see all.

### Resolution Endpoint

```
POST /disputes/:recordId/resolve
Body: {
  resolution: 'accept' | 'reject' | 'override'
  newStatus?: AttendanceStatus  // required if resolution = 'override'
}
```

Outcomes:
- `accept` → `status = 'present'`, `disputeResolved = true`
- `reject` → `status = 'absent'`, `disputeResolved = true`
- `override` → `status = newStatus`, `manuallySet = true`, `disputeResolved = true`

After resolution, emit `dispute:resolved` WebSocket event to `user:{teacherId}` (confirmation) and `user:{studentId}` (notification).

---

## Proof-of-Class Integration

Proofs of class are attached to a session and don't affect attendance records directly. They are supporting evidence for:
- Verifying that a class meeting actually occurred
- Audit trail for disputed sessions

### Authorization for Upload

A student can upload proof-of-class only if:
1. They have the `qac` role in that section's `SectionRole` table, **OR**
2. They have an active `SessionPermission` for that section

The NestJS guard checks both conditions:
```ts
async canUploadProof(studentId: string, sectionId: string): Promise<boolean> {
  const isQac = await this.sectionRoleService.hasRole(studentId, sectionId, 'qac')
  if (isQac) return true
  return this.sessionPermissionService.hasActivePermission(studentId, sectionId)
}
```

---

## Section Roles (President / QAC)

### Responsibilities
- **President** (`president`): Can create sessions and set geofences for their section
- **QAC** (`qac`): Can upload proof-of-class photos during active sessions

### Behavior
- One president per section. One QAC per section. (Recommend enforcing in service layer, not just DB constraint.)
- Both roles can coexist independently.
- Roles are permanent within the section (not session-scoped) — use `SessionPermission` for temporary/session-scoped access.
- Teacher can grant and revoke at any time.

### Student Officer Permission to Create Sessions

When a student with `president` role creates a session:
- The `Session.teacherId` is still the teacher's ID
- A `createdByStudentId` field may be needed (not currently in the schema — add if needed for audit)
- The teacher retains full oversight and can override anything the president creates

---

## Session Permissions

Temporary access granted by a teacher to specific students. 

```ts
// 24-hour expiry from grant time
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
```

On permission check (upload proof, create session if president):
1. Fetch `SessionPermission` where `studentId = X`, `sectionId = Y`, `isActive = true`
2. Check `expiresAt > now` — if expired, treat as inactive (lazy expiry)
3. Optionally update `isActive = false` on the expired row

A background cron job can clean up expired rows weekly:
```ts
await db.sessionPermission.updateMany({
  where: { isActive: true, expiresAt: { lt: new Date() } },
  data: { isActive: false }
})
```

---

## Reports & Aggregations

### Report Filters

The reports endpoint (`GET /reports/attendance`) supports the following filters:
- `sectionId` — filter by section
- `sessionId` — filter by specific session
- `teacherId` — filter by teacher (super_admin only)
- `startDate` / `endDate` — date range (matches `Session.date` string)
- `studentId` — filter by student
- `status` — filter by attendance status

Filters are applied at the query level, not in application memory.

### CSV Export Format

When `GET /reports/export` is called:

```
Student Name,Student ID,Date,Time,Status,Section,Subject,Session ID,Manually Set,Notes
Angela Marie Cruz,2024-00123-MN-0,2026-06-18,09:02:00,present,A,Software Engineering,sess-002,false,
```

Response headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="attendance-{sectionId}-{date}.csv"
```

---

## Open Questions

- **Auto-absent on session end vs. lazy absent**: Currently, absent records are created at session end. An alternative is "lazy absent" — the record doesn't exist until someone queries it, and the absence is inferred from missing records. The current approach (eager creation) is simpler for querying and display. Stick with eager unless performance becomes a concern.
- **Aggregate caching**: For super_admin institution-wide report pages that aggregate across all sections and teachers, consider caching the aggregate results in Redis with a short TTL (5 minutes) to avoid expensive queries on every page load.
- **Disputed records in attendance rate**: The current `attendanceRate` formula excludes `disputed` records (they're counted separately). Confirm this is the desired behavior — some institutions may want disputed records treated as absent for rate calculation until resolved.
