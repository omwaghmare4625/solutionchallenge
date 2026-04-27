const { healthcheck, getPool } = require('./index');

async function main() {
  const ok = await healthcheck();
  if (!ok) {
    throw new Error('Database healthcheck failed');
  }

  console.log(JSON.stringify({ ok: true, database: 'connected' }, null, 2));
}

if (require.main === module) {
  main()
    .then(async () => {
      await getPool().end();
    })
    .catch(async (error) => {
      console.error(error);
      await getPool().end();
      process.exitCode = 1;
    });
}

module.exports = { main };
