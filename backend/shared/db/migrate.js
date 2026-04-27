const fs = require('fs/promises');
const path = require('path');

const { getPool } = require('./index');
const { logger } = require('../logging');

async function migrate() {
  const sqlPath = path.resolve(__dirname, '../../../infra/init.sql');
  const sql = await fs.readFile(sqlPath, 'utf8');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    logger.info({
      message: 'Database migration completed',
      module: 'db',
      route: 'migrate',
      code: 'migration_complete'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({
      message: error.message,
      module: 'db',
      route: 'migrate',
      code: 'migration_failed'
    });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(async () => {
      await getPool().end();
    })
    .catch(async (error) => {
      console.error(error);
      await getPool().end();
      process.exitCode = 1;
    });
}

module.exports = { migrate };
