const FORM_LABEL_PATTERNS = [
  /\b(name|age|gender|village|ward|district|phone|address)\b/gi,
  /\b(category|need type|issue|problem|urgency|severity|households|families)\b/gi,
];

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => count + ((text.match(pattern) || []).length), 0);
}

function classifyDocument({ text = '' }) {
  const normalized = String(text || '');
  const lineCount = normalized.split('\n').map((line) => line.trim()).filter(Boolean).length;
  const colonCount = (normalized.match(/:/g) || []).length;
  const checkboxCount = (normalized.match(/\[[x ]\]|☐|☑/gi) || []).length;
  const questionCount = (normalized.match(/\?/g) || []).length;
  const formSignalCount = countMatches(normalized, FORM_LABEL_PATTERNS);

  if (formSignalCount >= 5 && (colonCount >= 3 || checkboxCount >= 1)) {
    return {
      type: 'structured_form',
      confidence: 0.87,
      signals: { lineCount, colonCount, checkboxCount, questionCount, formSignalCount },
    };
  }

  if (formSignalCount >= 3 || questionCount >= 2) {
    return {
      type: 'survey_sheet',
      confidence: 0.76,
      signals: { lineCount, colonCount, checkboxCount, questionCount, formSignalCount },
    };
  }

  return {
    type: 'field_note',
    confidence: lineCount <= 2 ? 0.62 : 0.69,
    signals: { lineCount, colonCount, checkboxCount, questionCount, formSignalCount },
  };
}

module.exports = {
  classifyDocument,
};
