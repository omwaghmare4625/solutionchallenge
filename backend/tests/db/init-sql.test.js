const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('init.sql defines required extensions and future-safe columns', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../infra/init.sql'), 'utf8');

  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto;/);
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS postgis;/);
  assert.match(sql, /auth_provider TEXT DEFAULT 'local' CHECK \(auth_provider IN \('local','supabase','firebase'\)\)/);
  assert.match(sql, /auth_user_id TEXT UNIQUE/);
  assert.match(sql, /watch_flag BOOLEAN DEFAULT FALSE/);
  assert.match(sql, /fcm_token TEXT/);
  assert.match(sql, /ocr_raw_text TEXT/);
  assert.match(sql, /ocr_pipeline JSONB DEFAULT '\{\}'::jsonb/);
  assert.match(sql, /escalation_step INTEGER DEFAULT 0/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_volunteer_location/);
});
