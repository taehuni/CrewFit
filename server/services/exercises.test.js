import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mergeInput, mergeExerciseNames } from './exercises.js';
import { createExercisesRouter } from '../routes/exercises.js';

test('merge input trims and rejects missing, blank, long and same case-insensitive names', () => {
  assert.deepEqual(mergeInput({ from: ' Bench ', to: ' 벤치프레스 ' }), { from: 'Bench', to: '벤치프레스' });
  for (const input of [null, [], {}, { from: 1, to: 'a' }, { from: '', to: 'b' }, { from: 'a', to: ' ' },
    { from: 'a', to: 'A' }, { from: 'x'.repeat(101), to: 'a' }, { from: 'a', to: 'x'.repeat(101) }]) {
    assert.throws(() => mergeInput(input), error => error.status === 400 && error.code === 'INVALID_NAMES');
  }
});
test('merge uses one caller-bound RPC, literal special characters and database affected count', async () => {
  const calls = [];
  const db = { rpc: async (...args) => { calls.push(args); return { data: 1200 }; } };
  assert.deepEqual(await mergeExerciseNames(db, { from: '100%_* ,"\\운동', to: '새 이름', user_id: 'victim' }), { updated: 1200 });
  assert.deepEqual(calls, [['merge_exercise_names', { p_from: '100%_* ,"\\운동', p_to: '새 이름' }]]);
});
test('merge maps conflict/permissions/migration/input errors without disclosing SQL details', async () => {
  for (const [code, status, expected] of [['23505',409,'CONFLICT'], ['42501',403,'FORBIDDEN'],
    ['22023',400,'INVALID_NAMES'], ['PGRST202',503,'MIGRATION_REQUIRED'], ['other',500,'MERGE_FAILED']]) {
    await assert.rejects(mergeExerciseNames({ rpc: async () => ({ error: { code, message: 'private database detail' } }) }, { from: 'a', to: 'b' }),
      error => error.status === status && error.code === expected && !error.message.includes('private database detail'));
  }
  await assert.rejects(mergeExerciseNames({ rpc: async () => ({ data: 0 }) }, { from: 'a', to: 'b' }), error => error.status === 404);
  for (const data of [null, '3', -1, 1.2]) await assert.rejects(mergeExerciseNames({ rpc: async () => ({ data }) }, { from: 'a', to: 'b' }), error => error.status === 500);
});
test('invalid input never invokes the database', async () => {
  let calls = 0;
  await assert.rejects(mergeExerciseNames({ rpc: async () => { calls++; } }, { from: 'a', to: 'A' }));
  assert.equal(calls, 0);
});
test('HTTP route requires auth and returns count, validation, conflict and generic failure responses', async t => {
  const calls = [];
  let result = { data: 3 }, transportFailure = false;
  const db = { rpc: async (...args) => { calls.push(args); if (transportFailure) throw new Error('private network detail'); return result; } };
  const app = express(); app.use(express.json());
  app.use('/api/exercises', createExercisesRouter((req, res, next) => {
    if (req.headers.authorization !== 'Bearer test-owner') return res.status(401).json({ error: { code: 'no_token' } });
    req.user = { id: 'owner' }; req.db = db; next();
  }));
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/exercises/merge`;
  async function request(body, authenticated = true) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer test-owner' } : {}) }, body: JSON.stringify(body) });
  }
  assert.equal((await request({ from: 'a', to: 'b' }, false)).status, 401); assert.equal(calls.length, 0);
  assert.equal((await request({ from: 'a', to: 'A' })).status, 400); assert.equal(calls.length, 0);
  const ok = await request({ from: 'a', to: 'b', user_id: 'victim' });
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { updated: 3 });
  assert.deepEqual(calls[0][1], { p_from: 'a', p_to: 'b' });
  result = { error: { code: '23505' } }; assert.equal((await request({ from: 'a', to: 'b' })).status, 409);
  transportFailure = true;
  const failed = await request({ from: 'a', to: 'b' });
  assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /private network detail/);
});
