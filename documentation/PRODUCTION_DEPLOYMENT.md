# Polycheck Production Deployment

## Release gate

The CI workflow blocks container builds unless all of the following pass:

- Backend formatting, linting, TypeScript, unit coverage, and integration tests
- Shared package build
- Frontend linting, Vitest tests, TypeScript, and optimized Next.js build
- Android TypeScript validation
- Backend and frontend multi-stage Docker builds
- Production dependency audit and HIGH/CRITICAL container vulnerability scans

Run the same checks locally with:

```sh
pnpm install --frozen-lockfile
pnpm --filter @polycheck/backend prisma:generate
pnpm --filter @polycheck/backend format:check
pnpm --filter @polycheck/backend lint:check
pnpm --filter @polycheck/backend typecheck
pnpm --filter @polycheck/backend test:ci
pnpm --filter @polycheck/backend test:e2e
pnpm --dir frontend lint
pnpm --dir frontend test
pnpm --filter @polycheck/shared build
pnpm --filter @polycheck/backend build
pnpm --dir frontend build
pnpm --dir android typecheck
```

## Configuration

Copy `.env.production.example` to `.env.production` and replace every placeholder. Never commit the resulting file.

Important constraints:

- `BETTER_AUTH_SECRET` must contain at least 32 random characters and must be managed as a deployment secret.
- `BETTER_AUTH_URL` must be the public HTTPS API origin. Keep it stable across releases so browser and mobile sessions remain valid.
- `CORS_ORIGINS` must contain only the exact HTTPS web origins allowed to call the API.
- `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` must use the deployed HTTPS origins.
- Keep the web app and API on the same registrable domain, such as `polycheck.example.edu` and `api.polycheck.example.edu`, so the strict authentication cookie remains same-site.
- Production startup fails closed if PostgreSQL, Redis, Better Auth, S3-compatible proof storage, or production CORS settings are missing or unsafe.
- `STORAGE_DRIVER=s3` is mandatory in production. Configure `S3_BUCKET` and `S3_REGION`; use `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true` for MinIO or another S3-compatible provider. Credentials may come from environment variables or the platform's workload identity/IAM role.
- `TRUST_PROXY=true` is required behind the deployment reverse proxy so audit records and rate limits use the real client address.

Android release builds require `EXPO_PUBLIC_API_URL` to be set to the publicly reachable HTTPS API URL during the Expo/EAS build.

## Start

```sh
docker compose --env-file .env.production up -d --build
```

The backend container resolves the bundled Prisma CLI and runs `prisma migrate deploy` before starting NestJS. The application runs as an unprivileged user. Proof images are stored in the configured S3-compatible bucket, while PostgreSQL stores their internal object references.

Expose the frontend and backend only through a TLS-terminating reverse proxy. PostgreSQL and Redis intentionally have no host ports in the production Compose definition.

## Readiness and monitoring

- Liveness: `GET /api/health`
- Readiness: `GET /api/health/ready`

Readiness returns success only when PostgreSQL and Redis are available in production. Redis-backed rate limiting and idempotency fail closed, the Socket.IO Redis adapter is mandatory, and BullMQ will prevent startup if its durable sync worker cannot connect. Configure the load balancer to remove an instance when readiness fails. Application logs are structured JSON and include request IDs, response status, and latency without request bodies or credentials.

## Data operations

- Back up PostgreSQL and enable versioning, lifecycle protection, encryption, and backups on the proof bucket.
- Test restoring the database and proof bucket references together before launch and on a recurring schedule.
- Redis persistence is enabled, but PostgreSQL remains the authoritative source of truth.
- Production seeding is disabled by default. It requires both `ALLOW_PRODUCTION_SEED=true` and a unique `SEED_PASSWORD` of at least 12 characters.

## Rollback

Deploy immutable image tags. To roll back application code, redeploy the previous backend and frontend tags. Database migrations must remain backward-compatible with the immediately previous release; use a forward migration for database rollback rather than deleting migration history.
