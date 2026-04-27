const sharp = require('sharp');

async function createVariant(buffer, name, operations, transform) {
  const outputBuffer = await transform(sharp(buffer, { failOn: 'none' })).png().toBuffer();
  const metadata = await sharp(outputBuffer, { failOn: 'none' }).metadata();

  return {
    name,
    buffer: outputBuffer,
    mimeType: 'image/png',
    operations,
    width: metadata.width || null,
    height: metadata.height || null,
  };
}

async function preprocessImage({ buffer }) {
  const variants = [
    {
      name: 'original',
      buffer,
      mimeType: 'application/octet-stream',
      operations: ['raw_upload'],
      width: null,
      height: null,
    },
  ];

  variants.push(
    await createVariant(buffer, 'normalized', ['auto_rotate', 'resize', 'grayscale', 'normalize', 'sharpen'], (image) =>
      image
        .rotate()
        .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
    )
  );

  variants.push(
    await createVariant(buffer, 'thresholded', ['auto_rotate', 'resize', 'grayscale', 'normalize', 'threshold'], (image) =>
      image
        .rotate()
        .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .threshold(170)
    )
  );

  return { variants };
}

module.exports = {
  preprocessImage,
};
