import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeaveGuardRegistry} from './leaveGuardRegistry.js';

test('a clean mounted form cannot override another form with unsaved changes',()=>{
  const registry=createLeaveGuardRegistry();
  let first=true,second=false;
  const removeFirst=registry.register(()=>({enabled:()=>first,message:'first'}));
  const removeSecond=registry.register(()=>({enabled:second,message:'second'}));
  assert.deepEqual(registry.active(),['first']);
  second=true;assert.deepEqual(registry.active(),['first','second']);
  first=false;assert.deepEqual(registry.active(),['second']);
  removeFirst();assert.deepEqual(registry.active(),['second']);
  removeSecond();assert.deepEqual(registry.active(),[]);
});

test('successful save synchronously releases navigation before the next render',()=>{
  const registry=createLeaveGuardRegistry();
  let saved=false;
  registry.register(()=>({enabled:()=>!saved,message:'draft'}));
  assert.equal(registry.active().length,1);
  saved=true;assert.deepEqual(registry.active(),[]);
});
