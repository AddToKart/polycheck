# Polycheck — Offline Sync Plan

## Responsibility

This document covers the offline sync engine: how attendance records and sessions flow from device SQLite databases to the PostgreSQL backend, how conflicts are resolved, and how the server validates and finalizes records on arrival.

---

## Core Principle

The system is designed around a strict separation:
- **Offline actions** (QR generation, QR scan, geofence check) — no server involvement, all local
- **Online actions** (sync, enrollment, session creation, dispute submission) — require connectivity

The sync engine exists to drain the local queue of offline-generated records and make them permanent on the server. Sync is opportunistic — it triggers automatically when the device detects connectivity.

---

## What Gets Synced

### From Student → Server

| Item | When Generated | Sync Contents |
|---|---|---|
| `AttendanceRecord` | On successful QR scan | Full record including `tokenSnapshot`, `coordinates`, `timestamp`, `deviceId` |
| Dispute submission | When student flags a record | `recordId`, `reason`, `description` |

### From Teacher → Server

| Item | When Generated | Sync Contents |
|---|---|---|
| New session (if created offline) | On session creation | Full session including geofence, dates, times |
| Session end event | On `endSession` | `sessionId`, end timestamp |
| Manual attendance override | On roster tap | `recordId`, new `status` |

### From Server → Device (Pre-session Sync / Pull)

| Item | Pulled By | Contents |
|---|---|---|
| Enrolled sections + schedules | Student | `sectionId`, schedule days, `teacherId`, `subjectName` |
| Geofence config | Student | `latitude`, `longitude`, `radiusMeters` per session |
| Enrolled student roster | Teacher | List of `studentId`, `fullName` for their sections |
| Session list | Teacher | Existing sessions for the day |

---

## Sync Payload Shape

### Student Sync Payload

```ts
// POST /sync/attendance
{
  deviceId: string
  records: Array<{
    localId: string             // device-generated temp ID
    sessionId: string
    sectionId: string
    studentId: string
    timestamp: string           // ISO datetime
    status: 'present' | 'late'  // device-local determination
    latitude: number
    longitude: number
    tokenSnapshot: string       // raw signed token string
  }>
}
```

### Sync Response

```ts
{
  accepted: string[]      // localIds accepted
  rejected: string[]      // localIds rejected (duplicates)
  disputed: string[]      // localIds that failed re-validation
}
```

The client updates its local SQLite records using this response: accepted → `isSynced = true`, disputed → `status = 'disputed'`, rejected → flag for display.

---

## Server-Side Sync Processing

Sync processing for a batch of incoming records must be handled **asynchronously** via a BullMQ job queue. This prevents the HTTP handler from blocking during peak load.

### Flow

```
POST /sync/attendance
  │
  ├── Validate JWT (student identity)
  ├── Validate payload shape (Zod)
  ├── Enqueue sync job → return 202 Accepted immediately
  │
  └── BullMQ Worker picks up job
        │
        ├── For each record:
        │     ├── 1. Verify token signature (ECDSA vs teacher public key)
        │     ├── 2. Validate timestamp (isTokenInValidityWindow with server clock)
        │     ├── 3. Validate coordinates (isWithinGeofence vs stored geofence)
        │     ├── 4. Check for duplicate (sessionId + studentId unique constraint)
        │     └── 5. Insert or mark disputed
        │
        └── Update per-record status
              ├── Accepted → INSERT with isSynced=true, status from validation
              ├── Disputed → INSERT with status='disputed', disputeReason set
              └── Duplicate → log, skip insert, add to rejected list
```

### Validation Steps in Detail

**Step 1 — Token Signature:**
- Decode `tokenSnapshot` into `[payloadB64, signatureB64]`
- Fetch teacher's public key via `payload.teacherId`
- Verify ECDSA signature
- Failure → `disputeReason = 'invalid_signature'`

**Step 2 — Timestamp Validation:**
- Use `isTokenInValidityWindow(payload, Date.now())`
- If `valid = false` → token was expired when scanned (outside grace period)
- Failure → `disputeReason = 'expired_token'`

**Step 3 — Geofence Validation:**
- Fetch session's geofence from DB (or Redis cache if active)
- Use `isWithinGeofence(lat, lon, centerLat, centerLon, radiusMeters)`
- Failure → `disputeReason = 'outside_geofence'`
- If coordinates are suspiciously precise (matching geofence center exactly) → flag `disputeReason = 'suspicious_coordinates'` (GPS spoofing heuristic)

**Step 4 — Duplicate Check:**
- Attempt `db.attendanceRecord.create(...)` with the `@@unique([sessionId, studentId])` constraint
- Catch `Prisma.PrismaClientKnownRequestError` with code `P2002` (unique constraint violation) → this is a duplicate
- Duplicates are rejected, not inserted

**Step 5 — Status Finalization:**
- If all checks pass: `status = 'present'` if within QR window, `status = 'late'` if in grace period
- If any check fails (except duplicate): insert as `status = 'disputed'`

---

## Conflict Resolution Strategy

The strategy is **reject-on-duplicate** for token+student pairs:

1. First sync to arrive for a given `(sessionId, studentId)` pair → **accepted as canonical**
2. Any subsequent submission of the same pair → **rejected, logged**
3. Rejected duplicates are surfaced to the teacher's dispute queue

For non-conflicting records from different students in the same session → insert normally, no conflict.

### Why First-Write-Wins

A student legitimately only produces one check-in per session. If two records arrive for the same pair, at least one is fraudulent or an app bug. The first one to arrive is treated as canonical because:
- Network arrival order is the only reliable signal available in an offline-first system
- The teacher can always manually override the final status if needed

---

## Pre-Session Pull (Student Device)

Before class, students open the app while connected. The app calls:

```
GET /sync/pre-session?studentId=<id>
```

Response:
```ts
{
  sections: Section[]          // enrolled sections with schedules
  sessions: Session[]          // upcoming sessions for next 7 days
  geofences: {                 // keyed by sessionId
    [sessionId]: GeofenceConfig
  }
}
```

This data is written to the local SQLite database and is what makes offline attendance scanning possible. If this pull hasn't happened and the device has no cached data for the current class, the student cannot scan (acceptable constraint per system plan).

---

## Redis Caching for Active Sessions

When a session is active (`isActive = true`), its geofence config is cached in Redis:

```
Key: session:{sessionId}:geofence
Value: { latitude, longitude, radiusMeters }
TTL: session duration + 30 min buffer
```

The sync worker checks Redis first before querying PostgreSQL for geofence data. This avoids DB load during peak sync windows.

Cache is set when `activateSession()` is called. Cache is deleted (or allowed to expire) when `endSession()` is called.

---

## Session End → Pending → Absent

When a teacher calls `endSession`:
1. `Session.isActive` → `false`
2. `Session.qrToken` → `null`
3. All `AttendanceRecord` rows for this session with `status = 'pending'` → `status = 'absent'`

Step 3 is a bulk update:
```sql
UPDATE attendance_records
SET status = 'absent'
WHERE session_id = $1 AND status = 'pending'
```

Records that are `disputed` are NOT affected by session end — they stay `disputed` for teacher review.

---

## Retroactive Sync Buffer

The system explicitly supports students syncing days or weeks after the class (see system plan). This means:
- No server-side cutoff on sync acceptance based on session date
- The `date` field on `Session` is informational only — it does not gate sync acceptance
- The session must remain `isActive` open for any admin actions, but the sync endpoint accepts records regardless of session state

The only sync rejection criteria are: invalid signature, confirmed duplicate, or records with sessionIds that do not exist in the database.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Student scans, syncs immediately (online) | Same flow as offline; record goes through worker queue |
| Student scans offline, syncs 5 days later | Accepted; server validates against stored geofence and signed `issuedAt` |
| Two students scan same QR (forwarded) | Both will have valid signatures; geofence check on server determines if both were in range; if coords are suspicious, both flagged |
| Student submits scan, re-submits same token | Duplicate caught by unique constraint; second is rejected |
| Teacher's phone loses sync mid-batch | Worker uses atomic per-record processing; partial batches are safe |
| Session's geofence changed after scan | Server always re-validates against the geofence stored on the Session at sync time, not a cached client value |
| Token signature valid but teacher re-provisioned key | V1: old records considered already-verified if processed before re-provisioning. New records use new key. No retroactive invalidation. |

---

## Open Questions

- **Sync acknowledgment to client**: The endpoint returns `202 Accepted` immediately and processes async. The client doesn't get per-record outcomes synchronously. A polling endpoint (`GET /sync/status/{jobId}`) or WebSocket push can surface results. Decide if clients need to poll or if WebSocket push is sufficient for the MVP.
- **Batch size limits**: No limit is defined. Large batches (many days of offline records) should be chunked on the client side. Recommend a max of 100 records per sync payload.
- **BullMQ job failure handling**: If a sync job fails (server error, DB down), BullMQ will retry. Define retry count and backoff strategy. Failed jobs after max retries should be logged and surfaced to an admin alert.
- **Teacher offline session creation**: Teachers can create sessions offline. When they sync, the session is posted to the server. If a student has already pre-synced and the server doesn't have the session yet, their attendance record will reference a non-existent `sessionId`. Handle this with a foreign key deferral or a pending-session queue.
