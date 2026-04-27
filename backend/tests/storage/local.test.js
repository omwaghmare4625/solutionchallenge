const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { createLocalStorage } = require('../../shared/storage/local');

test('local storage saves, resolves URL, and deletes files', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
  const storage = createLocalStorage({
    uploadsAbsolutePath: tempDir,
    localAssetBaseUrl: '/uploads'
  });

  const ref = await storage.save(Buffer.from('hello'), 'report-photo.jpg');
  assert.match(ref, /^local:\/\//);
  assert.match(storage.getUrl(ref), /^\/uploads\//);

  const relativePath = ref.replace(/^local:\/\//, '');
  await fs.access(path.join(tempDir, relativePath));

  await storage.delete(ref);

  await assert.rejects(fs.access(path.join(tempDir, relativePath)));
});
