CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS ngos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  locale TEXT DEFAULT 'en-IN',
  dispatch_weight_config JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES ngos(id),
  email TEXT UNIQUE,
  auth_provider TEXT DEFAULT 'local' CHECK (auth_provider IN ('local','supabase','firebase')),
  auth_user_id TEXT UNIQUE,
  role TEXT CHECK (role IN ('field_worker','volunteer','admin')),
  skills TEXT[] DEFAULT '{}',
  locale TEXT DEFAULT 'en-IN',
  weekly_hour_limit INTEGER DEFAULT 20,
  visibility_mode TEXT DEFAULT 'off_duty',
  password_hash TEXT,
  fcm_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volunteer_locations (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  location GEOMETRY(Point, 4326),
  accuracy_level TEXT CHECK (accuracy_level IN ('exact','approximate')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  session_expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS need_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centroid GEOMETRY(Point, 4326),
  category_key TEXT,
  composite_score FLOAT DEFAULT 0,
  corroborating_report_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open',
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reports (
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
  ocr_raw_text TEXT,
  ocr_document_type TEXT,
  ocr_field_confidence JSONB DEFAULT '{}'::jsonb,
  ocr_pipeline JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending_review',
  need_score FLOAT DEFAULT 0,
  watch_flag BOOLEAN DEFAULT FALSE,
  cluster_id UUID REFERENCES need_clusters(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES need_clusters(id),
  volunteer_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'dispatched',
  escalation_step INTEGER DEFAULT 0,
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_volunteer_location ON volunteer_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_report_location ON reports USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_cluster_centroid ON need_clusters USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_key);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'users_auth_provider_check'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_auth_provider_check;
  END IF;

  ALTER TABLE users
    ADD CONSTRAINT users_auth_provider_check
    CHECK (auth_provider IN ('local', 'supabase', 'firebase'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
