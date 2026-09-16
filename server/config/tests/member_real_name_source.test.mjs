// Source consistency only; DB execution uses member_real_name.sql.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sources = [
  '../schema.sql',
  '../migrations/20260909_member_real_name.sql',
  '../../../docs/architecture/schema.md',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));

test('signup trigger is identical in schema, migration and documentation', () => {
  const bodies = sources.map(source => source.match(/create or replace function public\.handle_new_user\(\)[\s\S]*?end \$\$;/i)?.[0].replace(/\r\n/g, '\n'));
  assert.ok(bodies.every(Boolean));
  assert.equal(bodies[0], bodies[1]);
  assert.equal(bodies[1], bodies[2]);
  assert.ok(bodies[0].includes("nullif(btrim(new.raw_user_meta_data->>'real_name'), '')"));
  assert.ok(!bodies[0].includes('raise exception'));
});

test('database constraints and owner-only RPC remain in all sources', () => {
  for (const source of sources) {
    assert.ok(source.includes('char_length(real_name) between 1 and 50'));
    assert.ok(source.includes("real_name !~ '[[:cntrl:]]'"));
    assert.ok(source.includes("security definer set search_path = ''"));
    assert.ok(source.includes("m.status = 'approved'"));
    assert.ok(source.includes('c.owner_id = (select auth.uid())'));
  }
});

test('signup form keeps real name required', () => {
  const form = readFileSync(new URL('../../../client/src/features/auth/SignupPage.jsx', import.meta.url), 'utf8');
  assert.match(form, /<Field\b[^>]*id="real-name"[^>]*\brequired\b/);
  assert.ok(form.includes('normalizeMemberName'));
});
