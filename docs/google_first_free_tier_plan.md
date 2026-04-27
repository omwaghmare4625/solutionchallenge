# Google-First Free-Tier Plan

## Summary

Build the platform as `Google-first` wherever free Firebase or GCP services are sufficient. Use alternatives only where the free-tier path fails because of hard billing requirements or missing free capability.

Primary strategy:
- Prefer `Firebase` and free Google services first
- Keep the backend running locally during development
- Use explicit alternatives only for capabilities blocked by billing or missing from the free path

## Core Decisions

- `Firebase Auth` remains the preferred auth direction when free-tier usage is enough.
- `Firebase Hosting` remains the preferred frontend hosting option.
- `Firebase Cloud Messaging` remains the preferred push notification option.
- `Google Maps`, `Vision`, and other Google APIs remain preferred if their free quotas are enough for the module being built.
- `Cloud Run`, `Cloud SQL`, `Cloud Tasks`, and `Cloud Scheduler` are not part of the default free-tier path because they are blocked by billing requirements on the current project.
- `Supabase Postgres` is the chosen replacement for `Cloud SQL`.
- local backend execution is the chosen replacement for `Cloud Run`.
- in-process jobs and DB-backed scheduling are the chosen replacement for `Cloud Tasks` and `Cloud Scheduler` during development.

## Fallback Rules

Use alternatives only in these cases:
- Database hosting:
  - prefer `Supabase Postgres` as the hosted database
  - keep local Postgres + PostGIS available for completely local work
- Auth:
  - prefer Firebase Auth
  - use local auth for backend development or Supabase Auth only if Firebase becomes impractical for the current phase
- Storage:
  - prefer local file storage in development
  - use Supabase Storage only if hosted free storage is needed and GCS is not usable without billing

- Runtime:
  - replace `Cloud Run` with a locally run Node.js + Express backend during development
- Background jobs:
  - replace `Cloud Tasks` with DB-backed job records processed by the backend
  - replace `Cloud Scheduler` with app-level cron or manual/admin-triggered jobs until a hosted scheduler is justified

This means the project direction is not `Supabase-first`. Supabase is a fallback provider for the specific parts where the Google free path is blocked.

## Recommended Practical Stack

- Frontend hosting: `Firebase Hosting`
- Notifications: `Firebase Cloud Messaging`
- Auth: `Firebase Auth` when integrating the real client flow
- Backend runtime: local Node.js + Express
- Hosted database: `Supabase Postgres`
- Local database option: local Postgres + PostGIS
- File storage: local by default, Supabase Storage only as fallback
- Jobs: in-process or DB-backed jobs instead of Cloud Tasks / Cloud Scheduler

## Current Constraint

Project `noble-network-494010-e1` is accessible, but key GCP runtime services could not be enabled because billing is not attached. That specifically affects:
- `Cloud Run`
- `Cloud Tasks`
- `Cloud Scheduler`
- Cloud Run registry dependencies

Because of that, the default implementation path must avoid depending on those services.

## Service Replacement Map

- `Cloud SQL` → `Supabase Postgres`
- `Cloud Run` → local backend process during development
- `Cloud Tasks` → app-managed job table and worker logic in the backend
- `Cloud Scheduler` → in-process cron or admin/manual triggers until hosted scheduling is needed

## Interfaces To Preserve

- Keep the Express backend and SQL schema structure.
- Keep the storage adapter contract as `save/getUrl/delete`.
- Keep the event bus contract unchanged.
- Keep the codebase flexible enough to support Firebase-first integrations later.

## Assumptions

- Google-first product direction is mandatory.
- Student-budget constraints mean free-tier practicality matters more than architectural purity.
- Fallback providers are allowed only where Google free-tier usage is not realistic or not available.
