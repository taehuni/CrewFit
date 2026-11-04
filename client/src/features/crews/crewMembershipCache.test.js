import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshCrewMembership } from './crewMembershipCache.js';
import { QueryClient } from '@tanstack/react-query';

test('leaving clears restricted cached content before refetch and scopes to current viewer', async () => {
  const reset = [], invalidated = [];
  const cache = { resetQueries: async ({queryKey}) => reset.push(queryKey), invalidateQueries: async ({queryKey}) => invalidated.push(queryKey) };
  await refreshCrewMembership(cache, 'viewer', 19, true);
  assert.deepEqual(reset, [['posts','viewer'], ['feedContext','viewer'], ['members','viewer'], ['crew-chat-messages','viewer']]);
  assert.ok(invalidated.some(key => key[0] === 'crew-chat-rooms'));
  assert.ok([...reset,...invalidated].every(key => key[1] === 'viewer'));
});
test('departure removes previously visible crew-only posts but leaves another viewer cache untouched', async () => {
  const cache = new QueryClient();
  const mine = ['posts','viewer','list','19',''];
  const other = ['posts','someone-else','list','19',''];
  cache.setQueryData(mine, {pages:[{rows:[{visibility:'crew'}]}]});
  cache.setQueryData(other, {safe:true});
  cache.setQueryData(['feedContext','viewer','19'], {canWrite:true});
  await refreshCrewMembership(cache, 'viewer', 19, true);
  assert.equal(cache.getQueryData(mine), undefined);
  assert.equal(cache.getQueryData(['feedContext','viewer','19']), undefined);
  assert.deepEqual(cache.getQueryData(other), {safe:true});
  cache.clear();
});
test('joining rechecks feed write permission and messages without clearing existing content', async () => {
  const invalidated = [];
  await refreshCrewMembership({resetQueries:()=>assert.fail('join must not reset'),invalidateQueries:async ({queryKey})=>invalidated.push(queryKey)}, 'viewer', 19);
  assert.ok(invalidated.some(key => key[0] === 'feedContext'));
  assert.ok(invalidated.some(key => key[0] === 'posts'));
  assert.ok(invalidated.some(key => key[0] === 'crew-chat-messages'));
});
