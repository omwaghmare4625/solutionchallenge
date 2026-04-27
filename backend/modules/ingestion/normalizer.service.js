function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function normalizeExtractedFields(fields = {}) {
  return {
    category_key: fields.category_key || 'unknown',
    severity: Math.round(clampNumber(fields.severity, 1, 5, 3)),
    lat: Number.isFinite(Number(fields.lat)) ? Number(fields.lat) : null,
    lng: Number.isFinite(Number(fields.lng)) ? Number(fields.lng) : null,
    population_affected: Math.max(0, Math.round(clampNumber(fields.population_affected, 0, 1000000, 0))),
    time_sensitivity_hours: Math.max(0, Math.round(clampNumber(fields.time_sensitivity_hours, 0, 24 * 30, 48))),
    description: String(fields.description || '').trim().slice(0, 500) || null,
  };
}

module.exports = {
  normalizeExtractedFields,
};
