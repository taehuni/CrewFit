import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFilters} from './coachHistory.js';
test('history dates use Korea midnight and exclude following midnight',()=>{assert.deepEqual(historyFilters({date:'2026-10-21',q:' 걷기 '}),{q:'걷기',start:'2026-10-20T15:00:00.000Z',end:'2026-10-21T15:00:00.000Z',cursor:undefined});});
test('invalid date, oversized query, malformed cursor are rejected',()=>{for(const params of [{date:'2026-02-30'},{q:'x'.repeat(101)},{cursor:'bad'},{cursor:Buffer.from(JSON.stringify({id:'bad',time:'2026-01-01'})).toString('base64url')}])assert.throws(()=>historyFilters(params),{status:400});});
