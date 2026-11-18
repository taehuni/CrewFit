import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeSurfaceBack} from './nativeBack.js';

test('an open surface consumes Android Back before route navigation; closed surface releases it',()=>{
 const target=new EventTarget();let closed=0;
 assert.equal(consumeSurfaceBack(target),false);
 const close=e=>{closed++;e.preventDefault();};target.addEventListener('crewfit:surface-back',close);
 assert.equal(consumeSurfaceBack(target),true);assert.equal(closed,1);
 target.removeEventListener('crewfit:surface-back',close);assert.equal(consumeSurfaceBack(target),false);
});
