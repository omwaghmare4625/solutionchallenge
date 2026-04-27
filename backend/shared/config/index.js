const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function readRequired(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePrivateKey(value) {
  if (!value) {
    return '';
  }
  return value.replace(/\\n/g, '\n');
}

function readBoolean(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true';
}

const backend = process.env.STORAGE_BACKEND || 'local';
const uploadsDir = process.env.UPLOADS_DIR || './uploads';

const config = {
  app: {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: (process.env.NODE_ENV || 'development') !== 'production'
  },
  db: {
    url: process.env.DATABASE_URL || '',
    sslEnabled: readBoolean(process.env.DB_SSL_ENABLED, false),
    sslRejectUnauthorized: readBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true)
  },
  auth: {
    provider: process.env.AUTH_PROVIDER || 'local'
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    webApiKey: process.env.FIREBASE_WEB_API_KEY || ''
  },
  storage: {
    backend,
    uploadsDir,
    uploadsAbsolutePath: path.resolve(process.cwd(), uploadsDir),
    localAssetBaseUrl: process.env.LOCAL_ASSET_BASE_URL || '/uploads',
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'report-photos'
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-5.4-nano'
  },
  llm: {
    helperEnabled: readBoolean(process.env.OPENAI_LLM_HELPER_ENABLED, false),
    timeoutMs: Number(process.env.OPENAI_LLM_TIMEOUT_MS || 15000),
    minFieldConfidence: Number(process.env.OPENAI_LLM_MIN_FIELD_CONFIDENCE || 0.74),
    includeImage: readBoolean(process.env.OPENAI_LLM_INCLUDE_IMAGE, true)
  },
  seed: {
    adminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
    adminLocale: process.env.DEFAULT_ADMIN_LOCALE || 'en-IN',
    ngoName: process.env.DEFAULT_NGO_NAME || 'Default NGO'
  }
};

function assertStartupConfig() {
  if (!config.db.url) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  if (!['local', 'supabase', 'firebase'].includes(config.auth.provider)) {
    throw new Error(`Unsupported AUTH_PROVIDER value: ${config.auth.provider}`);
  }

  if (
    config.auth.provider === 'firebase'
    && !config.firebase.serviceAccountPath
    && (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey)
  ) {
    throw new Error('Firebase auth provider selected but neither FIREBASE_SERVICE_ACCOUNT_PATH nor inline Firebase credentials are configured');
  }

  if (config.storage.backend === 'supabase' && (!config.supabase.url || !config.supabase.serviceRoleKey)) {
    throw new Error('Supabase storage backend selected but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  if (config.auth.provider === 'supabase' && (!config.supabase.url || !config.supabase.serviceRoleKey)) {
    throw new Error('Supabase auth provider selected but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  if (config.storage.backend !== 'supabase' && config.storage.backend !== 'local') {
    throw new Error(`Unsupported STORAGE_BACKEND value: ${config.storage.backend}`);
  }
}

config.assertStartupConfig = assertStartupConfig;
config.readRequired = readRequired;

module.exports = config;
