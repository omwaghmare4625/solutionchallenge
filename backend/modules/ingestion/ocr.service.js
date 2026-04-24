const Tesseract = require('tesseract.js');

async function extractText(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng');
  return (result?.data?.text || '').trim();
}

module.exports = {
  extractText,
};
