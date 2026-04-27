const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/solutionchallenge';
process.env.STORAGE_BACKEND = 'local';

const dbModuleA = require('../../shared/db');
const dbModuleB = require('../../shared/db');

test('db module returns a singleton pool instance', () => {
  assert.equal(dbModuleA.getPool(), dbModuleB.getPool());
});
