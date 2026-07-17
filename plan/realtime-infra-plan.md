# Polycheck — Real-Time & Caching Infrastructure Plan

## Responsibility

This document covers the WebSocket gateway (Socket.IO) and Redis integration in the NestJS backend. It includes event design, room strategy, geofence caching, rate limiting, and BullMQ job queue design.

---

## WebSocket Gateway

### Technology

Socket.IO via `@nestjs/websockets` and `@nestjs/platform-socket.io`. The gateway lives in the `sessions` module (or a dedicated `gateway` module if it grows).

Redis adapter: `@socket.io/redis-adapter` for horizontal scaling across multiple NestJS instances.

### Connection

Clients authenticate at connection time by passing the JWT as a handshake query parameter or auth header:

```ts
// Client side
const socket = io('wss://api.polycheck.edu.ph', {
  auth: { token: jwtToken }
})
```

The gateway validates the JWT on connection using the same `JwtAuthGuard` logic. If invalid, the connection is rejected.

### Room Strategy

Each active session is a WebSocket room. Teachers join the room for their session; students optionally join to receive live feedback on their scan.

| Room Name | Who Joins | Purpose |
|---|---|---|
| `session:{sessionId}` | Teacher (on session detail page) | Receive real-time attendance updates |
| `user:{userId}` | Any authenticated user | Receive personal notifications (e.g., dispute resolved) |

### Events

#### Server → Client

| Event | Room | Payload | Description |
|---|---|---|---|
| `session:activated` | `session:{id}` | `{ sessionId, qrTokenExpiresAt }` | QR has been generated |
| `session:ended` | `session:{id}` | `{ sessionId }` | Session ended, pending → absent |
| `attendance:updated` | `session:{id}` | `{ record: AttendanceRecord }` | A student's record was inserted or updated |
| `dispute:submitted` | `session:{id}` | `{ recordId, studentName }` | Student submitted a dispute |
| `dispute:resolved` | `user:{teacherId}` | `{ recordId, resolution }` | Dispute resolved (teacher confirmation) |
| `scan:result` | `user:{studentId}` | `{ status, message }` | Feedback on student's sync attempt |

#### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join:session` | `{ sessionId }` | Teacher joins session room |
| `leave:session` | `{ sessionId }` | Teacher leaves session room |

Students don't join rooms explicitly — they receive events via their `user:{userId}` room.

### Emitting Events from HTTP Handlers

When an HTTP endpoint changes attendance data (sync endpoint, manual override, dispute resolution), it must emit a WebSocket event to the relevant room:

```ts
// In AttendanceService
this.gateway.server.to(`session:${sessionId}`).emit('attendance:updated', { record })
```

This requires the gateway instance to be injectable into services. Use NestJS DI for this.

---

## Redis Usage

### 1. Socket.IO Adapter (Scaling)

```ts
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()
io.adapter(createAdapter(pubClient, subClient))
```

This is required when deploying multiple NestJS instances behind a load balancer. Without it, a teacher connected to instance A won't receive events emitted by instance B.

### 2. Active Session / Geofence Cache

When a session is activated, its geofence config is cached:

```
Key:   session:{sessionId}:geofence
Value: JSON { latitude, longitude, radiusMeters }
TTL:   (qrValidityMinutes + gracePeriodMinutes + 30) * 60 seconds
```

When the sync worker validates a record, it reads from Redis first. If the key doesn't exist (session ended or TTL expired), it falls back to PostgreSQL.

```ts
async getGeofence(sessionId: string): Promise<GeofenceConfig> {
  const cached = await redis.get(`session:${sessionId}:geofence`)
  if (cached) return JSON.parse(cached)

  const session = await db.session.findUnique({ where: { id: sessionId } })
  return { latitude: session.geofenceLatitude, ... }
}
```

### 3. Rate Limiting

Rate limiting is applied via `@nestjs/throttler` with a Redis store (`@nestjs-throttler-storage-redis`).

| Endpoint Group | Limit |
|---|---|
| Auth endpoints (`/auth/login/*`) | 10 requests / 60 seconds per IP |
| Sync endpoint (`/sync/attendance`) | 5 requests / 60 seconds per userId |
| QR generation (`/sessions/:id/activate`) | 10 requests / 60 seconds per userId |
| General API | 100 requests / 60 seconds per userId |

Rate limit errors return `429 Too Many Requests`.

### 4. BullMQ Job Queues

BullMQ uses Redis as its backing store. Two queues are used:

#### `attendance-sync` Queue

Processes batches of student attendance records submitted via `POST /sync/attendance`.

```ts
// Job payload
{
  batchId: string
  userId: string
  records: OfflineSyncRecord[]
}
```

- **Concurrency**: 5 workers (adjust based on load)
- **Retry**: 3 attempts with exponential backoff (1s, 5s, 30s)
- **On failure**: Log to error monitoring; records remain unsynced on client

#### `session-end` Queue (optional)

If auto-ending sessions on a schedule is needed (e.g., auto-end 1 hour after scheduled end time), a delayed BullMQ job handles it. In v1, sessions end only on teacher action — this queue is optional.

---

## Redis Key Naming Convention

```
session:{sessionId}:geofence       # active geofence config
session:{sessionId}:active         # boolean flag (session is active)
ratelimit:{userId}:{endpoint}      # rate limit counter (managed by throttler)
bull:attendance-sync:*             # BullMQ internal keys (don't touch)
```

---

## Connection Lifecycle

### Teacher Opens Session Detail Page
1. Browser/app establishes Socket.IO connection with JWT
2. Emits `join:session` → server adds socket to `session:{sessionId}` room
3. Teacher receives `attendance:updated` events as students sync

### Student Submits Scan Sync
1. App calls `POST /sync/attendance`
2. Server returns `202 Accepted` immediately
3. BullMQ worker processes record
4. On completion, server emits `attendance:updated` to `session:{sessionId}` room (teacher sees update)
5. Server emits `scan:result` to `user:{studentId}` room (student sees confirmation)

### Session End
1. Teacher presses "End Session"
2. HTTP call `POST /sessions/:id/end`
3. Server bulk-updates pending → absent
4. Server emits `session:ended` to `session:{sessionId}` room
5. Teacher's UI reflects final roster

---

## Open Questions

- **Offline teacher dashboard**: If the teacher has poor connectivity, they won't receive WebSocket events. The session detail page must fall back to polling (currently 10-second interval in the mock) when the WebSocket connection drops.
- **Student scan result UX**: When the student syncs offline records after class, they may receive `scan:result` events hours later. The app should store these quietly and surface them in the attendance history without disrupting the user.
- **Redis failure mode**: If Redis is down, the WebSocket adapter cannot relay events across instances. This means real-time updates only work if both teacher and sync requests hit the same server instance. Acceptable for MVP if single-instance deployment; needs the adapter for multi-instance production.
- **BullMQ dashboard**: Consider adding `bull-board` or `@bull-board/api` for an admin UI to monitor queue health and retry failed jobs.
