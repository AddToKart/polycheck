# Local Docker Environment

This stack runs the Polycheck web application, API, PostgreSQL, and Redis entirely in Docker. Android remains on the emulator or physical device and connects through the backend port exposed by Docker.

Local Docker intentionally uses the `local` proof-storage driver and a persistent volume. Production requires the `s3` driver so backend instances remain stateless and horizontally scalable.

## Prerequisites

- Docker Desktop with Linux containers enabled
- Docker Compose v2

Node.js, pnpm, PostgreSQL, and Redis are not required on the host for this workflow.

## First start (1-Click / 1-Shot Onboarding)

To set up, build, migrate, and seed the entire local environment:

### 1-Click Launchers (Double-Click):

- **Windows**: Double-click **`start-local.bat`** (or execute `.\start-local.bat`).
- **macOS / Linux**: Run **`./start-local.sh`** (make executable with `chmod +x start-local.sh` if needed).

_This verifies Docker is running, prepares `.env.docker.local`, builds all images, applies database migrations, seeds test accounts, waits for readiness, and opens `http://localhost:3000/login` in your default browser automatically._

To stop the containers, double-click **`stop-local.bat`** (Windows) or execute **`./stop-local.sh`** (macOS/Linux).

### Using pnpm (Terminal):

```sh
pnpm docker:local:setup
```

_Note: This automatically prepares `.env.docker.local` from the example file if not already present, builds both frontend and backend, applies migrations, and seeds default test accounts._

### Using Pure Docker (No Node.js or pnpm required on the host):

```sh
docker compose -f docker-compose.local.yml up -d --build
```

_Environment variables and default passwords are pre-configured automatically in `docker-compose.local.yml`. Database migrations and seed data run automatically before the backend starts._

## Addresses

- Web application: http://localhost:3000/login
- Backend health: http://localhost:4000/api/health
- Backend readiness: http://localhost:4000/api/health/ready
- Swagger API documentation: http://localhost:4000/api/docs

PostgreSQL is published to `127.0.0.1:55432` (avoiding default 5432 port collisions) and Redis to `127.0.0.1:6379`.

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
