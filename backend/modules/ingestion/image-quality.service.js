const sharp = require('sharp');

const MIN_DIMENSION_REJECT = 400;
const MIN_DIMENSION_WARN = 900;
const MIN_FILE_SIZE_REJECT = 10 * 1024;
const MIN_FILE_SIZE_WARN = 40 * 1024;

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function assessImageQuality({ buffer, mimetype = '', originalname = '' }) {
  let metadata;
  let stats;

  try {
    metadata = await sharp(buffer, { failOn: 'none' }).metadata();
    stats = await sharp(buffer, { failOn: 'none' }).grayscale().stats();
  } catch (_error) {
    return {
      accepted: false,
      warnings: [],
      hardFailures: ['Uploaded file is not a readable image'],
      metadata: {
        mimetype,
        originalname,
        file_size_bytes: buffer.length,
      },
    };
  }

  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const brightness = round(stats?.channels?.[0]?.mean);
  const contrast = round(stats?.channels?.[0]?.stdev);

  const warnings = [];
  const hardFailures = [];

  if (buffer.length < MIN_FILE_SIZE_REJECT) {
    hardFailures.push('Image file is too small to process reliably');
  } else if (buffer.length < MIN_FILE_SIZE_WARN) {
    warnings.push('Image file size is low; OCR quality may drop');
  }

  if (!width || !height) {
    hardFailures.push('Image dimensions could not be detected');
  } else {
    if (width < MIN_DIMENSION_REJECT || height < MIN_DIMENSION_REJECT) {
      hardFailures.push('Image resolution is too low; retake the photo closer to the page');
    } else if (width < MIN_DIMENSION_WARN || height < MIN_DIMENSION_WARN) {
      warnings.push('Image resolution is lower than recommended for OCR');
    }

    if (width > height * 1.8 || height > width * 2.5) {
      warnings.push('Image aspect ratio suggests the page may be cropped or partially captured');
    }
  }

  if (brightness > 0 && brightness < 45) {
    warnings.push('Image appears dark; text may be hard to recover');
  } else if (brightness > 235) {
    warnings.push('Image appears overexposed; text contrast may be weak');
  }

  if (contrast > 0 && contrast < 18) {
    warnings.push('Image has low contrast; survey fields may blend into the page');
  }

  return {
    accepted: hardFailures.length === 0,
    warnings,
    hardFailures,
    metadata: {
      mimetype,
      originalname,
      file_size_bytes: buffer.length,
      width,
      height,
      format: metadata.format || null,
      brightness,
      contrast,
    },
  };
}

module.exports = {
  assessImageQuality,
};
