const test = require('node:test');
const assert = require('node:assert/strict');

const { createSupabaseStorage } = require('../../shared/storage/supabase');

test('supabase storage saves, signs, and deletes objects through the SDK', async () => {
  const calls = {
    upload: 0,
    signedUrl: 0,
    remove: 0
  };

  const storage = createSupabaseStorage({
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-key',
    bucketName: 'report-photos',
    client: {
    storage: {
      from(name) {
        assert.equal(name, 'report-photos');
        return {
          async upload(objectKey) {
            calls.upload += 1;
            assert.match(objectKey, /^reports\//);
            return { error: null };
          },
          async createSignedUrl(objectKey) {
            calls.signedUrl += 1;
            assert.match(objectKey, /^reports\//);
            return { data: { signedUrl: 'https://example.com/signed-url' }, error: null };
          },
          async remove(objectKeys) {
            calls.remove += 1;
            assert.equal(objectKeys.length, 1);
            return { error: null };
          }
        };
      }
    }
    }
  });

  const ref = await storage.save(Buffer.from('hello'), 'report-photo.jpg');
  assert.match(ref, /^supabase:\/\/report-photos\/reports\//);
  const url = await storage.getUrl(ref);
  assert.equal(url, 'https://example.com/signed-url');
  await storage.delete(ref);

  assert.equal(calls.upload, 1);
  assert.equal(calls.signedUrl, 1);
  assert.equal(calls.remove, 1);
});
