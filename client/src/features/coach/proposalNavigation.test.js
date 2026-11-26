import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalSavedDate } from './proposalNavigation.js';

test('opening a saved proposal uses its own first date, not today or a different conversation', () => {
  assert.equal(proposalSavedDate('future', [
    {turn_id:'other', scheduled_on:'2026-11-24'},
    {turn_id:'future', scheduled_on:'2026-12-09'},
    {turn_id:'future', scheduled_on:'2026-12-07'},
  ]), '2026-12-07');
  assert.equal(proposalSavedDate('past', [{turn_id:'past',scheduled_on:'2025-01-03'}]),'2025-01-03');
  assert.equal(proposalSavedDate('missing', []), null);
});
