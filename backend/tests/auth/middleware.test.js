const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRequireAuth } = require('../../modules/auth/middleware');

function createReq(authorization) {
  return {
    headers: {
      authorization
    }
  };
}

test('requireAuth returns 401 when token is missing', async () => {
  const requireAuth = buildRequireAuth({
    verifyAccessToken: async () => ({ uid: 'uid-1' }),
    findUserByAuthUserId: async () => ({ user_id: '1', role: 'admin', ngo_id: 'ngo-1', email: 'a@b.c', locale: 'en-IN' })
  });

  const handler = requireAuth(['admin']);

  await new Promise((resolve) => {
    handler(createReq(), {}, (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, 'missing_token');
      resolve();
    });
  });
});

test('requireAuth returns 403 when user role is not allowed', async () => {
  const requireAuth = buildRequireAuth({
    verifyAccessToken: async () => ({ uid: 'uid-1' }),
    findUserByAuthUserId: async () => ({ user_id: '1', role: 'volunteer', ngo_id: 'ngo-1', email: 'a@b.c', locale: 'en-IN' })
  });

  const handler = requireAuth(['admin']);

  await new Promise((resolve) => {
    handler(createReq('Bearer token'), {}, (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      resolve();
    });
  });
});

test('requireAuth populates req.user when token and role are valid', async () => {
  const requireAuth = buildRequireAuth({
    verifyAccessToken: async () => ({ uid: 'uid-1', role: 'admin', ngo_id: 'ngo-claims' }),
    findUserByAuthUserId: async () => ({ user_id: '1', auth_user_id: 'uid-1', role: 'admin', ngo_id: 'ngo-db', email: 'a@b.c', locale: 'en-IN' })
  });

  const handler = requireAuth(['admin']);
  const req = createReq('Bearer token');

  await new Promise((resolve, reject) => {
    handler(req, {}, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  assert.deepEqual(req.user, {
    user_id: '1',
    auth_user_id: 'uid-1',
    role: 'admin',
    ngo_id: 'ngo-claims',
    email: 'a@b.c',
    locale: 'en-IN'
  });
});
