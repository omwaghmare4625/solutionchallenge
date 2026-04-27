const Tesseract = require('tesseract.js');

function summarizeText(text) {
  return (String(text || '').match(/[A-Za-z0-9]/g) || []).length;
}

function scoreOcrPass({ text, confidence }) {
  const lineCount = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;

  return (Number(confidence || 0) * 0.7) + Math.min(summarizeText(text) / 6, 20) + Math.min(lineCount * 2, 10);
}

async function runOcrPass(variant) {
  const result = await Tesseract.recognize(variant.buffer, 'eng');
  const text = (result?.data?.text || '').trim();
  const confidence = Number(result?.data?.confidence || 0);

  return {
    variant_name: variant.name,
    text,
    confidence,
    score: scoreOcrPass({ text, confidence }),
  };
}

async function extractBestText({ variants = [] }) {
  const passes = [];

  for (const variant of variants) {
    passes.push(await runOcrPass(variant));
  }

  const sorted = passes.slice().sort((left, right) => right.score - left.score);
  const best = sorted[0] || {
    variant_name: 'original',
    text: '',
    confidence: 0,
    score: 0,
  };

  return {
    text: best.text,
    confidence: best.confidence,
    variant_name: best.variant_name,
    passes: passes.map((pass) => ({
      variant_name: pass.variant_name,
      confidence: pass.confidence,
      score: pass.score,
      text_length: pass.text.length,
    })),
  };
}

async function extractText(buffer) {
  const result = await extractBestText({
    variants: [
      {
        name: 'original',
        buffer,
      },
    ],
  });

  return result.text;
}

module.exports = {
  extractText,
  extractBestText,
};
