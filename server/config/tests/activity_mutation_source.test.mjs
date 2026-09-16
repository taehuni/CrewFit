// Source checks only. Execute activity_mutations.sql separately against a test DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sources = ['../schema.sql','../migrations/20260914_update_gym_activity.sql','../../../docs/architecture/schema.md']
  .map(path=>readFileSync(new URL(path,import.meta.url),'utf8').replace(/\r\n/g,'\n'));

test('detached route trigger is identical and clears the flag before FK constraint checks',()=>{
  const bodies=sources.map(source=>source.match(/create or replace function public\.clear_detached_post_route\(\)[\s\S]*?end \$\$;/)?.[0]);
  assert.ok(bodies.every(Boolean));assert.equal(bodies[0],bodies[1]);assert.equal(bodies[1],bodies[2]);
  assert.match(bodies[0],/if new.activity_id is null then\s+new.include_route := false/);
  assert.match(bodies[0],/security invoker set search_path = ''/);
  for(const source of sources){
    assert.match(source,/posts_clear_detached_route before update of activity_id on public.posts/);
    assert.match(source,/clear_detached_post_route\(\) from public, anon, authenticated/);
  }
});

test('gym update SQL matches schema, migration and specification',()=>{
  const bodies=sources.map(source=>source.match(/create or replace function public\.update_gym_activity\([\s\S]*?end \$\$;/)?.[0]);
  assert.ok(bodies.every(Boolean));assert.equal(bodies[0],bodies[1]);assert.equal(bodies[1],bodies[2]);
});
test('gym update keeps RLS, own-parent lock, atomic statements and restricted execution',()=>{
  for(const source of sources){
    const body=source.match(/create or replace function public\.update_gym_activity\([\s\S]*?end \$\$;/)[0];
    assert.match(body,/security invoker set search_path = ''/);
    assert.match(body,/user_id = \(select auth.uid\(\)\) and sport = 'gym'\s+for update/);
    assert.ok(body.indexOf('update public.activities') < body.indexOf('delete from public.exercise_sets'));
    assert.ok(body.indexOf('delete from public.exercise_sets') < body.indexOf('insert into public.exercise_sets'));
    assert.doesNotMatch(body,/exception when|commit;/i);
    assert.match(source,/revoke execute on function public.update_gym_activity\(bigint, date, integer, text, jsonb\) from public, anon/);
    assert.match(source,/grant execute on function public.update_gym_activity\(bigint, date, integer, text, jsonb\) to authenticated/);
  }
});
