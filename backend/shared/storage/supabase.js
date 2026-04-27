const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function createSupabaseStorage({
  supabaseUrl,
  serviceRoleKey,
  bucketName,
  client
}) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL and service role key are required for the supabase storage backend');
  }

  const supabaseClient = client || createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  async function save(buffer, filename) {
    const objectKey = path.posix.join('reports', `${crypto.randomUUID()}-${sanitizeFilename(filename)}`);
    const { error } = await supabaseClient.storage.from(bucketName).upload(objectKey, buffer, {
      upsert: false,
      contentType: 'application/octet-stream'
    });

    if (error) {
      throw error;
    }

    return `supabase://${bucketName}/${objectKey}`;
  }

  async function getUrl(ref) {
    const objectKey = ref.replace(`supabase://${bucketName}/`, '');
    const { data, error } = await supabaseClient.storage.from(bucketName).createSignedUrl(objectKey, 900);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  async function deleteRef(ref) {
    const objectKey = ref.replace(`supabase://${bucketName}/`, '');
    const { error } = await supabaseClient.storage.from(bucketName).remove([objectKey]);
    if (error) {
      throw error;
    }
  }

  return {
    save,
    getUrl,
    delete: deleteRef
  };
}

module.exports = { createSupabaseStorage };
