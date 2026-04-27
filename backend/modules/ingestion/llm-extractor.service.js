const config = require('../../shared/config');
const { normalizeExtractedFields } = require('./normalizer.service');

const FIELD_NAMES = [
  'category_key',
  'severity',
  'lat',
  'lng',
  'population_affected',
  'time_sensitivity_hours',
  'description',
];

const CATEGORY_ENUM = ['healthcare', 'food', 'shelter', 'infrastructure', 'unknown'];

function isLlmHelperEnabled() {
  return Boolean(config.llm.helperEnabled && config.openai.apiKey);
}

function dataUrlFromBuffer(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['should_apply', 'requires_manual_review', 'fields', 'field_confidence', 'notes'],
    properties: {
      should_apply: { type: 'boolean' },
      requires_manual_review: { type: 'boolean' },
      notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      fields: {
        type: 'object',
        additionalProperties: false,
        required: FIELD_NAMES,
        properties: {
          category_key: { anyOf: [{ type: 'string', enum: CATEGORY_ENUM }, { type: 'null' }] },
          severity: { anyOf: [{ type: 'integer', minimum: 1, maximum: 5 }, { type: 'null' }] },
          lat: { anyOf: [{ type: 'number', minimum: -90, maximum: 90 }, { type: 'null' }] },
          lng: { anyOf: [{ type: 'number', minimum: -180, maximum: 180 }, { type: 'null' }] },
          population_affected: { anyOf: [{ type: 'integer', minimum: 0, maximum: 1000000 }, { type: 'null' }] },
          time_sensitivity_hours: { anyOf: [{ type: 'integer', minimum: 0, maximum: 720 }, { type: 'null' }] },
          description: { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }] },
        },
      },
      field_confidence: {
        type: 'object',
        additionalProperties: false,
        required: FIELD_NAMES,
        properties: Object.fromEntries(
          FIELD_NAMES.map((field) => [field, { type: 'number', minimum: 0, maximum: 1 }])
        ),
      },
    },
  };
}

function extractOutputText(responseJson) {
  const outputs = responseJson?.output || [];
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string') {
        return part.text;
      }
    }
  }
  return '';
}

function sanitizeFieldConfidence(fieldConfidence = {}) {
  return Object.fromEntries(
    FIELD_NAMES.map((field) => {
      const raw = Number(fieldConfidence[field]);
      const value = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
      return [field, Math.round(value * 100) / 100];
    })
  );
}

function shouldUseLlmField({
  field,
  deterministicValue,
  deterministicSource,
  deterministicConfidence,
  llmValue,
  llmConfidence,
}) {
  if (llmValue === null || llmValue === undefined || llmValue === '') {
    return false;
  }

  if (llmConfidence < config.llm.minFieldConfidence) {
    return false;
  }

  if (deterministicSource === 'explicit_label') {
    return false;
  }

  if (deterministicValue === null || deterministicValue === undefined || deterministicValue === '' || deterministicValue === 'unknown') {
    return true;
  }

  if (field === 'description') {
    return llmConfidence >= Math.max(0.82, deterministicConfidence + 0.08);
  }

  if (deterministicSource === 'missing' || deterministicSource === 'default') {
    return llmConfidence >= deterministicConfidence;
  }

  if (deterministicSource === 'keyword_heuristic' || deterministicSource === 'ocr_summary') {
    return llmConfidence >= deterministicConfidence + 0.12;
  }

  return false;
}

async function extractWithLlm({
  text,
  documentType,
  heuristicFields,
  qualityWarnings = [],
  imageBuffer,
  imageMimeType = 'image/png',
}) {
  if (!isLlmHelperEnabled()) {
    return { enabled: false, attempted: false, success: false, reason: 'disabled' };
  }

  const systemPrompt = [
    'You extract structured community-needs data from NGO survey forms and field reports.',
    'Use the image and OCR text together.',
    'Return null for fields you cannot support from the evidence.',
    'Do not invent exact coordinates, counts, or urgency values.',
    'Prefer conservative extraction and set requires_manual_review true when the form is messy or ambiguous.',
  ].join(' ');

  const payloadText = JSON.stringify({
    task: 'Repair and structure OCR output from a community-needs survey or field report.',
    document_type_hint: documentType,
    quality_warnings: qualityWarnings,
    heuristic_fields: heuristicFields,
    ocr_text: text,
  });

  const content = [
    { type: 'input_text', text: payloadText },
  ];

  if (config.llm.includeImage && imageBuffer) {
    content.push({
      type: 'input_image',
      image_url: dataUrlFromBuffer(imageBuffer, imageMimeType),
      detail: 'high',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.openai.model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'community_need_extraction',
            strict: true,
            schema: buildSchema(),
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        enabled: true,
        attempted: true,
        success: false,
        error: `llm_request_failed:${response.status}`,
        details: errorText.slice(0, 500),
      };
    }

    const responseJson = await response.json();
    const outputText = extractOutputText(responseJson);
    const parsed = JSON.parse(outputText || '{}');
    const normalizedFields = normalizeExtractedFields(parsed.fields || {});

    return {
      enabled: true,
      attempted: true,
      success: true,
      model: config.openai.model,
      should_apply: Boolean(parsed.should_apply),
      requires_manual_review: Boolean(parsed.requires_manual_review),
      notes: parsed.notes || null,
      fields: normalizedFields,
      field_confidence: sanitizeFieldConfidence(parsed.field_confidence),
    };
  } catch (error) {
    return {
      enabled: true,
      attempted: true,
      success: false,
      error: error.name === 'AbortError' ? 'llm_timeout' : 'llm_exception',
      details: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mergeLlmExtraction({
  heuristicFields,
  heuristicSources,
  heuristicConfidence,
  llmResult,
}) {
  if (!llmResult?.success || !llmResult.should_apply) {
    return {
      fields: heuristicFields,
      sources: heuristicSources,
      applied_fields: [],
      llm_used: false,
      requires_manual_review: Boolean(llmResult?.requires_manual_review),
      llm_notes: llmResult?.notes || null,
    };
  }

  const mergedFields = { ...heuristicFields };
  const mergedSources = { ...heuristicSources };
  const appliedFields = [];

  for (const field of FIELD_NAMES) {
    const useLlm = shouldUseLlmField({
      field,
      deterministicValue: heuristicFields[field],
      deterministicSource: heuristicSources[field],
      deterministicConfidence: heuristicConfidence?.[field] || 0,
      llmValue: llmResult.fields?.[field],
      llmConfidence: llmResult.field_confidence?.[field] || 0,
    });

    if (useLlm) {
      mergedFields[field] = llmResult.fields[field];
      mergedSources[field] = 'llm_helper';
      appliedFields.push(field);
    }
  }

  return {
    fields: normalizeExtractedFields(mergedFields),
    sources: mergedSources,
    applied_fields: appliedFields,
    llm_used: appliedFields.length > 0,
    requires_manual_review: Boolean(llmResult.requires_manual_review),
    llm_notes: llmResult.notes || null,
  };
}

module.exports = {
  extractWithLlm,
  isLlmHelperEnabled,
  mergeLlmExtraction,
};
