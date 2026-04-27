const path = require('path');

const db = require('../../shared/db');
const storage = require('../../shared/storage');
const events = require('../../shared/events');
const { processDocumentImage } = require('./pipeline.service');

const isMissing = (value) => value === undefined || value === null || String(value).trim() === '';

const parseNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildValidationError = (message, fields = []) => ({
  error: 'validation_error',
  message,
  fields,
});

const createPhotoFileName = (originalname = '') => {
  const extension = path.extname(originalname);
  const safeExtension = extension ? extension.toLowerCase() : '';
  return `report_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${safeExtension}`;
};

async function submitReport(req, res) {
  try {
    const {
      lat,
      lng,
      category_key,
      severity,
      population_affected = 0,
      time_sensitivity_hours = 48,
      description = null,
    } = req.body || {};

    const missingFields = [];

    if (isMissing(lat)) missingFields.push('lat');
    if (isMissing(lng)) missingFields.push('lng');
    if (isMissing(category_key)) missingFields.push('category_key');
    if (isMissing(severity)) missingFields.push('severity');

    if (missingFields.length > 0) {
      return res.status(422).json(buildValidationError('Missing required fields', missingFields));
    }

    const latNum = parseNumber(lat);
    const lngNum = parseNumber(lng);
    const severityNum = parseNumber(severity);
    const populationAffectedNum = parseNumber(population_affected);
    const timeSensitivityHoursNum = parseNumber(time_sensitivity_hours);

    if (latNum === null || lngNum === null) {
      return res.status(422).json(buildValidationError('lat and lng must be valid numbers', ['lat', 'lng']));
    }

    if (severityNum === null || !Number.isInteger(severityNum) || severityNum < 1 || severityNum > 5) {
      return res
        .status(422)
        .json(buildValidationError('severity must be an integer between 1 and 5', ['severity']));
    }

    if (populationAffectedNum === null || populationAffectedNum < 0) {
      return res
        .status(422)
        .json(buildValidationError('population_affected must be a non-negative number', ['population_affected']));
    }

    if (timeSensitivityHoursNum === null || timeSensitivityHoursNum < 0) {
      return res
        .status(422)
        .json(
          buildValidationError('time_sensitivity_hours must be a non-negative number', [
            'time_sensitivity_hours',
          ])
        );
    }

    if (!req.user || !req.user.ngo_id || !req.user.user_id) {
      return res
        .status(422)
        .json(buildValidationError('Authenticated user context is incomplete', ['ngo_id', 'user_id']));
    }

    const photoRefs = [];

    if (req.file) {
      const generatedName = createPhotoFileName(req.file.originalname || '');

      const storedRef = await storage.save(req.file.buffer, generatedName);
      photoRefs.push(storedRef);
    }

    const insertQuery = `
      INSERT INTO reports (
        ngo_id,
        submitted_by,
        source_channel,
        category_key,
        severity,
        population_affected,
        time_sensitivity_hours,
        description,
        photo_refs,
        status,
        location
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        ST_SetSRID(ST_MakePoint($11, $12), 4326)
      )
      RETURNING report_id;
    `;

    const insertValues = [
      req.user.ngo_id,
      req.user.user_id,
      'pwa',
      category_key,
      severityNum,
      populationAffectedNum,
      timeSensitivityHoursNum,
      description,
      photoRefs,
      'pending_review',
      lngNum,
      latNum,
    ];

    const result = await db.query(insertQuery, insertValues);
    const reportId = result?.rows?.[0]?.report_id;

    events.emit('report.created', {
      report_id: reportId,
      severity: severityNum,
      ngo_id: req.user.ngo_id,
      source_channel: 'pwa',
      emitted_at: new Date().toISOString(),
    });

    return res.status(201).json({
      report_id: reportId,
      status: 'pending_review',
      message: 'Report received',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to submit report',
    });
  }
}

async function submitPhoto(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(422).json(buildValidationError('photo is required', ['photo']));
    }

    if (!req.user || !req.user.ngo_id || !req.user.user_id) {
      return res
        .status(422)
        .json(buildValidationError('Authenticated user context is incomplete', ['ngo_id', 'user_id']));
    }

    let pipeline;
    try {
      pipeline = await processDocumentImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });
    } catch (error) {
      if (error.code === 'image_quality_rejected') {
        return res.status(error.statusCode || 422).json({
          error: error.code,
          message: 'The uploaded image is too poor for reliable OCR',
          details: error.details,
        });
      }

      return res.status(422).json({
        error: 'ocr_failed',
        message: 'Unable to extract text from photo',
      });
    }

    const generatedName = createPhotoFileName(req.file.originalname || '');
    const originalRef = await storage.save(req.file.buffer, generatedName);
    const processedVariantName = pipeline.processedVariant.name === 'original'
      ? null
      : `processed_${generatedName.replace(/\.[^.]+$/, '')}.png`;
    const processedRef = processedVariantName
      ? await storage.save(pipeline.processedVariant.buffer, processedVariantName)
      : null;

    const extracted = pipeline.normalized;
    const fields = ['category_key', 'severity', 'population_affected', 'time_sensitivity_hours', 'description', 'lat', 'lng'];
    const extractedCount = fields.filter(
      (field) => extracted[field] !== null && extracted[field] !== undefined
    ).length;
    const ocrConfidence = extractedCount / fields.length;
    const missingFields = fields.filter(
      (field) => extracted[field] === null || extracted[field] === undefined
    );

    const categoryKey = extracted.category_key || 'unknown';
    const severity = Number.isInteger(extracted.severity) ? extracted.severity : 3;
    const populationAffected = Number.isInteger(extracted.population_affected) ? extracted.population_affected : 0;
    const timeSensitivityHours = Number.isFinite(extracted.time_sensitivity_hours) ? extracted.time_sensitivity_hours : 48;
    const description = extracted.description || pipeline.ocr.text || null;
    const lat = parseNumber(extracted.lat);
    const lng = parseNumber(extracted.lng);
    const hasCoordinates = lat !== null && lng !== null;
    const photoRefs = processedRef ? [originalRef, processedRef] : [originalRef];

    const insertQuery = `
      INSERT INTO reports (
        ngo_id,
        submitted_by,
        source_channel,
        category_key,
        severity,
        population_affected,
        time_sensitivity_hours,
        description,
        ocr_confidence,
        ocr_raw_text,
        ocr_document_type,
        ocr_field_confidence,
        ocr_pipeline,
        photo_refs,
        status,
        location
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        CASE
          WHEN $16::double precision IS NOT NULL AND $17::double precision IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($17, $16), 4326)
          ELSE NULL
        END
      )
      RETURNING id;
    `;

    const insertValues = [
      req.user.ngo_id,
      req.user.user_id,
      'ocr',
      categoryKey,
      severity,
      populationAffected,
      timeSensitivityHours,
      description,
      ocrConfidence,
      pipeline.ocr.text,
      pipeline.document.type,
      pipeline.confidence.fields,
      {
        quality: pipeline.quality,
        preprocessing: pipeline.preprocessing,
        ocr: {
          variant_name: pipeline.ocr.variant_name,
          confidence: pipeline.ocr.confidence,
          passes: pipeline.ocr.passes,
        },
        document: pipeline.document,
        llm: pipeline.llm,
        requires_manual_review: pipeline.confidence.requires_manual_review,
      },
      photoRefs,
      'pending_review',
      hasCoordinates ? lat : null,
      hasCoordinates ? lng : null,
    ];

    const result = await db.query(insertQuery, insertValues);
    const reportId = result?.rows?.[0]?.id;

    events.emit('report.created', {
      report_id: reportId,
      source_channel: 'ocr',
      ocr_confidence: ocrConfidence,
      emitted_at: new Date().toISOString(),
    });

    return res.status(202).json({
      report_id: reportId,
      status: 'pending_review',
      ocr_confidence: ocrConfidence,
      extracted,
      missing_fields: missingFields,
      document_type: pipeline.document.type,
      field_confidence: pipeline.confidence.fields,
      requires_manual_review: pipeline.confidence.requires_manual_review,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to submit photo report',
    });
  }
}

module.exports = {
  submitReport,
  submitPhoto,
};
