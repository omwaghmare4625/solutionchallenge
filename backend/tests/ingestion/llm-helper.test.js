const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeLlmExtraction } = require('../../modules/ingestion/llm-extractor.service');

test('mergeLlmExtraction applies strong llm suggestions when heuristics are weak', () => {
  const result = mergeLlmExtraction({
    heuristicFields: {
      category_key: 'unknown',
      severity: 2,
      lat: null,
      lng: null,
      population_affected: 0,
      time_sensitivity_hours: 48,
      description: 'blurred OCR text',
    },
    heuristicSources: {
      category_key: 'missing',
      severity: 'default',
      lat: 'missing',
      lng: 'missing',
      population_affected: 'default',
      time_sensitivity_hours: 'default',
      description: 'ocr_summary',
    },
    heuristicConfidence: {
      category_key: 0,
      severity: 0.45,
      lat: 0,
      lng: 0,
      population_affected: 0.45,
      time_sensitivity_hours: 0.45,
      description: 0.7,
    },
    llmResult: {
      success: true,
      should_apply: true,
      requires_manual_review: false,
      notes: 'Recovered from form layout and image',
      fields: {
        category_key: 'healthcare',
        severity: 4,
        lat: null,
        lng: null,
        population_affected: 120,
        time_sensitivity_hours: 24,
        description: 'Community clinic reports medicine shortage affecting 120 people.',
      },
      field_confidence: {
        category_key: 0.92,
        severity: 0.88,
        lat: 0.1,
        lng: 0.1,
        population_affected: 0.84,
        time_sensitivity_hours: 0.79,
        description: 0.9,
      },
    },
  });

  assert.equal(result.fields.category_key, 'healthcare');
  assert.equal(result.fields.population_affected, 120);
  assert.equal(result.fields.time_sensitivity_hours, 24);
  assert.equal(result.sources.category_key, 'llm_helper');
  assert.ok(result.applied_fields.includes('description'));
  assert.equal(result.llm_used, true);
});

test('mergeLlmExtraction preserves explicit deterministic fields', () => {
  const result = mergeLlmExtraction({
    heuristicFields: {
      category_key: 'food',
      severity: 5,
      lat: 18.52,
      lng: 73.85,
      population_affected: 80,
      time_sensitivity_hours: 12,
      description: 'explicit form labels',
    },
    heuristicSources: {
      category_key: 'explicit_label',
      severity: 'explicit_label',
      lat: 'explicit_label',
      lng: 'explicit_label',
      population_affected: 'explicit_label',
      time_sensitivity_hours: 'explicit_label',
      description: 'explicit_label',
    },
    heuristicConfidence: {
      category_key: 0.95,
      severity: 0.95,
      lat: 0.95,
      lng: 0.95,
      population_affected: 0.95,
      time_sensitivity_hours: 0.95,
      description: 0.95,
    },
    llmResult: {
      success: true,
      should_apply: true,
      requires_manual_review: false,
      notes: null,
      fields: {
        category_key: 'healthcare',
        severity: 3,
        lat: 10,
        lng: 11,
        population_affected: 20,
        time_sensitivity_hours: 48,
        description: 'model guess',
      },
      field_confidence: {
        category_key: 0.99,
        severity: 0.99,
        lat: 0.99,
        lng: 0.99,
        population_affected: 0.99,
        time_sensitivity_hours: 0.99,
        description: 0.99,
      },
    },
  });

  assert.equal(result.fields.category_key, 'food');
  assert.equal(result.fields.severity, 5);
  assert.equal(result.applied_fields.length, 0);
  assert.equal(result.llm_used, false);
});
