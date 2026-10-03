import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('GPS draft migration stays in sync with fresh database schema and documented SQL', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const migration = read('../migrations/20261003_gps_drafts.sql').trim();
  assert.ok(read('../schema.sql').includes(migration));
  assert.ok(read('../../../docs/architecture/schema.md').includes(migration));
});
