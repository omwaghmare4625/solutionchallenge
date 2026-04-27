const { Pool } = require('pg');
const config = require('../config');
const { logger } = require('../logging');

let pool;

function createPool() {
  config.assertStartupConfig();

  const poolConfig = {
    connectionString: config.db.url
  };

  if (config.db.sslEnabled) {
    const connectionUrl = new URL(config.db.url);
    connectionUrl.searchParams.delete('sslmode');
    poolConfig.connectionString = connectionUrl.toString();
    poolConfig.ssl = {
      rejectUnauthorized: config.db.sslRejectUnauthorized
    };
  }

  const instance = new Pool(poolConfig);

  instance.on('error', (error) => {
    logger.error({
      message: error.message,
      module: 'db',
      route: 'pool',
      code: 'pool_error'
    });
  });

  return instance;
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function healthcheck() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

module.exports = {
  getPool,
  query,
  healthcheck
};
