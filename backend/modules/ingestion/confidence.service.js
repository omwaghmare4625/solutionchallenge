const SOURCE_SCORES = {
  explicit_label: 0.95,
  coordinate_pair: 0.82,
  llm_helper: 0.84,
  keyword_heuristic: 0.74,
  ocr_summary: 0.7,
  default: 0.45,
  missing: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreField(source, ocrConfidence, qualityPenalty) {
  const sourceScore = SOURCE_SCORES[source] ?? 0.4;
  const combined = (sourceScore * 0.65) + (ocrConfidence * 0.25) + ((1 - qualityPenalty) * 0.1);
  return clamp(Math.round(combined * 100) / 100, 0, 1);
}

function calculateFieldConfidence({ fieldSources = {}, ocrConfidence = 0, qualityWarnings = [] }) {
  const qualityPenalty = clamp((qualityWarnings.length || 0) * 0.08, 0, 0.35);
  const normalizedOcrConfidence = clamp(Number(ocrConfidence || 0) / 100, 0, 1);

  const fieldConfidence = Object.fromEntries(
    Object.entries(fieldSources).map(([field, source]) => [
      field,
      scoreField(source, normalizedOcrConfidence, qualityPenalty),
    ])
  );

  const values = Object.values(fieldConfidence);
  const overall = values.length > 0
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
    : 0;

  return {
    overall,
    fields: fieldConfidence,
    requires_manual_review: overall < 0.68 || qualityWarnings.length >= 2,
  };
}

module.exports = {
  calculateFieldConfidence,
};
