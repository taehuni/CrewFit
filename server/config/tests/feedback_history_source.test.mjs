import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../migrations/20260921_feedback_history.sql', import.meta.url), 'utf8').trim().replaceAll('\r', '');
test('history migration is embedded in schema and specification', () => {
  for (const path of ['../schema.sql', '../../../docs/architecture/schema.md']) {
    assert.ok(readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r','').includes(migration));
  }
});
test('history archive is atomic, owner-readable and not writable by clients', () => {
  assert.match(migration, /^.*\nbegin;/);
  assert.match(migration, /lock table public.ai_feedbacks/);
  assert.match(migration, /after insert or update on public.ai_feedbacks/);
  assert.match(migration, /security invoker set search_path = ''/);
  assert.match(migration, /revoke all on public.ai_feedback_history from public, anon, authenticated/);
  assert.match(migration, /using \(user_id = \(select auth.uid\(\)\)\)/);
  assert.match(migration, /unique \(feedback_id, llm_calls\)/);
  assert.match(migration, /on conflict \(feedback_id,llm_calls\) do nothing/);
  assert.match(migration, /commit;$/);
});
