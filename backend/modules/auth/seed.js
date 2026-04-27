const authService = require('./service');
const config = require('../../shared/config');
const { getPool } = require('../../shared/db');

async function seed() {
  let ngo = await authService.findNgoByName(config.seed.ngoName);
  if (!ngo) {
    ngo = await authService.createNgo({
      name: config.seed.ngoName,
      locale: config.seed.adminLocale
    });
  }

  const existing = await authService.findUserByEmail(config.seed.adminEmail);
  if (existing) {
    return { ngo, admin: existing, reused: true };
  }

  const admin = await authService.createUserProfile({
    email: config.seed.adminEmail,
    password: config.seed.adminPassword,
    role: 'admin',
    ngoId: ngo.id,
    locale: config.seed.adminLocale
  });

  return { ngo, admin, reused: false };
}

if (require.main === module) {
  seed()
    .then(async (result) => {
      console.log(JSON.stringify(result, null, 2));
      await getPool().end();
    })
    .catch(async (error) => {
      console.error(error);
      await getPool().end();
      process.exitCode = 1;
    });
}

module.exports = { seed };
