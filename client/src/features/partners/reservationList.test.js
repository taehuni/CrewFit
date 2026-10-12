import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationGroup,filterReservations} from './reservationList.js';
test('today is upcoming; cancellation takes priority over visit date',()=>{
 assert.equal(reservationGroup({visit_on:'2026-10-12',status:'pending'},'2026-10-12'),'upcoming');
 assert.equal(reservationGroup({visit_on:'2026-10-11',status:'test_paid'},'2026-10-12'),'past');
 assert.equal(reservationGroup({visit_on:'2026-10-11',status:'cancelled'},'2026-10-12'),'cancelled');
 assert.equal(reservationGroup({visit_on:'2026-10-13',status:'cancelled'},'2026-10-12'),'cancelled');
});
test('upcoming sorted nearest first without mutating source; cancelled excluded',()=>{
 const rows=[{id:1,visit_on:'2026-10-15',status:'pending'},{id:2,visit_on:'2026-10-12',status:'test_paid'},{id:3,visit_on:'2026-10-13',status:'cancelled'}];
 assert.deepEqual(filterReservations(rows,'upcoming','2026-10-12').map(r=>r.id),[2,1]);
 assert.deepEqual(rows.map(r=>r.id),[1,2,3]);
 assert.deepEqual(filterReservations(rows,'all','2026-10-12').map(r=>r.id),[1,3,2]);
});
