import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sources = ['../schema.sql', '../migrations/20260916_merge_exercise_names.sql', '../../../docs/architecture/schema.md']
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
test('merge SQL is identical in schema, migration and specification', () => {
  const bodies = sources.map(source => source.match(/create or replace function public\.merge_exercise_names\([\s\S]*?end \$\$;/)?.[0]);
  assert.ok(bodies.every(Boolean)); assert.equal(bodies[0], bodies[1]); assert.equal(bodies[1], bodies[2]);
});
test('merge has one atomic literal update, own JWT identity, no admin bypass or swallowed conflict', () => {
  for (const source of sources) {
    const body = source.match(/create or replace function public\.merge_exercise_names\([\s\S]*?end \$\$;/)[0];
    assert.match(body, /security invoker set search_path = ''/);
    assert.match(body, /where user_id = \(select auth.uid\(\)\) and lower\(exercise_name\) = lower\(v_from\)/);
    assert.match(body, /set exercise_name = v_to/);
    assert.equal((body.match(/update public.exercise_sets/g) || []).length, 1);
    assert.match(body, /get diagnostics v_updated = row_count/);
    assert.doesNotMatch(body, /exception when|ilike|execute format|service_role|set_no\s*=|reps\s*=|weight_kg\s*=/i);
    assert.match(source, /revoke all on function public.merge_exercise_names\(text, text\) from public, anon, authenticated/);
    assert.match(source, /grant execute on function public.merge_exercise_names\(text, text\) to authenticated/);
  }
});
