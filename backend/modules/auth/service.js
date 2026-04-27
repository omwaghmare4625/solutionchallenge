const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const config = require('../../shared/config');
const db = require('../../shared/db');

const BCRYPT_ROUNDS = 12;

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

let supabaseAdminClient;
let firebaseApp;

function getSupabaseAdminClient() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw createHttpError(500, 'supabase_not_configured', 'Supabase is not configured');
  }

  supabaseAdminClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  return supabaseAdminClient;
}

function getFirebaseApp() {
  if (firebaseApp) {
    return firebaseApp;
  }

  let credentialConfig;

  if (config.firebase.serviceAccountPath) {
    const absolutePath = path.resolve(process.cwd(), config.firebase.serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    credentialConfig = {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key
    };
  } else if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    credentialConfig = {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey
    };
  } else {
    throw createHttpError(500, 'firebase_not_configured', 'Firebase Admin SDK is not configured');
  }

  firebaseApp = admin.apps[0]
    || admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentialConfig.projectId,
        clientEmail: credentialConfig.clientEmail,
        privateKey: credentialConfig.privateKey
      })
    });

  return firebaseApp;
}

function getFirebaseAuthClient() {
  return getFirebaseApp().auth();
}

async function createNgoIfMissing(ngoId) {
  const result = await db.query('SELECT id FROM ngos WHERE id = $1', [ngoId]);
  if (result.rowCount === 0) {
    throw createHttpError(422, 'ngo_not_found', 'Specified NGO does not exist');
  }
}

async function createUserProfile({ email, password, role, ngoId, locale }) {
  await createNgoIfMissing(ngoId);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let authUserId = null;

  if (config.auth.provider === 'firebase') {
    const firebaseAuth = getFirebaseAuthClient();

    try {
      const firebaseUser = await firebaseAuth.createUser({
        email,
        password
      });
      authUserId = firebaseUser.uid;
      await firebaseAuth.setCustomUserClaims(firebaseUser.uid, { role, ngo_id: ngoId });
    } catch (error) {
      throw createHttpError(422, 'firebase_user_create_failed', error.message);
    }
  } else if (config.auth.provider === 'supabase') {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, ngo_id: ngoId }
    });

    if (error) {
      throw createHttpError(422, 'supabase_user_create_failed', error.message);
    }

    authUserId = data.user?.id || null;
  }

  try {
    const insertResult = await db.query(
      `INSERT INTO users (ngo_id, email, auth_provider, auth_user_id, role, locale, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, ngo_id, email, auth_provider, auth_user_id, role, locale`,
      [ngoId, email, config.auth.provider, authUserId, role, locale || 'en-IN', passwordHash]
    );

    return mapUserRow(insertResult.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw createHttpError(409, 'user_exists', 'A user with this email already exists');
    }
    throw error;
  }
}

async function loginWithPassword({ email, password }) {
  if (config.auth.provider === 'firebase') {
    throw createHttpError(400, 'firebase_login_requires_id_token', 'Firebase auth requires an ID token from the client');
  }

  const result = await db.query(
    `SELECT id, ngo_id, email, auth_provider, auth_user_id, role, locale, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    throw createHttpError(401, 'invalid_credentials', 'Invalid email or password');
  }

  const matches = await bcrypt.compare(password, user.password_hash || '');
  if (!matches) {
    throw createHttpError(401, 'invalid_credentials', 'Invalid email or password');
  }

  return mapUserRow(user);
}

async function findUserByAuthUserId(authUserId) {
  const result = await db.query(
    `SELECT id, ngo_id, email, auth_provider, auth_user_id, role, locale
     FROM users
     WHERE auth_user_id = $1`,
    [authUserId]
  );
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function findUserByEmail(email) {
  const result = await db.query(
    `SELECT id, ngo_id, email, auth_provider, auth_user_id, role, locale
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function verifyAccessToken(token) {
  if (config.auth.provider === 'local') {
    throw createHttpError(501, 'local_token_auth_unsupported', 'Local auth currently supports password login, not bearer token verification');
  }

  if (config.auth.provider === 'firebase') {
    try {
      return await getFirebaseAuthClient().verifyIdToken(token);
    } catch (_error) {
      throw createHttpError(401, 'invalid_token', 'Invalid or expired authentication token');
    }
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw createHttpError(401, 'invalid_token', 'Invalid or expired authentication token');
  }

  return data.user;
}

async function loginWithIdToken(idToken) {
  const decoded = await verifyAccessToken(idToken);
  const authUserId = decoded.uid || decoded.id;
  const user = await findUserByAuthUserId(authUserId);
  if (!user) {
    throw createHttpError(404, 'user_not_found', 'No application profile exists for this auth user');
  }
  return user;
}

async function createNgo({ name, locale = 'en-IN' }) {
  const result = await db.query(
    'INSERT INTO ngos (name, locale) VALUES ($1, $2) RETURNING id, name, locale',
    [name, locale]
  );
  return result.rows[0];
}

async function findNgoByName(name) {
  const result = await db.query('SELECT id, name, locale FROM ngos WHERE name = $1', [name]);
  return result.rows[0] || null;
}

function mapUserRow(row) {
  return {
    user_id: row.id,
    ngo_id: row.ngo_id,
    email: row.email,
    auth_provider: row.auth_provider,
    auth_user_id: row.auth_user_id,
    role: row.role,
    locale: row.locale
  };
}

module.exports = {
  BCRYPT_ROUNDS,
  createNgo,
  createUserProfile,
  findNgoByName,
  findUserByAuthUserId,
  findUserByEmail,
  getFirebaseAuthClient,
  getSupabaseAdminClient,
  loginWithIdToken,
  loginWithPassword,
  mapUserRow,
  verifyAccessToken
};
