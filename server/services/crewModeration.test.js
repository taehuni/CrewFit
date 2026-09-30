import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateCrewRequest } from './crewMembership.js';
const owner = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
function mock({ crew = { owner_id: owner }, result = { data: [{ user_id: target }] } } = {}) {
  const calls = [];
  return { calls, db: { from(table) { return {
    select() { return table === 'crews' ? this : Promise.resolve(result); },
    eq(...args) { calls.push(args); return this; },
    async maybeSingle() { return { data: crew }; },
    update(row) { calls.push(row); return this; }, delete() { calls.push('delete'); return this; },
  }; } } };
}
test('approve/reject scope mutation to pending target and crew; approval does not grant posting', async () => {
  for (const action of ['approve', 'reject']) {
    const { db, calls } = mock();
    assert.deepEqual(await moderateCrewRequest(db, owner, '15', target, action), { ok: true });
    assert.ok(calls.some(row => JSON.stringify(row) === JSON.stringify(['status', 'pending'])));
    assert.ok(calls.some(row => JSON.stringify(row) === JSON.stringify(['user_id', target])));
    assert.ok(calls.some(row => JSON.stringify(row) === JSON.stringify(['crew_id', '15'])));
    if (action === 'approve') assert.ok(calls.some(row => row.status === 'approved' && row.can_post === false));
    else assert.ok(calls.includes('delete'));
  }
});
test('moderation rejects missing auth, invalid input, non-owner and self before writes', async () => {
  await assert.rejects(moderateCrewRequest({}, null, '15', target, 'approve'), { status: 401 });
  await assert.rejects(moderateCrewRequest({}, owner, 'x', target, 'approve'), { status: 400 });
  await assert.rejects(moderateCrewRequest({}, owner, '15', 'x', 'approve'), { status: 400 });
  for (const [caller, member] of [[target, owner], [owner, owner]]) {
    const { db, calls } = mock();
    await assert.rejects(moderateCrewRequest(db, caller, '15', member, 'approve'), { status: 403 });
    assert.equal(calls.length, 1);
  }
});
test('moderation reports missing crew, stale requests and database failures', async () => {
  await assert.rejects(moderateCrewRequest(mock({crew:null}).db, owner, '15', target, 'approve'), {status:404});
  for (const [result, status] of [[{data:[]},409], [{error:{code:'42501'}},403], [{error:{code:'other'}},500]])
    await assert.rejects(moderateCrewRequest(mock({result}).db, owner, '15', target, 'reject'), {status});
});
