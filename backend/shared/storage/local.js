const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function createLocalStorage({ uploadsAbsolutePath, localAssetBaseUrl }) {
  async function ensureUploadsDir() {
    await fs.mkdir(uploadsAbsolutePath, { recursive: true });
  }

  async function save(buffer, filename) {
    await ensureUploadsDir();

    const objectName = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
    const absolutePath = path.join(uploadsAbsolutePath, objectName);
    await fs.writeFile(absolutePath, buffer);
    return `local://${objectName}`;
  }

  function getUrl(ref) {
    const relativePath = ref.replace(/^local:\/\//, '');
    return `${localAssetBaseUrl}/${relativePath}`;
  }

  async function deleteRef(ref) {
    const relativePath = ref.replace(/^local:\/\//, '');
    const absolutePath = path.join(uploadsAbsolutePath, relativePath);
    await fs.rm(absolutePath, { force: true });
  }

  return {
    save,
    getUrl,
    delete: deleteRef
  };
}

module.exports = { createLocalStorage };
