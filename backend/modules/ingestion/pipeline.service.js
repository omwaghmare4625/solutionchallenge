const { assessImageQuality } = require('./image-quality.service');
const { preprocessImage } = require('./image-preprocess.service');
const ocr = require('./ocr.service');
const { classifyDocument } = require('./document-classifier.service');
const { extractFieldsFromText } = require('./field-extractor.service');
const { normalizeExtractedFields } = require('./normalizer.service');
const { calculateFieldConfidence } = require('./confidence.service');
const { extractWithLlm, mergeLlmExtraction } = require('./llm-extractor.service');

async function processDocumentImage({ buffer, mimetype, originalname }) {
  const quality = await assessImageQuality({ buffer, mimetype, originalname });
  if (!quality.accepted) {
    const error = new Error('Image failed quality gate');
    error.statusCode = 422;
    error.code = 'image_quality_rejected';
    error.details = quality;
    throw error;
  }

  const preprocessing = await preprocessImage({ buffer, mimetype, originalname });
  const ocrResult = await ocr.extractBestText({ variants: preprocessing.variants });
  const processedVariant = preprocessing.variants.find((variant) => variant.name === ocrResult.variant_name)
    || preprocessing.variants[0];
  const document = classifyDocument({ text: ocrResult.text });
  const extraction = extractFieldsFromText({ text: ocrResult.text, documentType: document.type });
  const heuristicFields = normalizeExtractedFields(extraction.fields);
  const heuristicConfidence = calculateFieldConfidence({
    fieldSources: extraction.sources,
    ocrConfidence: ocrResult.confidence,
    qualityWarnings: quality.warnings,
  });
  const llm = await extractWithLlm({
    text: ocrResult.text,
    documentType: document.type,
    heuristicFields,
    qualityWarnings: quality.warnings,
    imageBuffer: processedVariant.buffer,
    imageMimeType: processedVariant.mimeType,
  });
  const merged = mergeLlmExtraction({
    heuristicFields,
    heuristicSources: extraction.sources,
    heuristicConfidence: heuristicConfidence.fields,
    llmResult: llm,
  });
  const confidence = calculateFieldConfidence({
    fieldSources: merged.sources,
    ocrConfidence: ocrResult.confidence,
    qualityWarnings: quality.warnings,
  });
  confidence.requires_manual_review = confidence.requires_manual_review || merged.requires_manual_review;

  return {
    quality,
    preprocessing: {
      variants: preprocessing.variants.map((variant) => ({
        name: variant.name,
        mimeType: variant.mimeType,
        operations: variant.operations,
        width: variant.width,
        height: variant.height,
      })),
      selected_variant: processedVariant.name,
    },
    ocr: ocrResult,
    document,
    extracted: merged.fields,
    normalized: merged.fields,
    confidence,
    processedVariant,
    llm: {
      enabled: llm.enabled,
      attempted: llm.attempted,
      success: llm.success,
      model: llm.model || null,
      applied_fields: merged.applied_fields,
      used_for_final_fields: merged.llm_used,
      requires_manual_review: merged.requires_manual_review,
      notes: merged.llm_notes,
      error: llm.error || null,
    },
  };
}

module.exports = {
  processDocumentImage,
};
