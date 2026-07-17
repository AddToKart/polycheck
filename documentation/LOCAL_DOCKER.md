# Local Docker Environment

This stack runs the Polycheck web application, API, PostgreSQL, and Redis entirely in Docker. Android remains on the emulator or physical device and connects through the backend port exposed by Docker.

## Prerequisites

- Docker Desktop with Linux containers enabled
- Docker Compose v2

Node.js, pnpm, PostgreSQL, and Redis are not required on the host for this workflow.

## First start

From the repository root, create the ignored local environment file:

```powershell
Copy-Item .env.docker.local.example .env.docker.local
```

The example values are for local development only. You may change them before the first start. Do not commit `.env.docker.local`.

Build and start the isolated stack:

```powershell
docker compose -f docker-compose.local.yml --env-file .env.docker.local up -d --build
```

The backend automatically applies all pending Prisma migrations before it starts. Seed the fresh database once:

```powershell
docker compose -f docker-compose.local.yml --env-file .env.docker.local --profile tools run --rm seed
```

Equivalent pnpm shortcuts are available:

```powershell
pnpm docker:local:up
pnpm docker:local:seed
```

## Addresses

- Web application: http://localhost:3000/login
- Backend health: http://localhost:4000/api/health
- Backend readiness: http://localhost:4000/api/health/ready
- Swagger API documentation: http://localhost:4000/api/docs

PostgreSQL and Redis are available only inside the Compose network. They are intentionally not published to host ports.

## Seed accounts

All seeded accounts use the `SEED_PASSWORD` configured in `.env.docker.local` when the database is created.

- Super Admin: `mcreyes@pup.edu.ph`
- Teacher: `jmdelacruz@pup.edu.ph`
- Student: `2024-00001-MN-0`

Seeding an existing database does not overwrite existing passwords.

## Daily commands

```powershell
# Start or rebuild after source changes
pnpm docker:local:up

# Follow all service logs
pnpm docker:local:logs

# Follow one service
docker compose -f docker-compose.local.yml --env-file .env.docker.local logs -f backend

# Show container health
docker compose -f docker-compose.local.yml --env-file .env.docker.local ps

# Stop the stack and retain all data
pnpm docker:local:down
```

The local stack runs optimized application images. Source changes require `pnpm docker:local:up` to rebuild the affected image.

## Reset local data

This permanently removes the local Docker database, Redis state, and proof uploads:

```powershell
docker compose -f docker-compose.local.yml --env-file .env.docker.local down -v
```

Run the first-start and seed commands again afterward. Do not use `down -v` when the local data must be retained.

## Android connection

Keep the Docker stack running while launching Android outside Docker.

An Android Studio emulator reaches the backend at:

```text
http://10.0.2.2:4000/api
```

The development API client selects this address automatically. A physical phone must use the computer's LAN address and be on the same network:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.10:4000/api"
Set-Location android
npx expo run:android --device
```

Replace `192.168.1.10` with the computer's IPv4 address. Allow inbound TCP port 4000 through Windows Firewall when necessary.

## Why this differs from production Compose

The local backend intentionally runs with `NODE_ENV=development`. This keeps the authentication cookie usable over local HTTP while preserving HttpOnly and SameSite protections. The production stack uses Secure cookies and must run behind HTTPS.
