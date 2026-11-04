import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coachRouteState} from './coachRoute.js';
test('URL restores the plan screen and selected day on a fresh visit',()=>{
 assert.deepEqual(coachRouteState(new URLSearchParams('view=plans&date=2026-11-02'),'2026-11-03'),{view:'plans',date:'2026-11-02'});
 assert.equal(coachRouteState(new URLSearchParams('view=chat'),'2026-11-03','plans').view,'conversation');
});
test('invalid or impossible dates fall back to today',()=>{
 for(const date of ['2026-02-30','nope','1999-01-01',''])assert.equal(coachRouteState(new URLSearchParams({date}),'2026-11-03').date,'2026-11-03');
});
