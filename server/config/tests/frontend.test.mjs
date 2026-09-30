import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveFrontend } from '../frontend.js';

test('production hosting preserves APIs, serves deep links, and rejects missing assets/private paths', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crewfit-hosting-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'index.html'), '<html>CrewFit test</html>');
  await writeFile(path.join(directory, 'assets', 'app.js'), 'window.app=true;');
  await writeFile(path.join(directory, '.env'), 'PRIVATE_SENTINEL');
  const app = express();
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.get('/api/protected', (req, res) => res.status(401).json({ error: 'unauthorized' }));
  serveFrontend(app, directory);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/activities/track', '/auth/callback', '/reset-password']) {
    const response = await fetch(base + route, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<html>CrewFit test</html>');
    assert.equal(response.headers.get('cache-control'), 'no-cache');
  }
  assert.deepEqual(await (await fetch(base + '/health')).json(), { ok: true });
  assert.equal((await fetch(base + '/api/protected')).status, 401);
  const unknownApi = await fetch(base + '/api/missing');
  assert.equal(unknownApi.status, 404);
  assert.equal((await unknownApi.json()).error.code, 'NOT_FOUND');
  assert.equal((await fetch(base + '/assets/app.js')).status, 200);
  for (const route of ['/assets/missing.js', '/assets/missing', '/.env', '/.git/config']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes('PRIVATE_SENTINEL'));
  }
});
