# Solution Challenge Platform

Community needs and volunteer dispatch platform built with a Google-first, student-budget setup.

## Recommendation

Use `Google` first wherever the free tier is practical.

Recommended stack:
- `Firebase Auth` as the preferred auth direction
- `Firebase Hosting` for the frontend
- `Firebase Cloud Messaging` for push notifications
- local `Node.js + Express` backend during development
- `Supabase Postgres` for the hosted database
- local `Postgres + PostGIS` as an optional fully local dev path
- use alternatives only where Google free-tier or billing requirements block the intended path

Why this is the right choice:
- It preserves a clear Google-first story for the project.
- It keeps Firebase services in the places where they are genuinely free and useful.
- It avoids pretending that billing-gated GCP runtime services are usable when they are not.
- It uses alternatives only where free Google options fail in practice.

Reference plan: [docs/google_first_free_tier_plan.md](/Users/aditya/Developer/solutionchallenge/solutionchallenge/docs/google_first_free_tier_plan.md)

## What To Use

Use `Google` first for:
- Authentication
- `Firebase Hosting` for frontend hosting
- `FCM` for notifications
- optional Maps or OCR later if quotas make sense

Use fallback alternatives only where necessary:
- `Supabase Postgres` instead of `Cloud SQL`
- local backend runtime instead of `Cloud Run`
- local file storage, and only then `Supabase Storage` if hosted free storage is needed
- DB-backed backend jobs instead of `Cloud Tasks`
- in-process cron or manual/admin-triggered jobs instead of `Cloud Scheduler`

Avoid as required core dependencies for now:
- `Cloud Run`
- `Cloud SQL`
- `Cloud Tasks`
- `Cloud Scheduler`

## Why Not Full GCP Right Now

The project `noble-network-494010-e1` was accessible, but enabling key runtime services failed because billing is not attached. That makes a full GCP backend path a poor default for this repo.

Practical implication:
- keep backend development local
- keep Firebase integrations as the first choice
- use non-Google alternatives only where billing blocks the Google path
- use `Supabase Postgres` as the hosted DB replacement now

## Current Status

Implemented in this repo:
- backend scaffold in [backend/app.js](/Users/aditya/Developer/solutionchallenge/solutionchallenge/backend/app.js)
- DB schema and migration runner in [infra/init.sql](/Users/aditya/Developer/solutionchallenge/solutionchallenge/infra/init.sql) and [backend/shared/db/migrate.js](/Users/aditya/Developer/solutionchallenge/solutionchallenge/backend/shared/db/migrate.js)
- auth module foundation in [backend/modules/auth](/Users/aditya/Developer/solutionchallenge/solutionchallenge/backend/modules/auth)
- storage abstraction in [backend/shared/storage](/Users/aditya/Developer/solutionchallenge/solutionchallenge/backend/shared/storage)
- backend-only Supabase setup guide in [docs/backend_supabase_setup.md](/Users/aditya/Developer/solutionchallenge/solutionchallenge/docs/backend_supabase_setup.md)

## Student-Budget Setup

### Option A: cheapest and simplest

- local backend
- local Postgres + PostGIS
- local file uploads
- no cloud dependency during core development

### Option B: Google-first with fallback

- local backend
- Firebase Hosting for frontend
- Firebase Auth when the real client flow is implemented
- Supabase Postgres for the hosted DB
- optional Supabase Storage if hosted free storage is needed
- backend-managed jobs instead of Cloud Tasks / Cloud Scheduler

## Fallback Setup

Use fallback services only if needed:

1. Use `Supabase Postgres` for the hosted database.
2. Keep local Postgres + PostGIS available if you want a fully local DB.
3. Prefer local uploads for storage work.
4. Use Supabase Storage only if hosted free object storage is needed.
5. Do not move auth away from Firebase unless the current phase truly requires it.

Backend environment should support:

```env
DATABASE_URL=postgresql://...
AUTH_PROVIDER=local
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STORAGE_BACKEND=local
UPLOADS_DIR=./uploads
LOCAL_ASSET_BASE_URL=/uploads
SUPABASE_STORAGE_BUCKET=report-photos
```

Recommended defaults:
- `AUTH_PROVIDER=local` during early backend work
- `STORAGE_BACKEND=local` during early backend work

Fallback usage only when needed:
- switch `AUTH_PROVIDER=supabase` only if Firebase is not being used for the current phase
- switch `STORAGE_BACKEND=supabase` only if hosted free storage is needed

## Optional Google Setup

Keep these as preferred Google integrations:
- Firebase Auth
- Firebase Hosting
- Firebase Cloud Messaging

Already configured locally:
- [.firebaserc](/Users/aditya/Developer/solutionchallenge/solutionchallenge/.firebaserc)
- [firebase.json](/Users/aditya/Developer/solutionchallenge/solutionchallenge/firebase.json)

That keeps the project Google-first without making the backend depend on billing-gated GCP services.

## Service Replacements For Blocked GCP Runtime Services

Chosen replacements:
- `Cloud SQL` → `Supabase Postgres`
- `Cloud Run` → local `Node.js + Express` backend during development
- `Cloud Tasks` → backend-managed job table and worker logic
- `Cloud Scheduler` → in-process cron or admin/manual triggers

What this means in practice:
- scoring recalculation jobs can run from backend cron initially
- deduplication jobs can run from backend cron initially
- escalation timers should be stored in DB and processed by backend polling/cron
- API-triggered work stays inside the monolith until scale requires extraction

## Run The Backend

```bash
cd backend
npm install
npm test
npm start
```

If the database is configured:

```bash
npm run db:check
npm run migrate
```

## Next Implementation Direction

1. Replace Firebase-only auth assumptions with provider-based auth support.
2. Keep storage fallback-capable with `local` first and hosted fallback second.
3. Keep the SQL schema Postgres-compatible and target Supabase Postgres as the hosted DB.
4. Implement ingestion and background job flows on top of this Google-first free-tier base.
