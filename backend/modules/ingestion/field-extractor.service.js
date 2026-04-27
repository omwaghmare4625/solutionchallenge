const CATEGORY_PATTERNS = {
  healthcare: ['health', 'clinic', 'hospital', 'doctor', 'nurse', 'medicine', 'medical', 'fever', 'illness', 'pregnan', 'malnutrition', 'vaccin'],
  food: ['food', 'ration', 'hunger', 'meal', 'nutrition', 'grain', 'kitchen', 'starvation'],
  shelter: ['shelter', 'housing', 'house', 'roof', 'tent', 'homeless', 'displaced', 'sleeping outside'],
  infrastructure: ['water', 'sanitation', 'toilet', 'drainage', 'road', 'bridge', 'electricity', 'power', 'sewage', 'internet', 'transport', 'damaged building'],
};

const CATEGORY_VALUE_PATTERNS = [
  /\b(?:category|need type|issue|problem|support required)\b\s*[:=-]?\s*([a-z ,/-]+)/i,
];

const SEVERITY_RULES = [
  { score: 5, pattern: /\b(life[\s-]?threatening|critical|emergency|immediate danger)\b/i },
  { score: 4, pattern: /\b(urgent|asap|within 24 hours|same day|severe shortage|high priority)\b/i },
  { score: 2, pattern: /\b(minor|low priority|non[\s-]?urgent|routine)\b/i },
];

const TIME_SENSITIVITY_RULES = [
  { hours: 6, pattern: /\b(today|immediately|now|asap|same day)\b/i },
  { hours: 24, pattern: /\b(within 24 hours|tomorrow|next day|urgent)\b/i },
  { hours: 72, pattern: /\b(this week|within 3 days|few days)\b/i },
];

const inRange = (value, min, max) => value >= min && value <= max;

function normalizeText(rawText) {
  return String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function cleanDescription(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')
    .slice(0, 500) || null;
}

function resolveCategoryFromValue(value = '') {
  const lowerValue = String(value || '').toLowerCase();
  let bestMatch = null;

  for (const [categoryKey, keywords] of Object.entries(CATEGORY_PATTERNS)) {
    const score = keywords.reduce((count, keyword) => count + (lowerValue.includes(keyword) ? 1 : 0), 0);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { categoryKey, score };
    }
  }

  return bestMatch && bestMatch.score > 0 ? bestMatch.categoryKey : null;
}

function detectCategoryKey(text) {
  for (const pattern of CATEGORY_VALUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const resolved = resolveCategoryFromValue(match[1]);
      if (resolved) {
        return { value: resolved, source: 'explicit_label' };
      }
    }
  }

  const resolved = resolveCategoryFromValue(text);
  return { value: resolved, source: resolved ? 'keyword_heuristic' : 'missing' };
}

function detectSeverity(text) {
  const numericMatch = text.match(/\b(?:severity|priority|urgency)\b\s*[:=-]?\s*([1-5])\b/i);
  if (numericMatch) {
    return { value: Number(numericMatch[1]), source: 'explicit_label' };
  }

  for (const rule of SEVERITY_RULES) {
    if (rule.pattern.test(text)) {
      return { value: rule.score, source: 'keyword_heuristic' };
    }
  }

  if (/\b(shortage|lack|not enough|scarcity|problem|issue|need support|soon)\b/i.test(text)) {
    return { value: 3, source: 'keyword_heuristic' };
  }

  return { value: 2, source: 'default' };
}

function extractCoordinates(text) {
  const latMatch = text.match(/\blat(?:itude)?\b\s*[:=]?\s*(-?\d{1,2}(?:\.\d+)?)/i);
  const lngMatch = text.match(/\b(?:lng|lon|long|longitude)\b\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/i);

  if (latMatch && lngMatch) {
    const parsedLat = Number(latMatch[1]);
    const parsedLng = Number(lngMatch[1]);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng) && inRange(parsedLat, -90, 90) && inRange(parsedLng, -180, 180)) {
      return {
        lat: { value: parsedLat, source: 'explicit_label' },
        lng: { value: parsedLng, source: 'explicit_label' },
      };
    }
  }

  const pairMatch = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (pairMatch) {
    const parsedLat = Number(pairMatch[1]);
    const parsedLng = Number(pairMatch[2]);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng) && inRange(parsedLat, -90, 90) && inRange(parsedLng, -180, 180)) {
      return {
        lat: { value: parsedLat, source: 'coordinate_pair' },
        lng: { value: parsedLng, source: 'coordinate_pair' },
      };
    }
  }

  return {
    lat: { value: null, source: 'missing' },
    lng: { value: null, source: 'missing' },
  };
}

function extractPopulationAffected(text) {
  const patterns = [
    { pattern: /\bpopulation(?: affected)?\b\s*[:=]?\s*(\d{1,6})\b/i, multiplier: 1, source: 'explicit_label' },
    { pattern: /\b(\d{1,6})\s+(?:people|persons|residents|villagers|citizens|patients|children|students)\b/i, multiplier: 1, source: 'keyword_heuristic' },
    { pattern: /\b(\d{1,6})\s+(?:famil(?:y|ies)|households)\b/i, multiplier: 4, source: 'keyword_heuristic' },
  ];

  for (const entry of patterns) {
    const match = text.match(entry.pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isInteger(value) && value >= 0) {
      return { value: value * entry.multiplier, source: entry.source };
    }
  }

  return { value: 0, source: 'default' };
}

function extractTimeSensitivityHours(text) {
  const explicitHourMatch = text.match(/\b(?:within|in)\s+(\d{1,3})\s+hours?\b/i);
  if (explicitHourMatch) return { value: Number(explicitHourMatch[1]), source: 'explicit_label' };

  const explicitDayMatch = text.match(/\b(?:within|in)\s+(\d{1,2})\s+days?\b/i);
  if (explicitDayMatch) return { value: Number(explicitDayMatch[1]) * 24, source: 'explicit_label' };

  for (const rule of TIME_SENSITIVITY_RULES) {
    if (rule.pattern.test(text)) {
      return { value: rule.hours, source: 'keyword_heuristic' };
    }
  }

  return { value: 48, source: 'default' };
}

function extractDescription(text) {
  const description = cleanDescription(text);
  return { value: description, source: description ? 'ocr_summary' : 'missing' };
}

function extractFieldsFromText({ text = '' }) {
  const normalizedText = normalizeText(text);
  const lowerText = normalizedText.toLowerCase();
  const category = detectCategoryKey(lowerText);
  const severity = detectSeverity(lowerText);
  const coordinates = extractCoordinates(lowerText);
  const population = extractPopulationAffected(normalizedText);
  const timeSensitivity = extractTimeSensitivityHours(normalizedText);
  const description = extractDescription(normalizedText);

  return {
    fields: {
      category_key: category.value,
      severity: severity.value,
      lat: coordinates.lat.value,
      lng: coordinates.lng.value,
      population_affected: population.value,
      time_sensitivity_hours: timeSensitivity.value,
      description: description.value,
    },
    sources: {
      category_key: category.source,
      severity: severity.source,
      lat: coordinates.lat.source,
      lng: coordinates.lng.source,
      population_affected: population.source,
      time_sensitivity_hours: timeSensitivity.source,
      description: description.source,
    },
  };
}

module.exports = {
  extractFieldsFromText,
  normalizeText,
};
