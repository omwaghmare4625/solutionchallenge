const test = require('node:test');
const assert = require('node:assert/strict');

const { mapText } = require('../../modules/ingestion/ocr.mapper');

test('mapText extracts structured need signals from survey-style text', () => {
  const result = mapText(`
    Ward 7 community survey
    35 families need clean water and toilet repair.
    Urgent support needed within 24 hours.
    Latitude: 18.5204
    Longitude: 73.8567
  `);

  assert.equal(result.category_key, 'infrastructure');
  assert.equal(result.severity, 4);
  assert.equal(result.population_affected, 140);
  assert.equal(result.time_sensitivity_hours, 24);
  assert.equal(result.lat, 18.5204);
  assert.equal(result.lng, 73.8567);
  assert.match(result.description, /35 families need clean water/i);
});

test('mapText detects healthcare needs from field reports', () => {
  const result = mapText(`
    Field report: mobile clinic requested.
    120 people with fever and medicine shortage.
    Critical case reported in the settlement.
  `);

  assert.equal(result.category_key, 'healthcare');
  assert.equal(result.severity, 5);
  assert.equal(result.population_affected, 120);
  assert.equal(result.time_sensitivity_hours, 48);
  assert.equal(result.lat, null);
  assert.equal(result.lng, null);
});

test('mapText falls back cleanly when little structure is present', () => {
  const result = mapText('General community note about support needed soon.');

  assert.equal(result.category_key, null);
  assert.equal(result.severity, 3);
  assert.equal(result.population_affected, 0);
  assert.equal(result.time_sensitivity_hours, 48);
  assert.equal(result.description, 'General community note about support needed soon.');
});
