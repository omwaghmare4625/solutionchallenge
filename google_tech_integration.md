# Google Technology Integration Map
## Community Needs & Volunteer Dispatch Platform

> Every module in the implementation plan mapped to a Google technology. Where a Google service replaces an existing tool, the original is noted.

---

## 1. Authentication & Users — Module 1.2

### Firebase Authentication
- **Replaces:** bcrypt + manual JWT issuance in `auth/service.js`
- **How:** Use Firebase Auth for email/password login. Verify Firebase ID tokens server-side using the Firebase Admin SDK (`admin.auth().verifyIdToken(token)`).
- **Why:** Handles token refresh, revocation, and session management out of the box. Also unlocks phone OTP and Google Sign-In with zero extra code.

### Firebase Custom Claims
- **Replaces:** Manual JWT payload construction `{ user_id, role, ngo_id }`
- **How:** On user creation, call `admin.auth().setCustomUserClaims(uid, { role, ngo_id })`. Claims are embedded in every Firebase ID token automatically.
- **Why:** Eliminates the `middleware.js` token-decode logic — claims are verified as part of the Firebase token itself.

---

## 2. Database — Module 1.1

### Cloud SQL (PostgreSQL + PostGIS)
- **Replaces:** Self-hosted PostgreSQL
- **How:** Provision a Cloud SQL Postgres instance with the PostGIS extension enabled. The entire `init.sql` schema runs unchanged. Connect via the Cloud SQL Auth Proxy or a private IP.
- **Why:** Managed backups, automatic failover, and vertical scaling with zero schema changes. All GIST indexes and PostGIS geometry queries work identically.

### Firestore *(optional upgrade)*
- **Replaces:** `volunteer_locations` table in Postgres
- **How:** Write volunteer location updates directly to a Firestore document per `user_id`. The admin map (Module 2.3) subscribes to real-time updates via the Firestore SDK listener.
- **Why:** Eliminates the 60-second polling loop in the admin UI. Location changes push to the map instantly.

### Memorystore (Redis) — Phase 5 / Module 5.1
- **Replaces:** Direct PostGIS queries on every dispatch cycle
- **How:** Google-managed Redis. Cache `volunteer_locations` keyed by `user_id`. Invalidate on `POST /volunteer/location/update`.
- **Why:** Maps directly to the Phase 5.1 trigger condition: Postgres location queries exceeding 100ms p95.

---

## 3. File Storage — Modules 1.3 & 4.6

### Google Cloud Storage (GCS)
- **Replaces:** Local disk (`local.js`) initially; AWS S3 (`s3.js`) in Module 4.6
- **How:** Implement `shared/storage/gcs.js` using `@google-cloud/storage`. The `save`, `getUrl`, and `delete` interface is unchanged — swap `STORAGE_BACKEND=gcs` in `.env`.
- **Why:** GCS is S3-compatible at the API level. The SDK swap is a one-line config change. `getUrl()` returns signed URLs identically to S3.

### Cloud CDN
- **Sits in front of:** GCS bucket
- **How:** Enable Cloud CDN on the GCS backend. Photo URLs served via CDN edge nodes instead of direct bucket access.
- **Why:** Reduces latency on admin report card thumbnails (Module 1.8) and volunteer task mini-maps (Module 3.6) for users across India.

---

## 4. OCR Pipeline — Module 1.5

### Cloud Vision API
- **Replaces:** `tesseract.js` in `ocr.service.js`
- **How:** Call `vision.textDetection(imageBuffer)` from the `@google-cloud/vision` SDK. The response returns a full-text annotation with confidence scores per word — map directly to `ocr_confidence`.
- **Why:** Handles low-quality field photos, poor lighting, and non-Latin scripts far better than Tesseract. Critical for the India deployment context.

### Cloud Vision — Document AI
- **Replaces:** Tesseract language packs for Hindi/Marathi
- **How:** Use the Document AI Form Parser processor trained for Devanagari script. Returns structured key-value pairs from paper surveys.
- **Why:** Directly addresses the `hi-IN` and `mr-IN` locale support required in Module 4.4. Tesseract's Devanagari support requires custom training data to reach acceptable confidence scores.

### Gemini API
- **Replaces:** Keyword-map logic in `ocr.mapper.js` and `ocr-category-map.json`
- **How:** After Vision API extracts raw text, pass it to Gemini with a structured prompt: *"Extract category_key, severity (1-5), lat, lng from this text. Return JSON only."* Parse the response directly into the normalizer output schema.
- **Why:** Handles ambiguous, incomplete, or freeform survey text that keyword matching misses. Increases `ocr_confidence` on edge cases.

---

## 5. Maps & Geolocation — Modules 2.3, 3.1, 3.2, 3.6

### Google Maps JavaScript API
- **Replaces:** Leaflet.js in the admin map frontend
- **How:** Use `@googlemaps/js-api-loader` in the React map component. Render `need_clusters` as map markers with severity-keyed icons. Use the built-in MarkerClusterer library for dense areas.
- **Why:** Better India map data, native heatmap layer support, and Street View context for admins reviewing reports.

### Geocoding API
- **Augments:** Raw `lat`/`lng` fields on reports and clusters
- **How:** On report approval, call `maps.geocode({ location: { lat, lng } })` and store the formatted address. Display in the admin review screen (Module 1.8) and volunteer task detail (Module 3.6).
- **Why:** Reviewers and volunteers see "Dharavi, Mumbai" instead of `19.0428, 72.8545`.

### Distance Matrix API
- **Replaces:** Haversine formula in `dispatch-score.js` (Module 3.2)
- **How:** Call `distancematrix.getDistanceMatrix({ origins: [volunteerLatLng], destinations: [clusterLatLng], travelMode: 'DRIVING' })`. Use `duration.value` (seconds) as the proximity input instead of straight-line km.
- **Why:** In Indian cities, road distance diverges significantly from straight-line distance. A volunteer 1km away by Haversine may be 4km by road. Using actual travel time improves dispatch accuracy for the `proximity_score` component.

### Maps Embed / Static API
- **Used in:** `TaskDetail.jsx` — Module 3.6
- **How:** Render a `<img src="https://maps.googleapis.com/maps/api/staticmap?center=LAT,LNG&markers=LAT,LNG&zoom=15&size=400x200&key=...">` on the task detail page.
- **Why:** No full Maps SDK needed for a single pin. Loads faster on low-bandwidth mobile connections, which is relevant for field volunteers.

---

## 6. Push Notifications — Modules 3.4, 3.5, 4.5

### Firebase Cloud Messaging (FCM)
- **Status:** Already in the plan — this is the specified notification layer.
- **Backend:** Send via Firebase Admin SDK: `admin.messaging().send(message)`. The FCM payload in Module 3.4 maps directly to this.
- **Frontend:** `useFCM.js` hook calls `getToken(messaging, { vapidKey })` on login and POSTs the token to the backend.
- **Note:** Module 4.5 falls back to Twilio SMS when `fcm_token` is null — this logic remains unchanged.

### Firebase In-App Messaging *(optional)*
- **Augments:** FCM for volunteers who already have the PWA open
- **How:** Configure campaigns in the Firebase console triggered by the `task_dispatched` analytics event. Displays a banner inside the app.
- **Why:** FCM push notifications are suppressed by some Android battery-saving modes. In-app messaging is a reliable fallback when the app is already open.

---

## 7. Google Forms Ingestion — Module 4.2

### Google Forms + Apps Script
- **Status:** Already in the plan — Module 4.2 is the Google Forms channel.
- **How:** Attach an Apps Script trigger to the form: `ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create()`. The handler POSTs the response JSON to `/ingestion/gforms` with the `GFORMS_WEBHOOK_SECRET` header.
- **NGO field mapping:** Each NGO's `dispatch_weight_config.gforms_field_map` in the DB defines which form field names map to `category_key`, `severity`, `coordinates`.

### Google Sheets API *(alternative ingestion channel)*
- **Augments:** Forms webhook with a scheduled pull option
- **How:** NGOs that collect data in Google Sheets (common in field operations) can share their sheet with a service account. A Cloud Scheduler job polls the sheet hourly via the Sheets API v4 and ingests new rows as reports.
- **Why:** Covers the case where NGOs use Sheets directly rather than Forms — no change to the normalizer.

---

## 8. Infrastructure & Hosting — All Phases

### Cloud Run
- **Hosts:** Express monolith backend
- **How:** Containerise the backend (`Dockerfile`), push to Artifact Registry, deploy to Cloud Run. Set `DATABASE_URL` and other env vars as Cloud Run secrets.
- **Scaling:** Scales to zero when idle (cost-effective for NGO budgets). Maps to Phase 5.3 — add a minimum instance count and a load balancer when CPU exceeds 70% sustained.

### Firebase Hosting
- **Hosts:** React PWA (Modules 1.7 and 3.6)
- **How:** `firebase deploy --only hosting` after `npm run build`. Configure `firebase.json` to serve `index.html` for all routes (SPA routing) and set correct headers for `manifest.json` and service workers.
- **Why:** CDN-distributed, supports required PWA headers (`Cache-Control`, `Service-Worker-Allowed`), and free SSL.

### Cloud Tasks
- **Replaces:** `node-cron` in `jobs/runner.js` for one-off background jobs
- **How:** When a report is approved, enqueue a Cloud Tasks HTTP task targeting `/internal/jobs/score-cluster`. The task handler runs `scoring/service.js` for that cluster.
- **Why:** Unlike `node-cron`, Cloud Tasks retries on failure, supports dead-letter queues, and survives server restarts — important for OCR jobs (Module 1.5) that block API responses.

### Cloud Scheduler
- **Replaces:** `node-cron` for recurring jobs
- **How:** Create three Cloud Scheduler jobs targeting Cloud Run:
  - Every 15 minutes → `POST /internal/jobs/recalculate-scores` (Module 2.1)
  - Every 15 minutes → `POST /internal/jobs/run-deduplication` (Module 2.2)
  - Every 30 minutes → `POST /internal/jobs/expire-sessions` (Module 3.1)
- **Why:** Jobs run even if the Cloud Run instance has scaled to zero — a cron embedded in the app would never fire if no request woke the instance first.

### Cloud Pub/Sub *(Phase 5.2)*
- **Replaces:** In-process `shared/events` EventEmitter
- **How:** Replace `events.emit('report.created', payload)` with a Pub/Sub publish to a `report-created` topic. Each consumer module subscribes with its own push subscription pointing to its Cloud Run service.
- **When:** Only implement this when Phase 5.2 triggers — i.e., OCR jobs blocking API responses beyond 2 seconds. The current EventEmitter is correct until then.

---

## 9. Analytics & Monitoring

### Firebase Analytics
- **Used in:** React PWA (Modules 1.7, 3.6)
- **How:** Call `logEvent(analytics, 'report_submitted', { category_key, severity, ngo_id })` on form submit. Log `task_claimed`, `task_resolved`, `session_started` for volunteer flow tracking.
- **Why:** Provides per-NGO funnel data — how many reports submitted vs approved vs clustered vs resolved — without building a custom analytics backend.

### Cloud Logging + Error Reporting
- **Replaces:** Custom log format to stdout
- **How:** Use the `@google-cloud/logging` SDK to emit structured JSON logs. The existing format `{ timestamp, module, route, error_code, user_id }` maps directly to Cloud Logging's `jsonPayload`. Error Reporting auto-groups 5xx exceptions.
- **Why:** The plan's error handling standard (4xx = INFO, 5xx = ERROR) maps directly to Cloud Logging severity levels. Alerts can be set on 5xx error rate spikes.

### Looker Studio *(NGO reporting)*
- **Connects to:** Cloud SQL directly
- **How:** Add Cloud SQL as a Looker Studio data source (BigQuery connector or Cloud SQL connector). Build dashboards for: resolved clusters by category, average dispatch-to-resolution time, volunteer fatigue levels by week.
- **Why:** Provides NGO admins with reporting beyond the live map — no custom chart code needed, no extra backend endpoints.

---

## 10. Translation & i18n — Module 4.4

### Cloud Translation API
- **Augments:** Static i18n catalog in `/frontend/src/i18n/`
- **How:** At report write time, call `translate.translate(description, ['hi', 'mr'])` and store translated strings alongside the original in the `reports` table. FCM notification bodies are translated using the recipient's `user.locale` before sending.
- **Why:** The static `categories.json` catalog covers fixed labels, but free-text `description` fields entered by field workers need dynamic translation for multi-locale admin review.

---

## Summary — Module-to-Google-Service Map

| Module | Current plan | Google replacement / addition |
|---|---|---|
| 1.1 Database | Self-hosted PostgreSQL | Cloud SQL (PostgreSQL + PostGIS) |
| 1.1 Location cache | — | Memorystore (Redis) — Phase 5.1 |
| 1.2 Auth | bcrypt + JWT | Firebase Authentication + Custom Claims |
| 1.3 / 4.6 Storage | Local disk → S3 | Google Cloud Storage |
| 1.5 OCR | tesseract.js | Cloud Vision API + Document AI |
| 1.5 Field extraction | ocr-category-map.json | Gemini API |
| 1.7 / 3.6 Hosting | — | Firebase Hosting |
| 2.3 Admin map | Leaflet.js | Maps JavaScript API |
| 2.3 Address display | Raw lat/lng | Geocoding API |
| 3.1 Volunteer locations | Postgres table | Firestore (real-time) |
| 3.2 Proximity score | Haversine | Distance Matrix API |
| 3.4 / 3.5 Notifications | FCM (already Google) | Firebase Cloud Messaging ✓ |
| 3.6 Task mini-map | — | Maps Static API |
| 4.2 Forms ingest | Google Forms (already) | Google Forms + Apps Script ✓ |
| 4.4 i18n | Static catalog | Cloud Translation API |
| All jobs (node-cron) | node-cron | Cloud Scheduler + Cloud Tasks |
| Backend hosting | — | Cloud Run |
| Event bus (at scale) | EventEmitter | Cloud Pub/Sub (Phase 5.2) |
| Logging | stdout JSON | Cloud Logging + Error Reporting |
| Reporting | — | Looker Studio |
| Analytics | — | Firebase Analytics |
| CDN | — | Cloud CDN (in front of GCS) |
