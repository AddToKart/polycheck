# Coolify (backend + database) and Vercel (web) runbook

Topology: **Coolify** runs one stack from `docker-compose.coolify.yml` (PostgreSQL, Redis, the NestJS API, the scan
gateway). **Vercel** hosts the Next.js web app. A separate Vercel project hosts the landing/install page
(`polycheck-landing-page` repo), whose download button points at the latest GitHub Release of this repo.

## 1. Redeploying an existing Coolify stack

Every variable that already exists in Coolify keeps working: this change only **adds** variables and replaces the
demo `seed` service with `bootstrap-admin`. Nothing else in the compose file changed its defaults.

1. In Coolify, open the stack and **Redeploy**. The `migrate` service applies any new migration automatically;
   existing data is kept.
2. Check the backend logs for `Nest application successfully started`, then
   `https://<API_DOMAIN>/api/health/ready` must return `200`.

### Starting from a blank system

Redeploying never deletes data. If the database currently holds demo data and you want a blank system, the
PostgreSQL volume has to be deleted deliberately (Coolify → the stack → Persistent Storage → remove
`postgres-data`). **This is irreversible**: export anything you need first. On the next deploy `migrate` rebuilds the
empty schema (plus 12 default setting rows) and nothing else is written.

### Creating the first super administrator (once)

Set these in the stack's environment, then run the one-off service or the command below:

| Variable | Notes |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | Sign-in email of the first super administrator |
| `BOOTSTRAP_ADMIN_PASSWORD` | 12-128 chars with upper, lower, digit and symbol |
| `BOOTSTRAP_ADMIN_NAME` | Optional display name (default `System Administrator`) |

Run it with either:

- the **backend container terminal** in Coolify: `node dist-seed/prisma/bootstrap-admin.js`, or
- `docker compose -f docker-compose.coolify.yml --profile bootstrap run --rm bootstrap-admin`.

The script creates exactly one institution super admin, never touches an existing user with that email, and flags the
password for rotation: the first sign-in forces a new password, after which you should **delete the two
`BOOTSTRAP_ADMIN_*` variables**. Everything else (teachers, students, sections) is created from the admin console or
the bulk import.

After signing in, open **Institution Settings** and set the institution name, short name, campus and logo. Until you
do, the login screen shows "Your Institution".

## 2. Variables to verify in Coolify (existing ones, do not need changing)

| Variable | Should be |
|---|---|
| `BETTER_AUTH_URL` | `https://<your API host>` (no `/api`) |
| `CORS_ORIGINS` | comma-separated **web origins** (Vercel app URL and/or your app domain), `https://` |
| `FRONTEND_URL` | the web app's public URL |
| `API_DOMAIN` | the API host used by the Traefik routing rules |
| `TRUST_PROXY_HOPS` | number of proxies in front of the API (verify once: a wrong value makes every client look like one IP and trips rate limits) |
| `NODE_ENV` | note: the compose default is `development` when unset |

`NODE_ENV=production` additionally requires PgBouncer-style `DATABASE_URL` parameters, `STORAGE_DRIVER=s3` and a
`METRICS_TOKEN`, none of which this single-stack compose provides, so a single-server stack currently runs with the
`development` hardening profile. Treat that as a known limitation of this topology.

Optional (all default to today's behaviour): `COURSE_SCOPE_MODE`, `SYNC_WORKER_ENABLED`, `SYNC_WORKER_CONCURRENCY`,
`MAIL_DRIVER`, `RESEND_API_KEY`, `MAIL_FROM`, `RESEND_WEBHOOK_SECRET`.

## 3. Vercel (web app)

- `NEXT_PUBLIC_API_URL` = `https://<API host>/api` (note the `/api` suffix). It is baked in at **build** time, so
  changing it needs a redeploy.
- Vercel deploys the branch configured as its Production Branch. `dev` only produces a preview deployment.

### Same-site requirement (important)

The session cookie is `HttpOnly`, `Secure` in production and `SameSite=Strict`, and the web app calls the API directly
with `credentials: "include"`. A browser only stores and sends such a cookie when the web app and the API are on the
**same registrable domain**. `*.vercel.app` + `api.other-domain.tld` is cross-site and is expected to fail with login
loops; `app.example.com` + `api.example.com` works. Put both on one domain you own.

## 4. Landing page and the APK

- The landing page links to `https://github.com/AddToKart/polycheck/releases/latest/download/polycheck-release.apk`.
- Pushing to `main` or `dev` with a change under `polycheck_mobile/` runs the **Flutter Android release APK** workflow,
  which signs the APK with the repository's keystore secrets, refuses to publish a debug-signed build, and attaches it
  to the release tagged from `pubspec.yaml` (`apk-v<version>`), marked "latest". Bump `version:` in `pubspec.yaml` for
  every release (the number after `+` is the Android `versionCode` and must increase).
- Landing page variable: `NEXT_PUBLIC_WEB_APP_URL` (the "Open Web Dashboard" link). Build-time; redeploy after changing.

## 5. Changing the domain later

What is tied to a hostname, and what to do for each:

| Where | What | Action |
|---|---|---|
| DNS | A/CNAME records for the web, API and landing hosts | Point them at Vercel / the Coolify server; wait for DNS |
| Coolify | `API_DOMAIN`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `FRONTEND_URL` | Edit the variables, **Redeploy**. Coolify's proxy requests the TLS certificate once DNS resolves |
| Vercel (web) | Domain + `NEXT_PUBLIC_API_URL` | Add the domain, update the variable, **Redeploy** (build-time) |
| Vercel (landing) | Domain + `NEXT_PUBLIC_WEB_APP_URL` | Add the domain, update the variable, **Redeploy** |
| Email | Resend domain, `MAIL_FROM` | Verify the new domain at Resend first, then update `MAIL_FROM` |
| **Android app** | API URL is **compiled into the APK** | See below |

**The API host is the one to choose carefully.** Students' installed APK talks to the API host it was built with. If the
API hostname changes, every installed app keeps calling the old name until the user installs a new APK. Plan it like this:

1. Keep the **old API host working** (leave its DNS record and Traefik rule in place) while the new one goes live.
2. Set the new default in `polycheck_mobile/lib/src/core/network/api_config.dart` (or pass
   `--dart-define=API_BASE_URL=https://<new>/api` in the workflow), bump `version:`, push, and let the workflow publish.
3. Ask students to install the new APK, then retire the old host after everyone has moved.

Web and landing hostnames can change freely; they only cost users a fresh sign-in (cookies, service worker and
installed-PWA state are per-origin).
