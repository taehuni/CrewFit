import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCrewMembers, updateCrewMember } from './crewManagement.js';
const crew = { id: 15, owner_id: 'owner' };
test('management rejects non-owner, self and pending member changes before queries', async () => {
  await assert.rejects(loadCrewMembers({}, crew, 'stranger'));
  for (const member of [{user_id:'owner',status:'approved'}, {user_id:'other',status:'pending'}])
    await assert.rejects(updateCrewMember({}, crew, 'owner', member, 'kick'));
});
test('member mutations constrain crew, target and approved status; permission compares previous value', async () => {
  for (const action of ['kick', 'permission']) {
    const calls = [];
    const db = {from() { return {
      delete() {calls.push('delete');return this;}, update(row) {calls.push(row);return this;},
      eq(...args) {calls.push(args);return this;}, async select() {return {data:[{user_id:'other'}]};},
    };}};
    await updateCrewMember(db, crew, 'owner', {user_id:'other',status:'approved',can_post:false}, action);
    assert.ok(calls.some(row => JSON.stringify(row) === '["status","approved"]'));
    assert.ok(calls.some(row => JSON.stringify(row) === '["crew_id",15]'));
    assert.ok(calls.some(row => JSON.stringify(row) === '["user_id","other"]'));
    if (action === 'permission') {
      assert.ok(calls.some(row => row.can_post === true));
      assert.ok(calls.some(row => JSON.stringify(row) === '["can_post",false]'));
    }
  }
});
test('member listing never attaches pending real names even if RPC includes them', async () => {
  const db = {from(table) {return {
    select(){return this;},eq(){return this;},order(){return this;},
    async range(){return {data:[{user_id:'a',status:'pending'},{user_id:'b',status:'approved'}]};},
    async in(){return {data:[{id:'a',nickname:'A'},{id:'b',nickname:'B'}]};},
  };},async rpc(){return {data:[{user_id:'a',real_name:'hidden'},{user_id:'b',real_name:'visible'}]};}};
  const result = await loadCrewMembers(db, crew, 'owner');
  assert.equal(result.members[0].real_name, null);
  assert.equal(result.members[1].real_name, 'visible');
  assert.equal(result.next, undefined);
});
test('stale member mutation is not reported as success', async () => {
  const db = {from(){return {delete(){return this;},eq(){return this;},async select(){return {data:[]};}};}};
  await assert.rejects(updateCrewMember(db, crew, 'owner', {user_id:'other',status:'approved'}, 'kick'), /다시 조회/);
});
