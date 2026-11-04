import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarPlanAccess} from './calendarPlanAccess.js';
test('an already exported plan remains openable after the Google provider token expires',()=>{
 const saved={plan_id:'mine',event_url:'https://calendar.google.com/calendar/event?eid=example'};
 assert.deepEqual(calendarPlanAccess({id:'mine'},[saved],false),{mode:'saved',saved});
 assert.deepEqual(calendarPlanAccess({id:'new'},[saved],false),{mode:'connect'});
});
test('token permits new export but does not replace an existing event link',()=>{
 const saved={plan_id:'mine',event_url:'https://calendar.google.com/'};
 assert.equal(calendarPlanAccess({id:'mine'},[saved],true).mode,'saved');
 assert.equal(calendarPlanAccess({id:'new'},[saved],true).mode,'add');
 assert.equal(calendarPlanAccess({id:'new'},undefined,false).mode,'connect');
});
