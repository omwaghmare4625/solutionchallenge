# Community Needs & Volunteer Dispatch Platform
## Implementation Plan for Coding Agents
### Derived from Architecture v2.0

---

> **How to read this document:** Each Phase is a deployable milestone. Each Module within a phase is an independently implementable unit. Every module includes: precise scope, file/folder targets, acceptance criteria, inter-module dependencies, and the exact data contracts it publishes or consumes. A coding agent should be able to pick up any module spec and implement it without reading the full architecture doc.

---

## System Overview

**Stack:** Node.js (Express) monolith | PostgreSQL + PostGIS | React PWA | Leaflet.js | FCM  
**Repo structure (target):**
```
/backend
  /modules/{ingestion,deduplication,scoring,validation,matching,notifications,auth}
  /shared/{events,db,storage}
  /jobs/
/frontend/src/{pages,components,hooks,i18n}
/infra/
```

**Ground rule for all agents:** Modules communicate ONLY through the shared event bus (`/shared/events`). No module imports another module's service layer directly. DB access is always via `/shared/db` connection pool — never open a second connection.

---

## PHASE 1 — The Real Foundation (Weeks 1–3)

**Phase goal:** A real field worker can photograph a paper survey, submit it from their phone, an admin reviews and approves it, and it lands correctly in the database.

**Phase 1 deliverable check:** One end-to-end path working: photo submitted → OCR run → report in DB with correct schema → admin can approve/reject.

---

### Module 1.1 — Database Bootstrap

**Scope:** Create PostgreSQL schema, enable PostGIS, set up connection pool.

**Files to create:**
- `/infra/init.sql` — full DDL (all tables, indexes)
- `/backend/shared/db/index.js` — exports a single pg Pool instance
- `/backend/shared/db/migrate.js` — runs init.sql on first boot

**Schema (implement exactly):**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE ngos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  locale TEXT DEFAULT 'en-IN',
  dispatch_weight_config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES ngos(id),
  role TEXT CHECK (role IN ('field_worker','volunteer','admin')),
  skills TEXT[] DEFAULT '{}',
  locale TEXT DEFAULT 'en-IN',
  weekly_hour_limit INTEGER DEFAULT 20,
  visibility_mode TEXT DEFAULT 'off_duty',
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE volunteer_locations (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  location GEOMETRY(Point, 4326),
  accuracy_level TEXT CHECK (accuracy_level IN ('exact','approximate')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  session_expires_at TIMESTAMPTZ
);

CREATE TABLE need_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centroid GEOMETRY(Point, 4326),
  category_key TEXT,
  composite_score FLOAT DEFAULT 0,
  corroborating_report_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open',
  resolved_at TIMESTAMPTZ
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES ngos(id),
  submitted_by UUID REFERENCES users(id),
  source_channel TEXT CHECK (source_channel IN ('pwa','whatsapp','google_forms','ocr')),
  location GEOMETRY(Point, 4326),
  category_key TEXT NOT NULL,
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  population_affected INTEGER DEFAULT 0,
  time_sensitivity_hours INTEGER DEFAULT 48,
  description TEXT,
  locale TEXT DEFAULT 'en-IN',
  photo_refs TEXT[] DEFAULT '{}',
  ocr_confidence FLOAT,
  status TEXT DEFAULT 'pending_review',
  need_score FLOAT DEFAULT 0,
  cluster_id UUID REFERENCES need_clusters(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES need_clusters(id),
  volunteer_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'dispatched',
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE INDEX idx_volunteer_location ON volunteer_locations USING GIST(location);
CREATE INDEX idx_report_location ON reports USING GIST(location);
CREATE INDEX idx_cluster_centroid ON need_clusters USING GIST(centroid);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category_key);
CREATE INDEX idx_tasks_status ON tasks(status);
```

**Acceptance criteria:**
- `node migrate.js` runs cleanly on a fresh Postgres instance with PostGIS
- All GIST indexes confirmed created
- Connection pool exported as singleton, handles reconnect on crash

**Dependencies:** None. This is the root module.

---

### Module 1.2 — Auth Module

**Scope:** JWT-based auth, role management, middleware. Three roles: `field_worker`, `volunteer`, `admin`.

**Files to create:**
- `/backend/modules/auth/routes.js` — POST /auth/register, POST /auth/login
- `/backend/modules/auth/service.js` — password hashing, token issuance
- `/backend/modules/auth/middleware.js` — `requireAuth(roles[])` middleware
- `/backend/modules/auth/seed.js` — creates one default admin + one test NGO

**API contracts:**

```
POST /auth/register
Body: { email, password, role, ngo_id, locale }
Returns: { user_id, token }

POST /auth/login
Body: { email, password }
Returns: { user_id, role, token, ngo_id }
```

**Token payload:**
```json
{ "user_id": "uuid", "role": "admin", "ngo_id": "uuid", "iat": 0, "exp": 0 }
```

**Middleware usage:**
```js
router.get('/admin/reports', requireAuth(['admin']), handler)
router.post('/reports', requireAuth(['field_worker','admin']), handler)
```

**Acceptance criteria:**
- Register + login flow returns valid JWT
- `requireAuth(['admin'])` returns 401 for missing token, 403 for wrong role
- Passwords hashed with bcrypt (rounds: 12)
- Tokens expire in 24h

**Dependencies:** Module 1.1 (users table)

---

### Module 1.3 — Storage Abstraction

**Scope:** Abstract file storage behind an interface. Local disk at launch; S3-compatible later via one config change.

**Files to create:**
- `/backend/shared/storage/index.js` — exports `{ save(buffer, filename), getUrl(ref), delete(ref) }`
- `/backend/shared/storage/local.js` — saves to `/uploads/` dir, returns relative path
- `/backend/shared/storage/s3.js` — stub for future S3 migration (throws "not configured")

**Config flag:** `STORAGE_BACKEND=local|s3` in `.env`

**Interface contract:**
```js
// save: returns a storage_ref string
const ref = await storage.save(imageBuffer, 'report-photo.jpg')
// "local://uploads/abc123.jpg" or "s3://bucket/abc123.jpg"

// getUrl: returns a publicly accessible URL or signed URL
const url = storage.getUrl(ref)
```

**Acceptance criteria:**
- Saving a buffer to local disk returns a ref
- `getUrl(ref)` returns a path that Express serves as a static file
- Switching `STORAGE_BACKEND=s3` (not configured) throws a clear error message, not a silent failure

**Dependencies:** None

---

### Module 1.4 — Ingestion Module (PWA Channel)

**Scope:** Accepts PWA form submissions. Normalizes to the standard schema. Saves to `reports` table.

**Files to create:**
- `/backend/modules/ingestion/routes.js`
- `/backend/modules/ingestion/service.js`
- `/backend/modules/ingestion/normalizer.js` — maps raw form fields to schema

**API contract:**
```
POST /reports/submit
Auth: requireAuth(['field_worker','admin'])
Content-Type: multipart/form-data
Body fields:
  lat: float (required)
  lng: float (required)
  category_key: string (required)
  severity: 1-5 (required)
  population_affected: integer (optional)
  time_sensitivity_hours: integer (optional, default 48)
  description: string (optional)
  photo: file (optional, max 5MB, image/jpeg|png|webp)

Returns 201:
{
  report_id: "uuid",
  status: "pending_review",
  message: "Report received"
}
```

**Normalizer output (what gets written to DB):**
```js
{
  ngo_id: user.ngo_id,
  submitted_by: user.user_id,
  source_channel: 'pwa',
  location: `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`,
  category_key,
  severity,
  population_affected,
  time_sensitivity_hours,
  description,
  locale: user.locale,
  photo_refs: [storageRef],
  ocr_confidence: null,
  status: 'pending_review'
}
```

**Events emitted:**
```js
events.emit('report.created', { report_id, severity, ngo_id, source_channel: 'pwa' })
```

**Acceptance criteria:**
- Form submission with GPS coordinates and category saves to DB correctly
- Photo upload: file saved via storage module, ref stored in `photo_refs[]`
- Missing required fields return 422 with field-level error messages
- Event `report.created` is emitted after successful save

**Dependencies:** 1.1, 1.2, 1.3

---

### Module 1.5 — OCR Pipeline

**Scope:** Accept a photo upload of a paper survey, run OCR (Tesseract), attempt schema mapping, flag low-confidence results.

**Files to create:**
- `/backend/modules/ingestion/ocr.service.js`
- `/backend/modules/ingestion/ocr.mapper.js` — maps OCR text to schema keys
- Add `POST /reports/submit-photo` to ingestion routes

**API contract:**
```
POST /reports/submit-photo
Auth: requireAuth(['field_worker','admin'])
Content-Type: multipart/form-data
Body: photo (file, required)

Returns 202:
{
  report_id: "uuid",
  status: "pending_review",
  ocr_confidence: 0.73,
  extracted: { category_key, severity, lat, lng },
  missing_fields: ["population_affected"]
}
```

**OCR pipeline steps:**
1. Save photo via storage module → get ref
2. Run `tesseract.js` on the image buffer
3. Pass extracted text to `ocr.mapper.js`
4. Mapper uses keyword matching to extract: category, severity, location
5. `ocr_confidence` = fields_extracted / total_expected_fields
6. If `ocr_confidence < 0.8`: always `status = 'pending_review'`
7. Save report to DB with photo ref

**Mapper keyword config:**
```json
// /backend/modules/ingestion/ocr-category-map.json
{
  "healthcare": ["medical","medicine","health","hospital","nurse","doctor","medication","clinic"],
  "infrastructure": ["road","water","flood","power","electricity","pump","bridge"],
  "food": ["food","hunger","nutrition","meal","ration","grain"],
  "shelter": ["shelter","house","roof","tent","camp","home"]
}
```

**Acceptance criteria:**
- Uploading a photo triggers tesseract, result is stored
- Reports with `ocr_confidence < 0.8` are always `pending_review`
- If tesseract fails (corrupt image), return 422 — do not crash the server

**Dependencies:** 1.1, 1.2, 1.3

---

### Module 1.6 — Admin Review Screen (Backend)

**Scope:** API endpoints for admin to view, approve, and reject pending reports.

**Files to create:**
- `/backend/modules/validation/routes.js`
- `/backend/modules/validation/service.js`

**API contracts:**
```
GET /admin/reports?status=pending_review&page=1&limit=20
Auth: requireAuth(['admin'])
Returns: { reports: [...], total: N, page: 1 }

POST /admin/reports/:id/approve
Auth: requireAuth(['admin'])
Returns: { report_id, new_status: "auto_approved" }
Emits: events.emit('report.approved', { report_id })

POST /admin/reports/:id/reject
Auth: requireAuth(['admin'])
Body: { reason: string }
Returns: { report_id, new_status: "rejected" }
```

**Acceptance criteria:**
- Paginated list returns only `pending_review` reports by default
- Approve sets `status = 'auto_approved'`, reject sets `status = 'rejected'`
- Photo URLs resolved through storage module (not raw refs)
- Admin cannot approve/reject a report already in a terminal state

**Dependencies:** 1.1, 1.2, 1.3

---

### Module 1.7 — Field Worker PWA (Frontend)

**Scope:** React PWA with offline support. Report submission form. Role: field_worker.

**Files to create:**
- `/frontend/src/pages/SubmitReport.jsx`
- `/frontend/src/hooks/useGeolocation.js`
- `/frontend/src/i18n/categories.json`
- `/frontend/public/manifest.json`
- `/frontend/src/serviceWorker.js` — Workbox offline cache

**Form fields (in order):**
1. Location: auto-detect GPS OR manual lat/lng inputs
2. Category: tap-to-select grid using icons + locale labels (NOT a text dropdown)
3. Severity: 1-5 visual scale (colored circles, not number input)
4. Population affected: optional number input
5. Description: optional textarea (max 500 chars)
6. Photo: camera capture OR file upload (optional)
7. Submit button

**Offline behavior:**
- Submissions queued in IndexedDB if offline
- Auto-sync on reconnect
- User sees "Saved offline — will submit when connected" toast

**i18n category file shape:**
```json
{
  "healthcare.medication_shortage": { "en-IN": "Medicine Shortage", "hi-IN": "दवा की कमी" },
  "infrastructure.road_damage": { "en-IN": "Road Damage", "hi-IN": "सड़क क्षति" }
}
```

**Acceptance criteria:**
- Form works offline (offline cache via service worker)
- GPS auto-detect works on mobile Chrome/Safari
- Category grid renders icons + locale labels (not raw keys)
- Queued offline submissions sync on reconnect

**Dependencies:** 1.4, 1.2

---

### Module 1.8 — Basic Admin UI (Frontend)

**Scope:** React admin dashboard. Phase 1 scope: list of pending reports with approve/reject.

**Files to create:**
- `/frontend/src/pages/AdminReports.jsx`
- `/frontend/src/components/ReportCard.jsx`

**UI requirements:**
- List of report cards, most recent first
- Each card: category, severity badge, location (lat/lng), source channel, OCR confidence, photo thumbnail
- Approve (green) and Reject (red) buttons; reject requires entering a reason inline
- Filter tabs: Pending / Approved / Rejected
- Polls every 60s — no websockets
- "Last updated X mins ago" indicator

**Acceptance criteria:**
- OCR confidence shown as percentage, color-coded (red <60%, amber 60-80%, green >80%)
- Approve/reject calls correct API endpoints
- Polling updates list every 60s without full page reload

**Dependencies:** 1.6

---

## PHASE 2 — Visibility (Weeks 4–5)

**Phase goal:** Admin sees a live, de-duplicated map with urgency scores that reflect real priority.

---

### Module 2.1 — Urgency Scoring Engine

**Scope:** Revised scoring formula. Runs as a background job and on report approval events.

**Files to create:**
- `/backend/modules/scoring/service.js`
- `/backend/modules/scoring/job.js` — cron every 15 minutes
- `/backend/jobs/runner.js` — job scheduler (node-cron)

**Score formula (implement exactly):**
```
S_raw = (0.4 × severity/5)
      + (0.35 × log(population_affected+1)/log(10001))
      + (0.25 × (1 - hours_elapsed/time_sensitivity_hours))

S_normalized = S_raw / max(S_raw in same category_key, last 30 days)
  [if no prior data: S_normalized = S_raw]

decay(hours) = max(0, 1 - (hours_since_report / (time_sensitivity_hours × 2)))

confidence_bonus = min(0.3, (corroborating_report_count - 1) × 0.1)

S_final = (S_normalized × decay) + confidence_bonus
  [if any task IN ('dispatched','claimed','in_progress') exists for this cluster:
    S_final = S_final × 0.5]
```

**Events consumed:**
- `report.approved` → trigger score for that cluster

**Job schedule:** Every 15 minutes, recalculate scores for all open clusters.

**Acceptance criteria:**
- Severity-5 report with 500 affected scores higher than severity-2 with 10, same category
- Score decays to near zero after `time_sensitivity_hours × 2`
- Corroborating reports from 3 NGOs score higher than 1 NGO at same location
- Score halves when a volunteer is dispatched

**Dependencies:** 1.1, shared/events

---

### Module 2.2 — De-duplication Clustering

**Scope:** Detect when multiple reports describe the same incident. Cluster them.

**Files to create:**
- `/backend/modules/deduplication/service.js`
- `/backend/modules/deduplication/job.js` — runs every 15 minutes

**Clustering logic:**
1. On new `auto_approved` report, query existing open clusters within configured radius (default 200m) with same `category_key`
2. If cluster found: increment `corroborating_report_count`, update centroid to average, link report
3. If no cluster: create new `need_clusters` row
4. If `corroborating_report_count >= 3`: emit `cluster.merge_candidate` for admin confirmation

**Config:** `DEDUP_RADIUS_METERS=200` in `.env`

**Events emitted:**
- `cluster.created` → scoring
- `cluster.updated` → scoring
- `cluster.merge_candidate` → validation (admin review)

**Acceptance criteria:**
- Two reports within 200m, same category → one cluster, not two pins
- Reports outside 200m or different category always create a new cluster
- Centroid updates to average of all member report locations

**Dependencies:** 1.1, 2.1, shared/events

---

### Module 2.3 — Tiered Auto-Approval

**Scope:** Risk-tiered approval logic. Replaces Phase 1's "all to pending_review".

**Files to modify:**
- `/backend/modules/validation/service.js` — add `determineTier(report, ngo)` function
- `/backend/modules/ingestion/service.js` — call tier check after save

**Tier rules:**
```
Tier 1 — AUTO_APPROVE:
  severity IN (1,2) AND ngo age > 7 days AND ocr_confidence IS NULL

Tier 2 — AUTO_APPROVE with watch flag:
  severity = 3 AND ngo age > 7 days
  → status = 'auto_approved', watch_flag = true

Tier 3 — HOLD FOR REVIEW:
  severity IN (4,5)
  OR ngo age < 7 days
  OR ocr_confidence < 0.8

Tier 4 — IMMEDIATE ESCALATION:
  severity = 5 AND description contains ['life risk','missing person','emergency','critical','death']
  → status = 'pending_review' + emit 'report.emergency_flag'
```

**Migration:** Add `watch_flag BOOLEAN DEFAULT FALSE` to `reports` table.

**Events emitted:**
- `report.auto_approved` → deduplication + scoring
- `report.emergency_flag` → notifications (admin alert)

**Acceptance criteria:**
- Severity 1-2 from known NGO publishes to map immediately
- Severity 4-5 always requires admin review
- Emergency keyword detection triggers instant admin notification

**Dependencies:** 1.1, 1.4, 2.1, 2.2

---

### Module 2.4 — Need Map API

**Scope:** GeoJSON endpoints for the heat map. Offline-cache-friendly snapshot.

**Files to create:**
- `/backend/modules/scoring/routes.js`

**API contracts:**
```
GET /map/clusters
Auth: requireAuth(['admin','volunteer','field_worker'])
Query: category_key, min_score, bbox="lat1,lng1,lat2,lng2"
Returns: GeoJSON FeatureCollection
{
  type: "FeatureCollection",
  generated_at: "ISO8601",
  features: [{
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      cluster_id, category_key, composite_score,
      corroborating_report_count, status,
      display_label: "Medicine Shortage"
    }
  }]
}

GET /map/snapshot
Auth: none (publicly cacheable)
Cache-Control: max-age=900
Returns: same GeoJSON, cached 15 minutes
```

**Acceptance criteria:**
- Valid GeoJSON parseable by Leaflet
- Only `status = 'open'` clusters returned by default
- `display_label` resolved from `Accept-Language` header
- Snapshot includes `generated_at` so offline dashboard can show staleness

**Dependencies:** 1.1, 2.1, 2.2

---

### Module 2.5 — Heat Map Dashboard (Frontend)

**Scope:** Admin dashboard with Leaflet.js heat map, cluster pins, offline cache.

**Files to create/modify:**
- `/frontend/src/pages/AdminDashboard.jsx`
- `/frontend/src/components/NeedClusterPopup.jsx`
- `/frontend/src/hooks/useMapData.js`

**Map requirements:**
- Leaflet.js (leaflet npm package)
- Pin colors by urgency: red (>0.7), amber (0.4-0.7), green (<0.4)
- Pin size scales with `corroborating_report_count`
- Click pin → popup with: category label, score, report count, time since last report
- Map tiles: OpenStreetMap (free, no API key)
- Offline: renders from IndexedDB cache with "last updated X hours ago" banner

**Acceptance criteria:**
- Map renders within 3s on 3G
- Offline mode renders last-cached state with staleness indicator
- Color + size encoding matches spec

**Dependencies:** 2.4

---

## PHASE 3 — Action (Weeks 6–7)

**Phase goal:** Validated need triggers dispatch. Volunteer accepts, resolves, map updates.

---

### Module 3.1 — Volunteer Location & Session

**Scope:** Volunteer sets visibility mode, shares location for session duration. No passive tracking.

**Files to create:**
- `/backend/modules/matching/location.routes.js`
- `/backend/modules/matching/location.service.js`

**API contracts:**
```
POST /volunteer/session/start
Auth: requireAuth(['volunteer'])
Body: { visibility_mode: "active"|"approximate", lat, lng, duration_hours: 1-8 }
Returns: { session_id, expires_at, visibility_mode }

POST /volunteer/location/update
Auth: requireAuth(['volunteer'])
Body: { lat, lng }
Returns: 200 OK or 403 if session expired

POST /volunteer/session/end
Auth: requireAuth(['volunteer'])
Returns: 200 OK → sets visibility_mode = 'off_duty'

GET /volunteer/session/status
Auth: requireAuth(['volunteer'])
Returns: { is_active, expires_at, visibility_mode }
```

**Approximate mode:** Snap to nearest 500m grid:
```js
function approximateLocation(lat, lng) {
  const gridSize = 0.005; // ~500m
  return {
    lat: Math.round(lat / gridSize) * gridSize,
    lng: Math.round(lng / gridSize) * gridSize
  };
}
```

**Session expiry job:** Every 30 minutes, set `visibility_mode = 'off_duty'` for expired sessions.

**Acceptance criteria:**
- Approximate mode stores snapped coordinates
- Location update after session expiry returns 403
- No location is ever stored without explicit `session.start`

**Dependencies:** 1.1, 1.2

---

### Module 3.2 — Matchmaking Engine

**Scope:** Given a cluster, find the best-matched available volunteer using dispatch score formula.

**Files to create:**
- `/backend/modules/matching/service.js`
- `/backend/modules/matching/dispatch-score.js`

**Dispatch score formula:**
```
Dispatch_Score =
  (0.4 × proximity_score)
+ (0.3 × skill_match_score)
+ (0.2 × availability_score)
+ (0.1 × fatigue_score)

proximity_score:
  distance = Haversine(volunteer, cluster_centroid) in km
  acceptable_radius = cluster.time_sensitivity_hours <= 24 ? 5 : 10 (km)
  proximity_score = max(0, 1 - (distance / acceptable_radius))

skill_match_score:
  required_skills = CATEGORY_SKILL_MAP[category_key]
  exact_matches = volunteer.skills intersection required_skills
  skill_match_score = exact_matches.length / required_skills.length
  (partial: related skill per SKILL_RELATIONS map adds 0.5 per partial match)

availability_score:
  has_active_task = any task for volunteer with status IN ('dispatched','claimed','in_progress')
  recent_task = any task resolved < 2 hours ago
  availability_score = has_active_task ? 0 : recent_task ? 0.5 : 1.0

fatigue_score:
  hours_this_week = SUM(tasks resolved this week * avg_task_duration_hours)
  fatigue_score = max(0, 1 - (hours_this_week / volunteer.weekly_hour_limit))
```

**Category to skills map:**
```json
// /backend/modules/matching/category-skills.json
{
  "healthcare.medication_shortage": ["medical_basic","pharmacy","nursing"],
  "healthcare.injury": ["first_aid","medical_basic","nursing"],
  "infrastructure.road_damage": ["heavy_lifting","construction"],
  "food.distribution": ["logistics","driving"],
  "shelter.construction": ["construction","heavy_lifting"]
}
```

**Candidate query:**
```sql
SELECT u.id, u.skills, u.weekly_hour_limit,
  ST_Distance(vl.location::geography, ST_MakePoint($lng,$lat)::geography)/1000 AS distance_km
FROM users u
JOIN volunteer_locations vl ON vl.user_id = u.id
WHERE u.role = 'volunteer'
  AND u.visibility_mode IN ('active','approximate')
  AND vl.session_expires_at > NOW()
  AND ST_DWithin(vl.location::geography, ST_MakePoint($lng,$lat)::geography, $radius_meters)
ORDER BY distance_km ASC
LIMIT 20
```
Score the 20 candidates in application code, return the top match.

**Acceptance criteria:**
- Volunteer with exact skill match + 1km scores higher than no skills at 0.5km
- Volunteer with active task scores 0 on availability (never negative)
- No volunteer with `off_duty` or expired session is ever returned
- NGO weight overrides in `ngo.dispatch_weight_config` replace default weights

**Dependencies:** 1.1, 3.1

---

### Module 3.3 — Task Lifecycle & State Machine

**Scope:** Create, manage, and transition tasks. Emit events on each transition.

**Files to create:**
- `/backend/modules/matching/task.routes.js`
- `/backend/modules/matching/task.service.js`

**Valid transitions only:**
```
dispatched → claimed (volunteer accepts)
claimed → in_progress (volunteer on site)
in_progress → resolved (work done)
dispatched → escalated (no response in 15 min)
```

**API contracts:**
```
POST /tasks/:id/claim
Auth: requireAuth(['volunteer'])
Condition: task.volunteer_id = caller's id AND task.status = 'dispatched'
Returns: { task_id, status: 'claimed', claimed_at }
Emits: 'task.claimed'

POST /tasks/:id/start
Auth: requireAuth(['volunteer'])
Condition: task.status = 'claimed'
Returns: { task_id, status: 'in_progress' }

POST /tasks/:id/resolve
Auth: requireAuth(['volunteer'])
Body: { resolution_note: string (required, min 10 chars) }
Condition: task.status = 'in_progress'
Returns: { task_id, status: 'resolved', resolved_at }
Emits: 'task.resolved'

GET /tasks/mine
Auth: requireAuth(['volunteer'])
Returns: [{ task_id, cluster_id, status, dispatched_at, cluster_details }]
```

**On task.resolved:**
- Set `tasks.resolved_at = NOW()`, save `resolution_note`
- If ALL tasks for cluster are resolved: set `need_clusters.status = 'resolved'`
- Emit `cluster.resolved` → scoring drops score to 0

**Acceptance criteria:**
- Invalid state transitions return 409 Conflict with current state
- Volunteer cannot claim a task not assigned to them (403)
- `resolution_note` required — task cannot resolve without it
- `task.resolved` event causes cluster score to drop to 0

**Dependencies:** 1.1, 1.2, 3.2

---

### Module 3.4 — Dispatch Engine

**Scope:** On cluster creation/approval, run matchmaking and send dispatch notification.

**Files to create:**
- `/backend/modules/notifications/service.js` — FCM wrapper
- `/backend/modules/matching/dispatch.service.js`

**Dispatch flow:**
```
1. Listen to 'cluster.created' | 'report.auto_approved'
2. Call matchmaking.findBestVolunteer(cluster_id)
3. If match:
   a. Create tasks row { cluster_id, volunteer_id, status: 'dispatched' }
   b. Send FCM push to volunteer
   c. Set 15-minute escalation timer
4. If no match: start escalation ladder (Module 3.5)
```

**FCM payload:**
```json
{
  "to": "<fcm_token>",
  "notification": {
    "title": "New Task Near You",
    "body": "Medicine Shortage — 1.2km away, 120 people affected"
  },
  "data": {
    "task_id": "uuid",
    "cluster_id": "uuid",
    "category_key": "healthcare.medication_shortage",
    "lat": "12.345", "lng": "77.123", "severity": "4"
  }
}
```

**Migration:** Add `fcm_token TEXT` column to `users` table. Volunteer app registers token on login.

**Acceptance criteria:**
- Dispatch fires within 30 seconds of cluster creation (event-driven, not cron)
- Task row created in DB before notification is sent
- 15-minute escalation timer is set after dispatch

**Dependencies:** 1.1, 2.1, 2.2, 3.2, 3.3

---

### Module 3.5 — Escalation Ladder

**Scope:** If no volunteer accepts within 15 minutes, escalate through the defined steps.

**Files to create:**
- `/backend/modules/matching/escalation.service.js`

**Escalation steps (5-minute delays between each):**
```
Step 1 (15 min): Widen radius 50% → re-run matchmaking
Step 2 (20 min): Relax one skill (exact → partial) → re-run
Step 3 (25 min): Broadcast to ALL volunteers in skill pool within 20km
Step 4 (30 min): Notify NGO admin "No volunteer matched"
Step 5 (30 min, severity 4-5 only): Notify ALL partner NGOs in system
```

**Migration:** Add `escalation_step INTEGER DEFAULT 0` to `tasks` table.

**Acceptance criteria:**
- Escalation does not fire if task is claimed before 15 minutes
- Each step separated by 5 minutes (job scheduler, not setTimeout)
- Admin notification sent by step 4 regardless of severity
- Partner NGO notification only fires for severity 4-5

**Dependencies:** 3.2, 3.4, shared/events

---

### Module 3.6 — Volunteer App (Frontend)

**Scope:** React PWA for volunteers. Session management, task list, claim/resolve flow, push notifications.

**Files to create:**
- `/frontend/src/pages/VolunteerDashboard.jsx`
- `/frontend/src/pages/TaskDetail.jsx`
- `/frontend/src/components/SessionToggle.jsx`
- `/frontend/src/hooks/useFCM.js` — Firebase Cloud Messaging registration
- `/frontend/src/hooks/useLocationSession.js`

**UI flow:**
1. Login → FCM token registered → stored in backend
2. Session toggle (default: Off Duty) → Active/Approximate calls `POST /volunteer/session/start`
3. Push notification → deep-links to TaskDetail
4. TaskDetail: mini-map, category, severity, description, claim button
5. After claim: Start → In Progress → Resolve (with resolution note textarea)
6. My Tasks tab: current and past tasks

**Acceptance criteria:**
- FCM token registered and stored on login
- Push notifications open app and navigate to correct task
- Session expiry visible to volunteer (countdown timer)
- Resolve requires non-empty resolution note before enabling submit

**Dependencies:** 3.1, 3.3, 3.4

---

## PHASE 4 — Reach (Weeks 8–10)

**Phase goal:** Expand input channels. Harden. Internationalize fully.

---

### Module 4.1 — WhatsApp Business API Ingest

**Files to create:**
- `/backend/modules/ingestion/whatsapp.routes.js`
- `/backend/modules/ingestion/whatsapp.parser.js`

**Parser rules:** Keyword-based (no LLM). Severity from numbers or keywords ("urgent" → 4, "emergency" → 5). Category from ocr-category-map.json. Location from coordinates in text or sender's registered location. Ambiguous → `pending_review`.

**Security:** HMAC webhook signature verified on every request. Reject with 401 on mismatch.

**Acceptance criteria:**
- "Emergency: road flooded near 12.34,77.56, 50 people stranded" → category `infrastructure.flood`, severity 5, correct lat/lng
- Messages with no extractable location go to `pending_review`

**Dependencies:** 1.1, 1.4 (normalizer), 2.3

---

### Module 4.2 — Google Forms Webhook

**Files to create:**
- `/backend/modules/ingestion/gforms.routes.js`
- `/backend/modules/ingestion/gforms.mapper.js`

**Per-NGO field mapping config** stored in `ngos.dispatch_weight_config` JSONB:
```json
{
  "gforms_field_map": {
    "Location (Lat,Lng)": "coordinates",
    "Category": "category_key",
    "How severe is this?": "severity"
  }
}
```

**Acceptance criteria:**
- Each NGO defines own field mapping in NGO config
- Missing required fields → `pending_review`
- Webhook secret validated on every request

**Dependencies:** 1.1, 1.4

---

### Module 4.3 — Volunteer Fatigue Tracking

**New table:**
```sql
CREATE TABLE task_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id),
  volunteer_id UUID REFERENCES users(id),
  duration_hours FLOAT,
  week_number INTEGER,
  year INTEGER
);
```

**On task.resolved:** calculate `duration_hours = (resolved_at - claimed_at) / 3600000`, insert row.

**Volunteer API:**
```
GET /volunteer/stats
Returns: { hours_this_week, weekly_limit, tasks_completed_this_week, fatigue_level: "low"|"medium"|"high" }
```

`fatigue_level = "high"` when hours > 80% of limit.

**Acceptance criteria:**
- Duration calculated from `claimed_at` to `resolved_at` (not dispatched_at)
- Volunteer near limit is deprioritized in dispatch score, not blocked

**Dependencies:** 3.3, 3.2

---

### Module 4.4 — Full i18n Audit

**Locales to support:** `en-IN`, `hi-IN`, `mr-IN`

**Audit checklist:**
- [ ] All category labels in API responses use locale key resolution
- [ ] FCM notification bodies are locale-resolved to recipient's locale
- [ ] All frontend error messages are in `/frontend/src/i18n/` catalog
- [ ] Severity scale labels translated
- [ ] Admin UI respects admin user's locale setting
- [ ] No hardcoded English string in any user-facing route response

**Dependencies:** All prior modules

---

### Module 4.5 — SMS Fallback Notifications

**Files to modify:** `/backend/modules/notifications/service.js`

**Logic:**
```
if volunteer.fcm_token != null → send FCM
else → send SMS via Twilio

SMS template:
"New task near you: {category_label} {distance}km away. Reply YES to accept. Task ID: {short_task_id}"
```

Twilio webhook receives "YES" → calls `POST /tasks/:id/claim` on behalf of volunteer.

**Acceptance criteria:**
- Volunteers without FCM token receive SMS
- Replying "YES" to SMS claims the task
- SMS not sent if FCM was successfully delivered

**Dependencies:** 3.4

---

### Module 4.6 — S3 File Storage Migration

**Files to modify:** `/backend/shared/storage/s3.js` — implement using `@aws-sdk/client-s3`

**Migration path:**
1. Set `STORAGE_BACKEND=s3` in `.env`
2. New uploads go to S3
3. One-time migration script: copy `/uploads/` to S3, update `photo_refs` in DB

**Acceptance criteria:**
- `STORAGE_BACKEND=s3` with valid credentials routes all new uploads to S3
- Old local refs still resolve after migration script runs
- `getUrl(ref)` returns presigned URL for S3 refs

**Dependencies:** 1.3

---

## PHASE 5 — Scale (Only When Forced)

> Do not build Phase 5 modules until profiling data shows a specific bottleneck.

| Module | Trigger condition | What it does |
|---|---|---|
| 5.1 Redis Volunteer Cache | Postgres location queries >100ms p95 | Cache `volunteer_locations` in Redis, invalidate on session update |
| 5.2 Ingestion Service Extract | OCR jobs blocking API responses >2s | Extract ingestion into standalone worker process with job queue |
| 5.3 Horizontal Scaling | Single VPS CPU >70% sustained | Stateless backend behind load balancer; session state to Postgres |
| 5.4 Native Mobile Apps | PWA adoption <60% due to UX gaps | React Native apps; backend APIs unchanged |

---

## Cross-Cutting Concerns (Apply to All Phases)

### Event Bus Contract

All events use this structure:
```js
events.emit(eventName, { ...payload, emitted_at: new Date().toISOString() })
```

**Complete event catalog:**

| Event | Emitter | Consumers |
|---|---|---|
| `report.created` | ingestion | validation |
| `report.auto_approved` | validation | deduplication, scoring |
| `report.approved` (manual) | validation | deduplication, scoring |
| `report.emergency_flag` | validation | notifications |
| `cluster.created` | deduplication | scoring, matching |
| `cluster.updated` | deduplication | scoring |
| `cluster.resolved` | task service | scoring |
| `task.claimed` | task service | notifications |
| `task.resolved` | task service | scoring |
| `escalation.admin_alert` | escalation | notifications |

### Error Handling Standards

- All routes: wrap in try/catch, return `{ error: string, code: string }` on failure
- Never return stack traces to clients
- Log format: `{ timestamp, module, route, error_code, user_id }`
- 4xx = client mistake (INFO level), 5xx = server bug (ERROR level)

### Environment Variables

```
DATABASE_URL=postgresql://...
JWT_SECRET=<32-char random>
STORAGE_BACKEND=local
UPLOADS_DIR=./uploads
FCM_SERVER_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
WHATSAPP_WEBHOOK_SECRET=...
GFORMS_WEBHOOK_SECRET=...
DEDUP_RADIUS_METERS=200
PORT=3000
```

### Testing Expectations Per Module

Each module must ship with:
- Unit tests for service logic (scoring formula, dispatch score, tier decision)
- Integration test for each API endpoint (happy path + primary error paths)
- Seed script for fixtures: one test NGO, one admin, one field worker, one volunteer
