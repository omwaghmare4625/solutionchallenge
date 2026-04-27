const config = require('../config');
const { createLocalStorage } = require('./local');
const { createSupabaseStorage } = require('./supabase');

let storage;

function createStorage() {
  if (config.storage.backend === 'local') {
    return createLocalStorage({
      uploadsAbsolutePath: config.storage.uploadsAbsolutePath,
      localAssetBaseUrl: config.storage.localAssetBaseUrl
    });
  }

  if (config.storage.backend === 'supabase') {
    return createSupabaseStorage({
      supabaseUrl: config.supabase.url,
      serviceRoleKey: config.supabase.serviceRoleKey,
      bucketName: config.storage.supabaseBucket
    });
  }

  throw new Error(`Unsupported storage backend: ${config.storage.backend}`);
}

function getStorage() {
  if (!storage) {
    storage = createStorage();
  }
  return storage;
}

module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = getStorage();
      return instance[prop];
    }
  }
);

module.exports.getStorage = getStorage;
module.exports.createStorage = createStorage;
