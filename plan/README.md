# Polycheck Backend — Plan Index

This directory contains the backend implementation reference guides, organized by domain.
Read each file independently in whatever order matches your current work.

---

## Files

| File | Domain | What It Covers |
|---|---|---|
| [`database-plan.md`](./database-plan.md) | Database | Full Prisma schema (all models, relations, indexes), data lifecycle rules, cascade behavior, migration conventions |
| [`auth-plan.md`](./auth-plan.md) | Authentication | Better Auth config, login flows, JWT shape, NestJS guards, RBAC, teacher key provisioning |
| [`qr-plan.md`](./qr-plan.md) | QR Tokens | Token payload structure, ECDSA signing algorithm, server-side verification on sync, expiry/grace logic, security properties |
| [`sync-plan.md`](./sync-plan.md) | Offline Sync | Sync payloads, BullMQ async processing, per-record validation steps, conflict resolution, reject-on-duplicate, pre-session pull |
| [`attendance-plan.md`](./attendance-plan.md) | Attendance & Disputes | Record creation sources, status transitions, absent-on-session-end, dispute lifecycle, proof-of-class authorization, section roles, report aggregations |
| [`geolocation-plan.md`](./geolocation-plan.md) | Geolocation | Geofence config, Haversine validation (device + server), GPS accuracy, spoofing heuristics |
| [`realtime-infra-plan.md`](./realtime-infra-plan.md) | WebSockets & Redis | Socket.IO gateway, room strategy, event catalog, Redis session cache, rate limiting, BullMQ queues |
| [`api-services-plan.md`](./api-services-plan.md) | REST API | Every endpoint by module (method, path, auth, description), error conventions, global middleware |
| [`nestjs-setup-plan.md`](./nestjs-setup-plan.md) | Project Setup | Directory structure, dependencies, env vars, bootstrap config, module/controller/service patterns, monorepo registration |

---

## Key Architectural Decisions (Already Finalized)

These are not open questions — they are decided and documented throughout the plan files.

- **Reject-on-duplicate**: `@@unique([sessionId, studentId])` on `AttendanceRecord` is the canonical enforcement. First sync wins.
- **Clock-drift-resistant expiry**: `issuedAt` is inside the signed QR payload. Server validates against its own clock. Device clock is irrelevant.
- **ECDSA P-256** for QR signing. Token format: `base64url(payload).base64url(signature)` (not JWT).
- **Geofence per session** (not per section) — allows different rooms for rescheduled sessions.
- **Sessions have no administrative expiry** — retroactive management is intentional and documented.
- **BullMQ for async sync processing** — sync endpoint returns 202 immediately; worker validates and persists.
- **Redis Socket.IO adapter** for multi-instance WebSocket scaling.
- **Disputes are a state on `AttendanceRecord`** — no separate Dispute table.
- **Better Auth** manages session lifecycle (login, refresh, single-session enforcement).
- **NestJS JWT guard** reads role from token — no per-request DB role check.

---

## Shared Code Available

These utilities from `@polycheck/shared` are production-ready and must be imported directly by the backend. Do not reimplement them.

```ts
import { haversineDistance } from '@polycheck/shared/utils/haversine'
import { isTokenInValidityWindow, decodeTokenPayload } from '@polycheck/shared/utils/token'
import { SessionCreateSchema, SectionCreateSchema } from '@polycheck/shared/validation'
import type { AttendanceStatus, UserRole, QRTokenPayload, ... } from '@polycheck/shared/types'
```
