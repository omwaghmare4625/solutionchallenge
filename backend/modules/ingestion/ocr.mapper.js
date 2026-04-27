const { extractFieldsFromText } = require('./field-extractor.service');

function mapText(rawText = '') {
  return extractFieldsFromText({ text: rawText }).fields;
}

module.exports = {
  mapText,
};
