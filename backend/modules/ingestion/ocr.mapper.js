const CATEGORY_KEYWORDS = {
  healthcare: ['medical', 'hospital', 'doctor', 'medicine'],
  infrastructure: ['road', 'flood', 'water', 'electricity'],
  food: ['food', 'hunger', 'ration'],
  shelter: ['shelter', 'house', 'tent'],
};

const hasKeyword = (text, keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(text);

const inRange = (value, min, max) => value >= min && value <= max;

function detectCategoryKey(text) {
  for (const [categoryKey, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => hasKeyword(text, keyword))) {
      return categoryKey;
    }
  }

  return null;
}

function detectSeverity(text) {
  if (/\bemergency\b/i.test(text)) {
    return 5;
  }

  if (/\burgent\b/i.test(text)) {
    return 4;
  }

  return 3;
}

function extractCoordinates(text) {
  let lat = null;
  let lng = null;

  const latMatch = text.match(/\blat(?:itude)?\b\s*[:=]?\s*(-?\d{1,2}(?:\.\d+)?)/i);
  const lngMatch = text.match(/\b(?:lng|lon|long|longitude)\b\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/i);

  if (latMatch && lngMatch) {
    const parsedLat = Number(latMatch[1]);
    const parsedLng = Number(lngMatch[1]);

    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      if (inRange(parsedLat, -90, 90) && inRange(parsedLng, -180, 180)) {
        return { lat: parsedLat, lng: parsedLng };
      }
    }
  }

  const pairMatch = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);

  if (pairMatch) {
    const parsedLat = Number(pairMatch[1]);
    const parsedLng = Number(pairMatch[2]);

    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      if (inRange(parsedLat, -90, 90) && inRange(parsedLng, -180, 180)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }
  }

  return { lat, lng };
}

function mapText(rawText = '') {
  const text = String(rawText || '').toLowerCase();
  const { lat, lng } = extractCoordinates(text);

  return {
    category_key: detectCategoryKey(text),
    severity: detectSeverity(text),
    lat,
    lng,
  };
}

module.exports = {
  mapText,
};
