const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const { assessImageQuality } = require('../../modules/ingestion/image-quality.service');
const { preprocessImage } = require('../../modules/ingestion/image-preprocess.service');
const { classifyDocument } = require('../../modules/ingestion/document-classifier.service');
const { calculateFieldConfidence } = require('../../modules/ingestion/confidence.service');

test('image quality gate accepts a readable survey capture', async () => {
  const buffer = await sharp({
    create: {
      width: 1400,
      height: 1800,
      channels: 3,
      background: '#d0d0d0',
    },
  })
    .png()
    .toBuffer();

  const result = await assessImageQuality({
    buffer,
    mimetype: 'image/png',
    originalname: 'survey.png',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.metadata.width, 1400);
  assert.equal(result.metadata.height, 1800);
});

test('image quality gate rejects tiny captures', async () => {
  const buffer = await sharp({
    create: {
      width: 180,
      height: 200,
      channels: 3,
      background: '#ffffff',
    },
  })
    .png()
    .toBuffer();

  const result = await assessImageQuality({
    buffer,
    mimetype: 'image/png',
    originalname: 'tiny.png',
  });

  assert.equal(result.accepted, false);
  assert.match(result.hardFailures.join(' '), /too low|too small/i);
});

test('preprocessing generates OCR variants', async () => {
  const buffer = await sharp({
    create: {
      width: 1200,
      height: 1600,
      channels: 3,
      background: '#ffffff',
    },
  })
    .png()
    .toBuffer();

  const result = await preprocessImage({ buffer });

  assert.equal(result.variants.length, 3);
  assert.deepEqual(result.variants.map((variant) => variant.name), ['original', 'normalized', 'thresholded']);
});

test('document classifier recognizes structured forms', () => {
  const result = classifyDocument({
    text: `
      Name: Asha
      Village: Ward 7
      Need Type: Water and sanitation
      Severity: 4
      Households: 32
    `,
  });

  assert.equal(result.type, 'structured_form');
  assert.ok(result.confidence > 0.8);
});

test('confidence scoring flags low-confidence extractions for manual review', () => {
  const result = calculateFieldConfidence({
    fieldSources: {
      category_key: 'missing',
      severity: 'default',
      description: 'ocr_summary',
    },
    ocrConfidence: 42,
    qualityWarnings: ['dark image', 'low contrast'],
  });

  assert.equal(result.requires_manual_review, true);
  assert.ok(result.overall < 0.68);
});
