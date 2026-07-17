# Polycheck — Authentication Plan

## Responsibility

This document covers the full authentication and authorization layer for the Polycheck backend: user identity, session management, JWT issuance, role-based access control (RBAC), and teacher key provisioning.

---

## Authentication Stack

| Component | Technology |
|---|---|
| Session management | Better Auth (via its NestJS/Next.js integration) |
| API access tokens | JWT issued by Better Auth, verified by NestJS guards |
| Role enforcement | Custom NestJS guards reading `role` from JWT payload |
| Single-session enforcement | Better Auth session limit configuration |
| Teacher key provisioning | Custom NestJS endpoint |

---

## User Roles

Three roles exist. Every protected route must declare which roles can access it.

| Role | Value | Description |
|---|---|---|
| Super Admin | `super_admin` | Institution-wide access. Manages teachers, views all data. |
| Teacher | `teacher` | Manages own sections, sessions, attendance. |
| Student | `student` | Reads own records, submits attendance scans. |

The `role` field is stored on the `User` record and embedded in every JWT.

---

## Better Auth Configuration

Better Auth is the source of truth for:
- User account creation and login
- JWT issuance and refresh
- Session lifecycle (including the single-session-per-account constraint)

### Single Active Session per Account

Better Auth must be configured to enforce **one active session per user**. When a user logs in from a new device or browser, their existing session is immediately invalidated. This is the v1 anti-cheat mechanism for preventing account sharing (see system plan, Cheat Scenario 2).

```ts
// Better Auth config (Next.js integration side)
betterAuth({
  session: {
    maxSessions: 1,
    onSessionConflict: 'invalidate-existing',
  }
})
```

### JWT Payload Shape

The JWT payload must include:

```ts
{
  sub: string        // userId (cuid)
  role: UserRole     // 'teacher' | 'student' | 'super_admin'
  email?: string
  studentId?: string // only for student role
  iat: number
  exp: number
}
```

The `role` in the token is the authoritative source for access control in NestJS. Do not re-query the database on every request just to check the role — trust the token.

---

## Login Flows

### Student Login

Students log in via their PUP student number (`studentId` field) and password. No email required.

```
POST /auth/login/student
Body: { studentId: string, password: string }
Response: { token: string, user: User }
```

The `studentId` field is looked up in `User.studentId` (which is unique-indexed).

### Teacher / Admin Login

Teachers and Super Admins log in via email and password.

```
POST /auth/login/faculty
Body: { email: string, password: string }
Response: { token: string, user: User }
```

### Logout

```
POST /auth/logout
Headers: Authorization: Bearer <token>
```

Invalidates the session in Better Auth.

### Token Refresh

Better Auth handles refresh token rotation. Clients should implement silent refresh before token expiry.

---

## NestJS Authorization Guards

### JWT Guard

All protected routes are wrapped in a global `JwtAuthGuard`. It verifies the JWT signature and injects the decoded payload as `request.user`.

```ts
// Attach to every request
@UseGuards(JwtAuthGuard)
```

Unprotected routes (login, health check) use `@Public()` decorator to bypass.

### Roles Guard

Endpoints that require a specific role use `@Roles(...)` alongside the JWT guard.

```ts
@Roles('teacher', 'super_admin')
@Get('/sections/:id/students')
```

The guard reads `request.user.role` and compares against the allowed roles. If the role doesn't match, it returns `403 Forbidden`.

### Ownership Guard

Some resources must be further scoped to the requesting user, not just their role. For example, a teacher can only access sections they own (`section.teacherId === request.user.sub`).

This is not a generic guard — it must be enforced at the service layer:

```ts
// In SectionService
async getSection(id: string, requestingUserId: string) {
  const section = await this.db.section.findUnique({ where: { id } })
  if (!section) throw new NotFoundException()
  if (section.teacherId !== requestingUserId) throw new ForbiddenException()
  return section
}
```

Super Admins bypass ownership checks — they can access any resource.

### Access Control Summary

| Resource | student | teacher | super_admin |
|---|---|---|---|
| Own profile | R | R | R/W |
| All users | — | — | R/W |
| Sections (own) | R (enrolled only) | R/W | R/W |
| Sessions (own section) | R | R/W | R/W |
| Attendance records (own) | R | R/W | R/W |
| Disputes | submit | resolve | resolve |
| Reports | own only | own sections | all |
| Teacher key provisioning | — | own only | any |

---

## Teacher Key Provisioning

This is the mechanism that enables offline QR signing.

### Flow

1. During or after initial teacher account setup, the teacher's mobile app generates an ECDSA key pair locally (P-256 curve recommended).
2. The private key is stored in the device's secure enclave (iOS Secure Enclave or Android Keystore). It never leaves the device.
3. The public key is sent to the backend and stored in `User.teacherPublicKey`.

```
POST /auth/provision-key
Headers: Authorization: Bearer <teacher-jwt>
Body: { publicKey: string }  // PEM or base64 DER
```

Guard: `JwtAuthGuard` + `Roles('teacher')`.

### Re-provisioning

If the teacher switches devices or reinstalls the app, a new key pair is generated and the new public key overwrites the old one via the same endpoint. Any attendance records synced with the old key before re-provisioning must be verified against the old key. This requires:

- The `tokenSnapshot` on `AttendanceRecord` to contain the signed token.
- A key history table or an `oldPublicKey` field if retroactive verification of pre-re-provisioning records is required.

**V1 decision**: No key history. Old records' signature status is considered already-verified at sync time. Re-provisioning only affects future verifications.

---

## Password Management

- Passwords are hashed by Better Auth (bcrypt or argon2 — use Better Auth defaults).
- No custom password hashing logic in the NestJS layer.
- Password reset flow: Better Auth provides email-based reset. For v1, Super Admins can trigger resets for teachers; students must contact admin.

---

## Security Considerations

- All auth endpoints must be rate-limited (see `infra-plan.md` for Redis rate limiter).
- JWTs should have a short expiry (15–30 minutes) with refresh token rotation.
- The `Authorization: Bearer` header is the only accepted token transport method — no cookies for the NestJS API (cookies are fine for the Next.js frontend session layer).
- HTTPS is required in all non-local environments. HTTP requests should be rejected or redirected.

---

## Open Questions

- **Better Auth + NestJS integration**: Better Auth's primary integration target is Next.js. The NestJS API needs to verify Better Auth-issued JWTs. Check if Better Auth's JWT signing keys are compatible with a standalone NestJS `passport-jwt` setup, or if a shared secret/public key needs to be configured between the two services.
- **Student onboarding password**: New student accounts may be seeded by Super Admin bulk import (from SIS data). What is the initial password and onboarding flow? Options: temporary password emailed to student email, or studentId as initial password with forced reset.
- **Super Admin scope**: The `scope` field (`department` | `institution`) is stored but no scoped data filtering is implemented in v1. Decide if Super Admins should see all data or only their department's.
