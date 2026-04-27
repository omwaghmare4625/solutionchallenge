# Backend Supabase Setup

Scope: `implementation_plan.md` Phase `1.1` to `1.3` only.

This setup is only for:
- `1.1` Database bootstrap
- `1.2` Auth module foundation
- `1.3` Storage abstraction foundation

## What You Actually Need Right Now

For `1.1` only:
- `DATABASE_URL`

For `1.2` if you want Supabase-backed auth immediately:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

For `1.3` if you want Supabase Storage instead of local uploads:
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If you want the simplest path for now:
- use `Supabase Postgres` for DB
- keep `AUTH_PROVIDER=local`
- keep `STORAGE_BACKEND=local`

That is the easiest way to complete Phase `1.1` to `1.3` without adding extra moving parts.

## Step 1: Create the Supabase Project

1. Create a new Supabase project.
2. Wait for the database to finish provisioning.
3. Open the project dashboard.

## Step 2: Get the Database URL

In Supabase:
1. Open `Project Settings`
2. Open `Database`
3. Copy the Postgres connection string

Use the server-side connection string for Node.js, not the anon key.

Recommended shape:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
```

If Supabase gives you multiple connection options, prefer the normal Postgres connection string for backend migrations.

## Step 3: Prepare the Backend Env File

Create `backend/.env` from `backend/.env.example`.

Minimum DB-only setup:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
AUTH_PROVIDER=local
STORAGE_BACKEND=local
UPLOADS_DIR=./uploads
LOCAL_ASSET_BASE_URL=/uploads
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=ChangeMe123!
DEFAULT_ADMIN_LOCALE=en-IN
DEFAULT_NGO_NAME=Default NGO
```

If you also want Supabase auth/storage support ready:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=report-photos
```

## Step 4: Install Dependencies

```bash
cd backend
npm install
```

## Step 5: Check the DB Connection

Before migrating, verify the DB connection:

```bash
npm run db:check
```

Expected result:

```json
{
  "ok": true,
  "database": "connected"
}
```

## Step 6: Run the Schema Migration

```bash
npm run migrate
```

This applies `infra/init.sql`.

The current schema expects:
- `pgcrypto`
- `postgis`

If the migration fails on extensions, check the Supabase extension support/settings in the dashboard and confirm `postgis` is enabled for the project.

## Step 7: Seed the NGO and Admin

For local auth:

```bash
npm run seed:auth
```

This creates:
- one NGO
- one admin user

With the current backend:
- if `AUTH_PROVIDER=local`, the admin is created only in the app DB
- if `AUTH_PROVIDER=supabase`, the admin is created in Supabase Auth and the app DB

## Recommended Phase 1.1–1.3 Setup

Use this for now:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
AUTH_PROVIDER=local
STORAGE_BACKEND=local
```

Why:
- it completes `1.1` cleanly with hosted Postgres
- it avoids extra auth/storage complexity before ingestion is implemented
- it keeps `1.2` and `1.3` operational without requiring every Supabase feature on day one

## When To Turn On Supabase Auth

Switch to:

```env
AUTH_PROVIDER=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

only when you are ready to use real token-based auth flow.

## When To Turn On Supabase Storage

Switch to:

```env
STORAGE_BACKEND=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=report-photos
```

only when you actually want hosted uploads.
