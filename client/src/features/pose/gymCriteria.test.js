import test from 'node:test';
import assert from 'node:assert/strict';
import {GYM_EXERCISE_CRITERIA as entries} from './gymCriteria.js';

test('reference catalogue keeps evidence separate from camera support',()=>{
 assert.equal(new Set(entries.map(row=>row.id)).size,entries.length);
 for(const row of entries){
  assert.ok(row.id&&row.label&&row.bodyRegion&&row.equipment.length);
  assert.ok(['reference-only','pending'].includes(row.evaluationStatus));
  for(const field of ['aliases','sources','criteria','observable','notObservable'])assert.ok(Array.isArray(row[field]));
  if(row.evaluationStatus==='pending')assert.equal(row.criteria.length,0);
  else{
   assert.ok(row.criteria.length&&row.sources.length&&row.notObservable.length);
   for(const source of row.sources){
    const url=new URL(source.url);
    assert.equal(url.protocol,'https:');
    assert.ok(['www.acefitness.org','contentcdn.eacefitness.com','www.nasm.org'].includes(url.hostname));
   }
  }
  assert.equal(Object.hasOwn(row,'scoreThreshold'),false);
 }
});
