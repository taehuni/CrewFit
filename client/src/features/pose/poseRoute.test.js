import test from 'node:test';
import assert from 'node:assert/strict';
import {poseRoute} from './poseRoute.js';

test('default and legacy manual entry choose an exercise without automatic classification',()=>{
 for(const search of ['', '?view=manual', '?view=manual&exercise=bench_press', '?view=unknown'])assert.equal(poseRoute(search),'selection');
 assert.equal(poseRoute('?view=auto'),'auto');
});
test('only supported explicit local choices open the real-time evaluator',()=>{
 for(const exercise of ['squat','lunge','pushup'])assert.equal(poseRoute(`?view=local&exercise=${exercise}`),'local');
 for(const exercise of ['', 'bench_press','other'])assert.equal(poseRoute(`?view=local&exercise=${exercise}`),'selection');
});
test('saved-result deep links and criteria remain reachable after changing the default',()=>{
 assert.equal(poseRoute('', '#pose-history-title'),'history');
 assert.equal(poseRoute('?view=history'),'history');
 assert.equal(poseRoute('?view=manual','#pose-history-title'),'history');
 assert.equal(poseRoute('?view=criteria'),'criteria');
});
test('a hash-only change cannot remount an active local or automatic measurement',()=>{
 assert.equal(poseRoute('?view=local&exercise=squat','#pose-history-title'),'local');
 assert.equal(poseRoute('?view=auto','#pose-history-title'),'auto');
});
