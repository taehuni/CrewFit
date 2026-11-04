import test from 'node:test';
import assert from 'node:assert/strict';
import { planActivityDraft } from './planActivity.js';
import { activityPayload } from './record.js';

const plan = { title: '저녁 러닝', sport: 'running', scheduled_on: '2026-10-28', minutes: 30, note: '천천히 시작' };
const draftFor = state => planActivityDraft({planOwnerId:'owner', ...state}, 'owner');
test('plan supplies editable date, duration and notes without invented measurements', () => {
  const draft = draftFor({ workoutPlan: plan, returnTo: 'https://example.com' });
  assert.equal(draft.values.date, '2026-10-28');
  assert.equal(draft.values.minutes, '30');
  assert.equal(draft.values.note, '');
  assert.equal(draft.note, plan.note);
  assert.equal(draft.returnTo, '/coach?view=plans&date=2026-10-28');
  assert.equal(draft.values.distance, '');
  assert.ok(activityPayload(draft.values).errors.distance);
  assert.deepEqual(activityPayload({ ...draft.values, minutes: '24', distance: '3' }).errors, {});
});
test('invalid navigation data does not seed the activity form', () => {
  for (const state of [null, {}, { workoutPlan: [] }]) assert.equal(planActivityDraft(state), null);
  for (const patch of [{sport:'bad'}, {scheduled_on:'2026-02-30'}, {scheduled_on:'2026-1-1'}, {minutes:'30'}, {minutes:0}, {minutes:241}, {title:''}, {note:[]}, {note:'x'.repeat(1001)}]) {
    assert.equal(draftFor({workoutPlan:{...plan,...patch}}), null);
  }
});
test('gym plan still requires actual exercise sets; no predicted reps or weight', () => {
  const draft = draftFor({workoutPlan:{...plan,sport:'gym',note:null}});
  assert.deepEqual(draft.values.sets, [{name:'',reps:'',weight:''}]);
  assert.ok(activityPayload(draft.values).errors['name-0']);
  assert.ok(activityPayload(draft.values).errors['reps-0']);
});
test('plan draft cannot carry over when signed-in account changes', () => {
  assert.equal(planActivityDraft({workoutPlan:plan,planOwnerId:'original'}, 'another'), null);
  assert.equal(planActivityDraft({workoutPlan:plan}, 'owner'), null);
});
