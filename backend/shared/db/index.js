const { Pool } = require('pg');

let pool;

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS || 5000),
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();

    pool.on('error', (error) => {
      console.error('[shared/db] unexpected idle client error', error);
    });
  }

  return pool;
}

module.exports = {
  query: (text, params) => getPool().query(text, params),
  getPool,
};
